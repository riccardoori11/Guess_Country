// Authoritative room rules, independent of the transport. The Durable Object
// calls these functions and delivers the returned messages; tests call them
// directly with fixed clocks and random sources.
import { countries } from '../data/countries';
import {
  createSequence,
  isCorrectAnswer,
  isCorrectCapitalAnswer,
  normalizeAnswer,
} from '../lib/game';
import {
  COUNTDOWN_MS,
  DEFAULT_SETTINGS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_ANSWER_INTERVAL_MS,
  ROOM_IDLE_MS,
  poolSize,
  sanitizeName,
  type ClientMessage,
  type ErrorCode,
  type Question,
  type RoomSettings,
  type RoomSnapshot,
  type ServerMessage,
  type Standing,
} from './protocol';

const countryById = new Map(countries.map((country) => [country.id, country]));

export interface PlayerRecord {
  id: string;
  /** Secret that lets the same browser tab reclaim this player after a reconnect. */
  token: string;
  name: string;
  joinedAt: number;
  connected: boolean;
  inMatch: boolean;
  score: number;
  wrong: number;
  skipped: number;
  /** Index into the room sequence (wraps if a player gets through it all). */
  position: number;
  lastWrong: string;
  lastAnswerAt: number;
}

export interface RoomRecord {
  code: string;
  createdAt: number;
  lastActivity: number;
  phase: 'lobby' | 'playing';
  leaderId: string | null;
  settings: RoomSettings;
  round: number;
  startsAt: number;
  endsAt: number;
  /** Country IDs, shuffled once per match; every player sees the same order. */
  sequence: string[];
  players: PlayerRecord[];
  results: Standing[] | null;
}

export interface Outbound {
  to: string;
  message: ServerMessage;
}

/** What a room operation produced: direct messages and whether state changed. */
export interface Update {
  broadcast: boolean;
  messages: Outbound[];
}

const NOTHING: Update = { broadcast: false, messages: [] };

function error(to: string, code: ErrorCode, message: string): Update {
  return { broadcast: false, messages: [{ to, message: { type: 'error', code, message } }] };
}

export function createRoom(code: string, now: number): RoomRecord {
  return {
    code,
    createdAt: now,
    lastActivity: now,
    phase: 'lobby',
    leaderId: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    round: 0,
    startsAt: 0,
    endsAt: 0,
    sequence: [],
    players: [],
    results: null,
  };
}

function findPlayer(room: RoomRecord, id: string) {
  return room.players.find((player) => player.id === id);
}

/** The leader is always a connected player when one exists. */
function ensureLeader(room: RoomRecord) {
  const leader = room.leaderId ? findPlayer(room, room.leaderId) : undefined;
  if (leader?.connected) return;
  const next = room.players
    .filter((player) => player.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
  room.leaderId = next?.id ?? (leader ? leader.id : null);
}

function uniqueName(room: RoomRecord, name: string, selfId?: string): string {
  const taken = new Set(
    room.players
      .filter((player) => player.id !== selfId)
      .map((player) => player.name.toLocaleLowerCase('en')),
  );
  if (!taken.has(name.toLocaleLowerCase('en'))) return name;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const base = [...name].slice(0, MAX_NAME_LENGTH - suffix.length).join('').trimEnd();
    const candidate = base + suffix;
    if (!taken.has(candidate.toLocaleLowerCase('en'))) return candidate;
  }
}

export function snapshot(room: RoomRecord, now: number): RoomSnapshot {
  return {
    code: room.code,
    phase: room.phase,
    leaderId: room.leaderId,
    settings: room.settings,
    round: room.round,
    startsAt: room.startsAt,
    endsAt: room.endsAt,
    serverNow: now,
    players: room.players
      .slice()
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(({ id, name, connected, inMatch, score }) => ({
        id,
        name,
        connected,
        inMatch,
        score,
      })),
    results: room.results,
  };
}

/** The player's current question, or null outside the active match window. */
export function questionFor(
  room: RoomRecord,
  playerId: string,
  now: number,
): Question | null {
  const player = findPlayer(room, playerId);
  if (
    !player?.inMatch ||
    room.phase !== 'playing' ||
    now < room.startsAt ||
    now >= room.endsAt ||
    !room.sequence.length
  )
    return null;
  return {
    round: room.round,
    number: player.position + 1,
    countryId: room.sequence[player.position % room.sequence.length],
  };
}

/** Question messages for every connected player (sent when a match begins). */
export function questionMessages(room: RoomRecord, now: number): Outbound[] {
  return room.players
    .filter((player) => player.connected)
    .map((player) => ({
      to: player.id,
      message: { type: 'question', question: questionFor(room, player.id, now) },
    }));
}

