import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_ANSWER_INTERVAL_MS,
  ROOM_IDLE_MS,
} from './protocol';
import {
  createRoom,
  disconnectPlayer,
  finishIfDue,
  isExpired,
  joinRoom,
  leaveRoom,
  nextWake,
  questionFor,
  skipQuestion,
  snapshot,
  standings,
  startMatch,
  submitAnswer,
  transferLeader,
  updateSettings,
  type RoomRecord,
} from './room';

const T0 = 1_000_000;
let counter = 0;
const ids = () => ({ id: `p${++counter}`, token: `t${counter}` });

function join(room: RoomRecord, name: string, now = T0, token?: string) {
  const result = joinRoom(room, { name, token }, now, ids());
  if (!result.ok) throw new Error(result.message);
  return result.player;
}

function roomWith(...names: string[]) {
  const room = createRoom('ABCDEF', T0);
  const players = names.map((name, index) => join(room, name, T0 + index));
  return { room, players };
}

/** A started match, past the countdown, limited to France for predictability. */
function playing(activity: 'flag' | 'capital' | 'placement' = 'flag') {
  const { room, players } = roomWith('Ada', 'Bo');
  updateSettings(room, players[0].id, {
    ...DEFAULT_SETTINGS,
    activity,
    continents: ['Europe'],
    letters: ['F'],
  }, T0);
  startMatch(room, players[0].id, T0, () => 0);
  return { room, players, now: T0 + COUNTDOWN_MS };
}

describe('joining and leadership', () => {
  it('makes the first player the leader and de-duplicates names', () => {
    const { room, players } = roomWith('Ada', 'ada', 'Ada');
    expect(room.leaderId).toBe(players[0].id);
    expect(players.map((player) => player.name)).toEqual(['Ada', 'ada 2', 'Ada 3']);
  });

  it('rejects empty names and full rooms', () => {
    const room = createRoom('ABCDEF', T0);
    expect(joinRoom(room, { name: '   ' }, T0, ids())).toMatchObject({ ok: false, code: 'invalid-name' });
    for (let i = 0; i < MAX_PLAYERS; i++) join(room, `P${i}`);
    expect(joinRoom(room, { name: 'Late' }, T0, ids())).toMatchObject({ ok: false, code: 'room-full' });
  });

  it('only lets the leader change settings, start, or hand over leadership', () => {
    const { room, players: [ada, bo] } = roomWith('Ada', 'Bo');
    const settings = { ...DEFAULT_SETTINGS, duration: 30 as const };
    expect(updateSettings(room, bo.id, settings, T0).messages[0].message).toMatchObject({ code: 'not-leader' });
    expect(startMatch(room, bo.id, T0).messages[0].message).toMatchObject({ code: 'not-leader' });
    expect(transferLeader(room, bo.id, bo.id, T0).messages[0].message).toMatchObject({ code: 'not-leader' });
    expect(updateSettings(room, ada.id, settings, T0).broadcast).toBe(true);
    expect(room.settings.duration).toBe(30);
    transferLeader(room, ada.id, bo.id, T0);
    expect(room.leaderId).toBe(bo.id);
  });

  it('passes leadership on when the leader leaves or disconnects', () => {
    const { room, players: [ada, bo, cy] } = roomWith('Ada', 'Bo', 'Cy');
    leaveRoom(room, ada.id, T0);
    expect(room.leaderId).toBe(bo.id);
    disconnectPlayer(room, bo.id, T0);
    expect(room.leaderId).toBe(cy.id);
    // In the lobby a disconnected player is removed.
    expect(room.players.map((player) => player.id)).toEqual([cy.id]);
  });

  it('keeps a disconnected player during a match so a refresh restores their score', () => {
    const { room, players: [ada], now } = playing();
    submitAnswer(room, ada.id, { type: 'answer', round: 1, countryId: 'fr', value: 'France' }, now);
    disconnectPlayer(room, ada.id, now);
    expect(room.players.find((player) => player.id === ada.id)?.connected).toBe(false);
    const again = joinRoom(room, { name: 'Ada', token: ada.token }, now, ids());
    expect(again).toMatchObject({ ok: true, reconnected: true });
    expect(again.ok && again.player.score).toBe(1);
  });
});