export type JoinResult =
  | { ok: true; player: PlayerRecord; reconnected: boolean }
  | { ok: false; code: ErrorCode; message: string };

export function joinRoom(
  room: RoomRecord,
  request: { name: string; token?: string },
  now: number,
  ids: { id: string; token: string },
): JoinResult {
  const name = sanitizeName(request.name);
  if (!name)
    return { ok: false, code: 'invalid-name', message: 'Choose a name between 1 and 20 characters.' };
  room.lastActivity = now;
  const existing = request.token
    ? room.players.find((player) => player.token === request.token)
    : undefined;
  if (existing) {
    existing.connected = true;
    existing.name = uniqueName(room, name, existing.id);
    ensureLeader(room);
    return { ok: true, player: existing, reconnected: true };
  }
  if (room.players.length >= MAX_PLAYERS)
    return { ok: false, code: 'room-full', message: `This room is full (${MAX_PLAYERS} players).` };
  const player: PlayerRecord = {
    id: ids.id,
    token: ids.token,
    name: uniqueName(room, name),
    joinedAt: now,
    connected: true,
    inMatch: false,
    score: 0,
    wrong: 0,
    skipped: 0,
    position: 0,
    lastWrong: '',
    lastAnswerAt: 0,
  };
  room.players.push(player);
  ensureLeader(room);
  return { ok: true, player, reconnected: false };
}

/**
 * A dropped connection. In the lobby the player is removed straight away;
 * during a match their score is kept so a page refresh can reclaim it.
 */
export function disconnectPlayer(room: RoomRecord, playerId: string, now: number): Update {
  const player = findPlayer(room, playerId);
  if (!player) return NOTHING;
  room.lastActivity = now;
  if (room.phase === 'lobby')
    room.players = room.players.filter((value) => value.id !== playerId);
  else player.connected = false;
  ensureLeader(room);
  return { broadcast: true, messages: [] };
}

export function leaveRoom(room: RoomRecord, playerId: string, now: number): Update {
  if (!findPlayer(room, playerId)) return NOTHING;
  room.lastActivity = now;
  room.players = room.players.filter((player) => player.id !== playerId);
  ensureLeader(room);
  return { broadcast: true, messages: [] };
}

function requireLeader(room: RoomRecord, playerId: string): Update | null {
  if (!findPlayer(room, playerId))
    return error(playerId, 'not-joined', 'Join the room first.');
  if (room.leaderId !== playerId)
    return error(playerId, 'not-leader', 'Only the room leader can do that.');
  return null;
}

export function transferLeader(
  room: RoomRecord,
  playerId: string,
  targetId: string,
  now: number,
): Update {
  const denied = requireLeader(room, playerId);
  if (denied) return denied;
  const target = findPlayer(room, targetId);
  if (!target?.connected)
    return error(playerId, 'unknown-player', 'That player is no longer in the room.');
  room.lastActivity = now;
  room.leaderId = target.id;
  return { broadcast: true, messages: [] };
}

export function updateSettings(
  room: RoomRecord,
  playerId: string,
  settings: RoomSettings,
  now: number,
): Update {
  const denied = requireLeader(room, playerId);
  if (denied) return denied;
  if (room.phase !== 'lobby')
    return error(playerId, 'wrong-phase', 'Settings can be changed between matches.');
  room.lastActivity = now;
  room.settings = settings;
  return { broadcast: true, messages: [] };
}

export function startMatch(
  room: RoomRecord,
  playerId: string,
  now: number,
  random: () => number = Math.random,
): Update {
  const denied = requireLeader(room, playerId);
  if (denied) return denied;
  if (room.phase !== 'lobby')
    return error(playerId, 'wrong-phase', 'A match is already running.');
  if (!poolSize(room.settings))
    return error(playerId, 'empty-pool', 'Choose filters that include at least one country.');
  room.lastActivity = now;
  room.sequence = createSequence(
    { mode: 'random', continents: room.settings.continents, letters: room.settings.letters },
    random,
  ).map((country) => country.id);
  room.players = room.players.filter((player) => player.connected);
  for (const player of room.players)
    Object.assign(player, {
      inMatch: true,
      score: 0,
      wrong: 0,
      skipped: 0,
      position: 0,
      lastWrong: '',
      lastAnswerAt: 0,
    });
  room.round += 1;
  room.phase = 'playing';
  room.startsAt = now + COUNTDOWN_MS;
  room.endsAt = room.startsAt + room.settings.duration * 1000;
  room.results = null;
  return { broadcast: true, messages: [] };
}

/** Shared checks for answer/skip; returns the active player or a reply. */
function activeTurn(
  room: RoomRecord,
  playerId: string,
  message: { round: number; countryId: string },
  now: number,
): PlayerRecord | Update {
  const player = findPlayer(room, playerId);
  if (!player) return error(playerId, 'not-joined', 'Join the room first.');
  if (
    room.phase !== 'playing' ||
    !player.inMatch ||
    now < room.startsAt ||
    now >= room.endsAt
  )
    return error(playerId, 'wrong-phase', 'The match is not running.');
  const question = questionFor(room, playerId, now);
  // A stale answer (previous question or round): resend the current question.
  if (message.round !== room.round || message.countryId !== question?.countryId)
    return {
      broadcast: false,
      messages: [{ to: playerId, message: { type: 'question', question } }],
    };
  if (now - player.lastAnswerAt < MIN_ANSWER_INTERVAL_MS)
    return error(playerId, 'too-fast', 'Slow down a little.');
  player.lastAnswerAt = now;
  room.lastActivity = now;
  return player;
}

function advance(room: RoomRecord, player: PlayerRecord, now: number): Outbound {
  player.position += 1;
  player.lastWrong = '';
  return {
    to: player.id,
    message: { type: 'question', question: questionFor(room, player.id, now) },
  };
}

export function submitAnswer(
  room: RoomRecord,
  playerId: string,
  message: Extract<ClientMessage, { type: 'answer' }>,
  now: number,
): Update {
  const player = activeTurn(room, playerId, message, now);
  if (!('token' in player)) return player;
  const country = countryById.get(message.countryId);
  if (!country) return NOTHING;
  const { activity } = room.settings;
  const normalized =
    activity === 'placement' ? message.value : normalizeAnswer(message.value);
  if (!normalized) return NOTHING;
  const correct =
    activity === 'placement'
      ? message.value === country.id
      : activity === 'capital'
        ? isCorrectCapitalAnswer(country, message.value)
        : isCorrectAnswer(country, message.value);
  const feedback = (outcome: 'correct' | 'incorrect'): Outbound => ({
    to: playerId,
    message: {
      type: 'feedback',
      round: room.round,
      countryId: country.id,
      outcome,
      value: message.value,
    },
  });
  if (correct) {
    player.score += 1;
    return { broadcast: true, messages: [feedback('correct'), advance(room, player, now)] };
  }
  // Repeating the same wrong answer counts once, as in the solo games.
  if (normalized !== player.lastWrong) {
    player.wrong += 1;
    player.lastWrong = normalized;
  }
  return { broadcast: false, messages: [feedback('incorrect')] };
}

export function skipQuestion(
  room: RoomRecord,
  playerId: string,
  message: Extract<ClientMessage, { type: 'skip' }>,
  now: number,
): Update {
  const player = activeTurn(room, playerId, message, now);
  if (!('token' in player)) return player;
  player.skipped += 1;
  return {
    broadcast: false,
    messages: [
      {
        to: playerId,
        message: {
          type: 'feedback',
          round: room.round,
          countryId: message.countryId,
          outcome: 'skipped',
        },
      },
      advance(room, player, now),
    ],
  };
}

/** Most correct answers wins; fewer wrong guesses breaks ties. */
export function standings(room: RoomRecord): Standing[] {
  const sorted = room.players
    .filter((player) => player.inMatch)
    .sort(
      (a, b) =>
        b.score - a.score || a.wrong - b.wrong || a.joinedAt - b.joinedAt,
    );
  let rank = 0;
  return sorted.map((player, index) => {
    const previous = sorted[index - 1];
    if (!previous || previous.score !== player.score || previous.wrong !== player.wrong)
      rank = index + 1;
    const { id, name, score, wrong, skipped } = player;
    return { id, name, rank, score, wrong, skipped };
  });
}

/** Ends the match once its time is up. Returns true when it ended. */
export function finishIfDue(room: RoomRecord, now: number): boolean {
  if (room.phase !== 'playing' || now < room.endsAt) return false;
  room.results = standings(room);
  room.phase = 'lobby';
  room.sequence = [];
  room.players = room.players.filter((player) => player.connected);
  for (const player of room.players) player.inMatch = false;
  ensureLeader(room);
  return true;
}

/** When the Durable Object should next wake: start, end, or idle expiry. */
export function nextWake(room: RoomRecord, now: number): number {
  if (room.phase === 'playing') return now < room.startsAt ? room.startsAt : room.endsAt;
  return room.lastActivity + ROOM_IDLE_MS;
}

export function isExpired(room: RoomRecord, now: number): boolean {
  return room.phase === 'lobby' && now >= room.lastActivity + ROOM_IDLE_MS;
}