describe('a match', () => {
  it('starts with a countdown, then gives everyone the same question', () => {
    const { room, players: [ada, bo], now } = playing();
    expect(room.phase).toBe('playing');
    expect(room.startsAt).toBe(T0 + COUNTDOWN_MS);
    expect(room.endsAt).toBe(room.startsAt + 60_000);
    expect(questionFor(room, ada.id, now - 1)).toBeNull();
    expect(questionFor(room, ada.id, now)).toEqual({ round: 1, number: 1, countryId: 'fr' });
    expect(questionFor(room, bo.id, now)?.countryId).toBe('fr');
    expect(nextWake(room, T0)).toBe(room.startsAt);
    expect(nextWake(room, now)).toBe(room.endsAt);
  });

  it('refuses to start with an empty country pool', () => {
    const { room, players: [ada] } = roomWith('Ada');
    updateSettings(room, ada.id, { ...DEFAULT_SETTINGS, letters: [] }, T0);
    expect(startMatch(room, ada.id, T0).messages[0].message).toMatchObject({ code: 'empty-pool' });
    expect(room.phase).toBe('lobby');
  });

  it('scores correct answers server-side and moves on', () => {
    const { room, players: [ada], now } = playing();
    const update = submitAnswer(room, ada.id, { type: 'answer', round: 1, countryId: 'fr', value: ' france ' }, now);
    expect(update.broadcast).toBe(true);
    expect(update.messages.map(({ message }) => message.type)).toEqual(['feedback', 'question']);
    expect(update.messages[0].message).toMatchObject({ outcome: 'correct' });
    expect(update.messages[1].message).toMatchObject({ question: { number: 2, countryId: 'fi' } });
    expect(snapshot(room, now).players.find((player) => player.id === ada.id)?.score).toBe(1);
    // The pool (France, Finland) wraps around rather than running out.
    submitAnswer(room, ada.id, { type: 'answer', round: 1, countryId: 'fi', value: 'Finland' }, now + 500);
    expect(questionFor(room, ada.id, now + 500)).toEqual({ round: 1, number: 3, countryId: 'fr' });
  });

  it('counts a repeated wrong answer once and does not broadcast it', () => {
    const { room, players: [ada], now } = playing();
    const wrong = { type: 'answer' as const, round: 1, countryId: 'fr', value: 'Spain' };
    expect(submitAnswer(room, ada.id, wrong, now)).toMatchObject({
      broadcast: false,
      messages: [{ message: { outcome: 'incorrect' } }],
    });
    submitAnswer(room, ada.id, wrong, now + MIN_ANSWER_INTERVAL_MS);
    expect(room.players[0].wrong).toBe(1);
  });

  it('rejects answers that come too fast', () => {
    const { room, players: [ada], now } = playing();
    submitAnswer(room, ada.id, { type: 'answer', round: 1, countryId: 'fr', value: 'Spain' }, now);
    const update = submitAnswer(room, ada.id, { type: 'answer', round: 1, countryId: 'fr', value: 'France' }, now + 10);
    expect(update.messages[0].message).toMatchObject({ code: 'too-fast' });
    expect(room.players[0].score).toBe(0);
  });

  it('checks capitals and map selections', () => {
    const capital = playing('capital');
    submitAnswer(capital.room, capital.players[0].id, { type: 'answer', round: 1, countryId: 'fr', value: 'paris' }, capital.now);
    expect(capital.room.players[0].score).toBe(1);

    const map = playing('placement');
    const id = map.players[0].id;
    submitAnswer(map.room, id, { type: 'answer', round: 1, countryId: 'fr', value: 'es' }, map.now);
    submitAnswer(map.room, id, { type: 'answer', round: 1, countryId: 'fr', value: 'fr' }, map.now + 500);
    expect(map.room.players[0]).toMatchObject({ score: 1, wrong: 1 });
  });

  it('ignores answers for a stale question by resending the current one', () => {
    const { room, players: [ada], now } = playing();
    const update = submitAnswer(room, ada.id, { type: 'answer', round: 1, countryId: 'de', value: 'Germany' }, now);
    expect(update.messages).toEqual([
      { to: ada.id, message: { type: 'question', question: { round: 1, number: 1, countryId: 'fr' } } },
    ]);
    expect(room.players[0].score).toBe(0);
  });

  it('rejects answers before the countdown ends and after time is up', () => {
    const { room, players: [ada], now } = playing();
    const answer = { type: 'answer' as const, round: 1, countryId: 'fr', value: 'France' };
    expect(submitAnswer(room, ada.id, answer, now - 1).messages[0].message).toMatchObject({ code: 'wrong-phase' });
    expect(submitAnswer(room, ada.id, answer, room.endsAt).messages[0].message).toMatchObject({ code: 'wrong-phase' });
    expect(room.players[0].score).toBe(0);
  });

  it('lets players skip', () => {
    const { room, players: [ada], now } = playing();
    const update = skipQuestion(room, ada.id, { type: 'skip', round: 1, countryId: 'fr' }, now);
    expect(update.messages[0].message).toMatchObject({ outcome: 'skipped' });
    expect(room.players[0]).toMatchObject({ skipped: 1, position: 1 });
  });

  it('does not let late joiners play until the next match', () => {
    const { room, now } = playing();
    const late = join(room, 'Late', now);
    expect(late.inMatch).toBe(false);
    expect(questionFor(room, late.id, now)).toBeNull();
    expect(updateSettings(room, room.leaderId!, DEFAULT_SETTINGS, now).messages[0].message).toMatchObject({ code: 'wrong-phase' });
  });

  it('ends on time with ranked results, ties sharing a rank', () => {
    const { room, players: [ada, bo], now } = playing();
    const cy = join(room, 'Cy', now);
    let t = now;
    const answer = (id: string, value: string) => {
      t += 1000;
      submitAnswer(room, id, { type: 'answer', round: 1, countryId: 'fr', value }, t);
    };
    answer(ada.id, 'France');
    answer(bo.id, 'Spain');
    answer(bo.id, 'France');
    expect(finishIfDue(room, room.endsAt - 1)).toBe(false);
    expect(finishIfDue(room, room.endsAt)).toBe(true);
    expect(room.phase).toBe('lobby');
    expect(room.results?.map(({ name, rank, score, wrong }) => ({ name, rank, score, wrong }))).toEqual([
      { name: 'Ada', rank: 1, score: 1, wrong: 0 },
      { name: 'Bo', rank: 2, score: 1, wrong: 1 },
    ]);
    // Cy joined mid-match and is not ranked, but can play the next one.
    expect(room.results?.some((standing) => standing.id === cy.id)).toBe(false);
    expect(room.players.every((player) => !player.inMatch)).toBe(true);
  });

  it('ranks equal scores and wrong counts together', () => {
    const { room, now } = playing();
    expect(standings(room).map((standing) => standing.rank)).toEqual([1, 1]);
    expect(finishIfDue(room, now)).toBe(false);
  });
});

describe('room lifetime', () => {
  it('expires after an hour without activity, but never mid-match', () => {
    const { room } = roomWith('Ada');
    expect(isExpired(room, T0 + ROOM_IDLE_MS - 1)).toBe(false);
    expect(isExpired(room, T0 + ROOM_IDLE_MS)).toBe(true);
    expect(nextWake(room, T0)).toBe(T0 + ROOM_IDLE_MS);
  });
});
