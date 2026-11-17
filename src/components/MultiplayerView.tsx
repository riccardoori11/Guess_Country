import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  Copy,
  Crown,
  Flag,
  LogOut,
  MapPin,
  Plus,
  Settings2,
  SkipForward,
  Trophy,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { CONTINENTS, countries, type Continent } from '../data/countries';
import { capitalsByCountry } from '../data/capitals';
import { LETTERS, type Letter } from '../lib/filters';
import {
  ACTIVITIES,
  ACTIVITY_NAMES,
  DURATIONS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  ROOM_CODE_LENGTH,
  isRoomCode,
  normalizeRoomCode,
  poolSize,
  sanitizeName,
  type ClientMessage,
  type MultiplayerActivity,
  type Question,
  type RoomSettings,
  type RoomSnapshot,
  type Standing,
} from '../multiplayer/protocol';
import {
  requestNewRoom,
  useRoom,
  type Feedback,
  type RoomClientState,
} from '../multiplayer/useRoom';
import { FlagImage } from './FlagImage';
import './multiplayer.css';

const CountryMap = lazy(() =>
  import('./CountryMap').then((module) => ({ default: module.CountryMap })),
);

const countryById = new Map(countries.map((country) => [country.id, country]));
const NAME_KEY = 'flag-atlas:player-name:v1';
const ACTIVITY_ICONS = { flag: Flag, placement: MapPin, capital: Building2 };
type Send = (message: ClientMessage) => boolean;

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not remembering the name is fine.
  }
}
function roomFromUrl(): string {
  return normalizeRoomCode(new URLSearchParams(window.location.search).get('room') ?? '');
}
function setRoomInUrl(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState(window.history.state, '', url);
}

const formatDuration = (seconds: number) =>
  seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`;
function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Server-clock "now", re-rendering a few times a second while active. */
function useServerNow(offset: number, active: boolean) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now() + offset), 200);
    return () => window.clearInterval(timer);
  }, [offset, active]);
  return now;
}

export function MultiplayerView() {
  const [name, setName] = useState(loadName);
  const [joinCode, setJoinCode] = useState(roomFromUrl);
  const [code, setCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const { state, send, leave } = useRoom(code, sanitizeName(name) ?? '');

  function enter(nextCode: string) {
    const clean = sanitizeName(name)!;
    saveName(clean);
    setName(clean);
    setRoomInUrl(nextCode);
    setCode(nextCode);
  }
  function checkName() {
    if (sanitizeName(name)) return true;
    setFormError('Choose a name so other players know who you are.');
    return false;
  }
  async function create() {
    setFormError('');
    if (!checkName()) return;
    setCreating(true);
    try {
      enter(await requestNewRoom());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create a room.');
    } finally {
      setCreating(false);
    }
  }
  function join(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    if (!checkName()) return;
    const clean = normalizeRoomCode(joinCode);
    if (!isRoomCode(clean)) {
      setFormError(`Room codes are ${ROOM_CODE_LENGTH} letters and numbers, like K7QM2X.`);
      return;
    }
    enter(clean);
  }
  function exit() {
    setRoomInUrl(null);
    setJoinCode('');
    setCode(null);
  }

  if (!code)
    return (
      <EntryScreen
        name={name}
        onName={setName}
        joinCode={joinCode}
        onJoinCode={(value) => setJoinCode(normalizeRoomCode(value))}
        onCreate={create}
        onJoin={join}
        creating={creating}
        error={formError}
      />
    );
  return (
    <RoomScreen
      state={state}
      send={send}
      onLeave={() => {
        leave();
        exit();
      }}
      onBack={exit}
    />
  );
}

function EntryScreen(props: {
  name: string;
  onName: (value: string) => void;
  joinCode: string;
  onJoinCode: (value: string) => void;
  onCreate: () => void;
  onJoin: (event: FormEvent) => void;
  creating: boolean;
  error: string;
}) {
  const id = useId();
  return (
    <section className="panel mp-entry" aria-labelledby={`${id}-title`}>
      <span className="eyebrow">PLAY WITH FRIENDS</span>
      <h2 id={`${id}-title`}>Race the clock together.</h2>
      <p className="mp-muted">
        Create a room, share its code, and see who gets the most answers right before time runs out.
      </p>
      <label className="mp-field">
        <span>Your name</span>
        <input
          value={props.name}
          onChange={(event) => props.onName(event.target.value)}
          maxLength={MAX_NAME_LENGTH * 2}
          autoComplete="nickname"
          placeholder="e.g. Ada"
        />
      </label>
      <div className="mp-entry-actions">
        <button className="primary-button" onClick={props.onCreate} disabled={props.creating}>
          <Plus size={16} />
          {props.creating ? 'Creating room…' : 'Create a room'}
        </button>
        <span className="mp-or" aria-hidden="true">or</span>
        <form className="mp-join" onSubmit={props.onJoin}>
          <label className="sr-only" htmlFor={`${id}-code`}>Room code</label>
          <input
            id={`${id}-code`}
            value={props.joinCode}
            onChange={(event) => props.onJoinCode(event.target.value)}
            placeholder="ROOM CODE"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
          />
          <button className="secondary-button" type="submit">
            Join <ArrowRight size={15} />
          </button>
        </form>
      </div>
      {props.error && (
        <p className="mp-error" role="alert">
          <X size={14} /> {props.error}
        </p>
      )}
    </section>
  );
}

const VISIBLE_ERRORS = new Set(['not-leader', 'empty-pool', 'invalid-name', 'room-full', 'unknown-player']);

function RoomScreen({
  state,
  send,
  onLeave,
  onBack,
}: {
  state: RoomClientState;
  send: Send;
  onLeave: () => void;
  onBack: () => void;
}) {
  const { room, playerId, status, error } = state;
  const [shownError, setShownError] = useState<string | null>(null);
  useEffect(() => {
    if (!error || !VISIBLE_ERRORS.has(error.code)) return;
    setShownError(error.message);
    const timer = window.setTimeout(() => setShownError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  if (status === 'closed')
    return (
      <section className="panel mp-entry" role="alert">
        <WifiOff size={30} className="mp-icon" />
        <h2>You’re out of the room.</h2>
        <p className="mp-muted">{state.closedReason}</p>
        <button className="primary-button" onClick={onBack}>
          Back to multiplayer
        </button>
      </section>
    );
  if (!room || !playerId)
    return (
      <section className="panel mp-entry" role="status">
        <p>{shownError ?? 'Connecting to the room…'}</p>
        <button className="secondary-button" onClick={onBack}>Cancel</button>
      </section>
    );

  const me = room.players.find((player) => player.id === playerId);
  const isLeader = room.leaderId === playerId;
  const playing = room.phase === 'playing';
  return (
    <div className="mp-room">
      <RoomHeader code={room.code} onLeave={onLeave} />
      {status === 'reconnecting' && (
        <p className="mp-banner" role="status">Connection lost. Reconnecting…</p>
      )}
      {shownError && (
        <p className="mp-banner mp-banner--error" role="alert">{shownError}</p>
      )}
      <div className="mp-layout">
        <div className="mp-main">
          {playing && me?.inMatch ? (
            <MatchPanel state={state} room={room} send={send} />
          ) : playing ? (
            <SpectatorPanel room={room} offset={state.clockOffset} />
          ) : (
            <>
              {room.results && <ResultsPanel results={room.results} playerId={playerId} />}
              <SettingsCard room={room} isLeader={isLeader} send={send} />
            </>
          )}
        </div>
        <PlayersPanel room={room} playerId={playerId} isLeader={isLeader} send={send} />
      </div>
    </div>
  );
}

function RoomHeader({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  }
  return (
    <section className="panel mp-room-header" aria-label="Room">
      <div>
        <span className="eyebrow">ROOM CODE</span>
        <strong className="mp-code" aria-label={`Room code ${code.split('').join(' ')}`}>{code}</strong>
      </div>
      <div className="mp-room-actions">
        <button className="secondary-button" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Link copied' : 'Copy invite link'}
        </button>
        <button className="secondary-button" onClick={onLeave}>
          <LogOut size={15} /> Leave
        </button>
      </div>
    </section>
  );
}

function SettingsCard({ room, isLeader, send }: { room: RoomSnapshot; isLeader: boolean; send: Send }) {
  const id = useId();
  const settings = room.settings;
  const count = poolSize(settings);
  const leader = room.players.find((player) => player.id === room.leaderId);
  const update = (patch: Partial<RoomSettings>) =>
    send({ type: 'settings', settings: { ...settings, ...patch } });
  const toggle = <T extends string>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((value) => value !== item) : [...list, item];

  return (
    <section className="panel mp-settings" aria-labelledby={`${id}-title`}>
      <div className="panel-title">
        <Settings2 size={17} />
        <h2 id={`${id}-title`}>Match settings</h2>
        {!isLeader && leader && <span className="mp-muted mp-set-by">Chosen by {leader.name}</span>}
      </div>
      <fieldset disabled={!isLeader}>
        <legend className="sr-only">Match settings</legend>
        <div className="mp-setting">
          <span className="eyebrow" id={`${id}-game`}>GAME</span>
          <div className="mode-switch" role="group" aria-labelledby={`${id}-game`}>
            {ACTIVITIES.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity];
              return (
                <button
                  type="button"
                  key={activity}
                  aria-pressed={settings.activity === activity}
                  className={settings.activity === activity ? 'selected' : ''}
                  onClick={() => update({ activity })}
                >
                  <Icon size={14} /> {ACTIVITY_NAMES[activity]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mp-setting">
          <span className="eyebrow" id={`${id}-time`}>TIME LIMIT</span>
          <div className="mode-switch" role="group" aria-labelledby={`${id}-time`}>
            {DURATIONS.map((duration) => (
              <button
                type="button"
                key={duration}
                aria-pressed={settings.duration === duration}
                className={settings.duration === duration ? 'selected' : ''}
                onClick={() => update({ duration })}
              >
                {formatDuration(duration)}
              </button>
            ))}
          </div>
        </div>
        <div className="mp-setting">
          <div className="section-label">
            <span className="eyebrow" id={`${id}-continents`}>CONTINENTS</span>
            {isLeader && (
              <span className="selection-actions">
                <button type="button" onClick={() => update({ continents: [...CONTINENTS] })}>All</button>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => update({ continents: [] })}>None</button>
              </span>
            )}
          </div>
          <div className="mp-chips" role="group" aria-labelledby={`${id}-continents`}>
            {CONTINENTS.map((continent) => (
              <button
                type="button"
                key={continent}
                className={`mp-chip ${settings.continents.includes(continent) ? 'is-selected' : ''}`}
                aria-pressed={settings.continents.includes(continent)}
                onClick={() => update({ continents: toggle<Continent>(settings.continents, continent) })}
              >
                {continent}
              </button>
            ))}
          </div>
        </div>
        <div className="mp-setting">
          <div className="section-label">
            <span className="eyebrow" id={`${id}-letters`}>STARTING LETTERS</span>
            {isLeader && (
              <span className="selection-actions">
                <button type="button" onClick={() => update({ letters: [...LETTERS] })}>All</button>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => update({ letters: [] })}>None</button>
              </span>
            )}
          </div>
          <div className="letter-grid mp-letters" role="group" aria-labelledby={`${id}-letters`}>
            {LETTERS.map((letter) => (
              <button
                type="button"
                key={letter}
                className={`letter-option ${settings.letters.includes(letter) ? 'is-selected' : ''}`}
                aria-pressed={settings.letters.includes(letter)}
                aria-label={`Countries starting with ${letter}`}
                onClick={() => update({ letters: toggle<Letter>(settings.letters, letter) })}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      </fieldset>
      <div className="mp-start">
        <p className={count ? 'mp-muted' : 'mp-error'} aria-live="polite">
          <strong>{count}</strong> {count === 1 ? 'country' : 'countries'} in the pool
          {!count && ' — choose at least one continent and letter.'}
        </p>
        {isLeader ? (
          <button className="primary-button" disabled={!count} onClick={() => send({ type: 'start' })}>
            Start {formatDuration(settings.duration)} match <ArrowRight size={16} />
          </button>
        ) : (
          <p className="mp-muted" role="status">
            Waiting for {leader?.name ?? 'the leader'} to start the match…
          </p>
        )}
      </div>
    </section>
  );
}

function PlayersPanel({
  room,
  playerId,
  isLeader,
  send,
}: {
  room: RoomSnapshot;
  playerId: string;
  isLeader: boolean;
  send: Send;
}) {
  const live = room.phase === 'playing';
  const players = live
    ? room.players
        .filter((player) => player.inMatch)
        .sort((a, b) => b.score - a.score)
        .concat(room.players.filter((player) => !player.inMatch))
    : room.players;
  return (
    <aside className="panel mp-players" aria-label={live ? 'Live scores' : 'Players'}>
      <div className="panel-title">
        {live ? <Trophy size={17} /> : <Users size={17} />}
        <h2>{live ? 'Live scores' : 'Players'}</h2>
        <span className="mp-muted mp-count">{room.players.length}/{MAX_PLAYERS}</span>
      </div>
      <ol>
        {players.map((player) => (
          <li key={player.id} className={player.connected ? '' : 'is-offline'}>
            <span className="mp-player-name">
              {room.leaderId === player.id && (
                <Crown size={14} className="mp-crown" aria-label="Room leader" />
              )}
              <span>{player.name}</span>
              {player.id === playerId && <span className="mp-tag">You</span>}
              {!player.connected && <span className="mp-tag">Offline</span>}
              {live && !player.inMatch && <span className="mp-tag">Next match</span>}
            </span>
            {live && player.inMatch ? (
              <strong className="mp-player-score" aria-label={`${player.score} correct`}>{player.score}</strong>
            ) : (
              isLeader &&
              !live &&
              player.id !== playerId &&
              player.connected && (
                <button
                  className="mp-link-button"
                  onClick={() => send({ type: 'transfer', playerId: player.id })}
                >
                  Make leader
                </button>
              )
            )}
          </li>
        ))}
      </ol>
      {isLeader && !live && room.players.length === 1 && (
        <p className="mp-muted mp-hint">Share the room code or invite link so friends can join.</p>
      )}
    </aside>
  );
}

function ResultsPanel({ results, playerId }: { results: Standing[]; playerId: string }) {
  const winners = results.filter((standing) => standing.rank === 1);
  const mine = results.find((standing) => standing.id === playerId);
  return (
    <section className="panel mp-results" aria-label="Match results">
      <div className="panel-title">
        <Trophy size={17} />
        <h2>Match results</h2>
      </div>
      <p className="mp-headline">
        {!results.length
          ? 'Nobody finished that match.'
          : winners.length > 1
            ? `It’s a tie between ${winners.map((winner) => winner.name).join(' and ')}!`
            : `${winners[0].name} wins with ${winners[0].score} correct!`}
        {mine && results.length > 1 && <span> You placed #{mine.rank}.</span>}
      </p>
      <ol className="mp-standings">
        {results.map((standing) => (
          <li key={standing.id} className={standing.id === playerId ? 'is-me' : ''}>
            <span className={`mp-rank rank-${standing.rank}`}>{standing.rank}</span>
            <span className="mp-player-name">{standing.name}</span>
            <span className="mp-stat"><strong>{standing.score}</strong> correct</span>
            <span className="mp-stat mp-muted">{standing.wrong} wrong · {standing.skipped} skipped</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SpectatorPanel({ room, offset }: { room: RoomSnapshot; offset: number }) {
  const now = useServerNow(offset, true);
  return (
    <section className="panel mp-entry" role="status">
      <Clock size={28} className="mp-icon" />
      <h2>A match is in progress.</h2>
      <p className="mp-muted">
        {ACTIVITY_NAMES[room.settings.activity]} · {formatClock(room.endsAt - now)} left. You’ll be
        in the next match.
      </p>
    </section>
  );
}

function MatchPanel({ state, room, send }: { state: RoomClientState; room: RoomSnapshot; send: Send }) {
  const now = useServerNow(state.clockOffset, true);
  const { question, feedback, error } = state;
  const activity = room.settings.activity;
  const Icon = ACTIVITY_ICONS[activity];
  const me = room.players.find((player) => player.id === state.playerId);
  const country = question ? countryById.get(question.countryId) : undefined;
  const countdown = room.startsAt - now;
  const remaining = room.endsAt - now;
  const total = room.endsAt - room.startsAt;
  const tooFast = error?.code === 'too-fast' && error.seq > (feedback?.seq ?? 0);

  // Countries this player located this round, for the map's green fill.
  const [located, setLocated] = useState<string[]>([]);
  useEffect(() => setLocated([]), [room.round]);
  useEffect(() => {
    if (feedback?.outcome === 'correct' && activity === 'placement')
      setLocated((current) => [...current, feedback.countryId]);
  }, [feedback, activity]);

  if (countdown > 0)
    return (
      <section className="panel mp-match mp-countdown" aria-label="Match starting">
        <span className="eyebrow">GET READY</span>
        <strong aria-live="assertive">{Math.ceil(countdown / 1000)}</strong>
        <p className="mp-muted">
          {ACTIVITY_NAMES[activity]} · {formatDuration(room.settings.duration)}
        </p>
      </section>
    );

  const previous =
    feedback && feedback.outcome !== 'incorrect' && feedback.countryId !== country?.id
      ? feedback
      : null;
  return (
    <section className="panel mp-match" aria-label={ACTIVITY_NAMES[activity]}>
      <div className="mp-match-top">
        <span className="eyebrow"><Icon size={13} /> {ACTIVITY_NAMES[activity].toUpperCase()}</span>
        <span className="mp-score">Score <strong>{me?.score ?? 0}</strong></span>
        <span className={`mp-timer ${remaining < 10_000 ? 'is-low' : ''}`} role="timer" aria-label="Time left">
          <Clock size={14} /> {formatClock(remaining)}
        </span>
      </div>
      <div className="progress-track mp-time-track" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, (remaining / total) * 100))}%` }} />
      </div>
      {remaining <= 0 || !question || !country ? (
        <div className="mp-waiting" role="status">
          {remaining <= 0 ? 'Time’s up! Tallying the scores…' : 'Loading your question…'}
        </div>
      ) : (
        <Prompt
          key={`${question.round}-${question.number}`}
          activity={activity}
          question={question}
          feedback={feedback}
          previous={previous}
          tooFast={tooFast}
          located={located}
          send={send}
        />
      )}
    </section>
  );
}

function feedbackText(feedback: Feedback, activity: MultiplayerActivity) {
  const country = countryById.get(feedback.countryId);
  const answer =
    activity === 'capital'
      ? capitalsByCountry[feedback.countryId]?.name
      : country?.name;
  return feedback.outcome === 'correct'
    ? `Correct! ${answer}.`
    : `Skipped. It was ${answer}.`;
}

function Prompt({
  activity,
  question,
  feedback,
  previous,
  tooFast,
  located,
  send,
}: {
  activity: MultiplayerActivity;
  question: Question;
  feedback: Feedback | null;
  previous: Feedback | null;
  tooFast: boolean;
  located: string[];
  send: Send;
}) {
  const country = countryById.get(question.countryId)!;
  const [value, setValue] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrong =
    feedback?.outcome === 'incorrect' && feedback.countryId === country.id ? feedback : null;

  useEffect(() => inputRef.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (activity !== 'placement' || !wrong?.value) return;
    setFlashId(wrong.value);
    const timer = window.setTimeout(() => setFlashId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [wrong, activity]);

  const answer = (text: string) =>
    send({ type: 'answer', round: question.round, countryId: country.id, value: text });
  const skip = () => send({ type: 'skip', round: question.round, countryId: country.id });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim()) answer(value);
  }

  const status = tooFast
    ? { tone: 'incorrect', text: 'Slow down a little.' }
    : wrong
      ? {
          tone: 'incorrect',
          text:
            activity === 'placement'
              ? `That’s ${countryById.get(wrong.value ?? '')?.name ?? 'not it'}. Try again.`
              : 'Not quite. Try again or skip.',
        }
      : previous
        ? { tone: previous.outcome, text: feedbackText(previous, activity) }
        : null;
  const statusLine = (
    <p className={`mp-feedback ${status?.tone ?? ''}`} role="status" aria-live="polite">
      {status?.tone === 'correct' && <Check size={14} />}
      {status?.tone === 'incorrect' && <X size={14} />}
      {status?.tone === 'skipped' && <SkipForward size={14} />}
      {status?.text ?? ' '}
    </p>
  );
  const skipButton = (
    <button type="button" className="secondary-button mp-skip" onClick={skip}>
      <SkipForward size={15} /> Skip
    </button>
  );

  if (activity === 'placement')
    return (
      <div className="mp-prompt mp-prompt--map">
        <h2>Locate: <span>{country.name}</span></h2>
        {statusLine}
        <Suspense fallback={<div className="map-loading" role="status">Loading the world map…</div>}>
          <CountryMap completedIds={located} incorrectId={flashId} onSelect={answer} />
        </Suspense>
        <div className="mp-prompt-actions">{skipButton}</div>
      </div>
    );

  return (
    <div className="mp-prompt">
      {activity === 'flag' ? (
        <div className="mp-flag">
          <FlagImage country={country} revealed={false} />
        </div>
      ) : (
        <div className="mp-capital">
          <span className="eyebrow">NAME THE CAPITAL OF</span>
          <h2>{country.name}</h2>
        </div>
      )}
      <form onSubmit={submit} className="mp-answer">
        <label className="sr-only" htmlFor="mp-answer">
          {activity === 'capital' ? `Capital of ${country.name}` : 'Country name'}
        </label>
        <div className={`answer-input-wrap ${wrong ? 'input-incorrect' : ''}`}>
          <MapPin size={18} />
          <input
            id="mp-answer"
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={activity === 'capital' ? 'Capital city…' : 'Country name…'}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-invalid={Boolean(wrong)}
          />
        </div>
        {statusLine}
        <div className="mp-prompt-actions">
          {skipButton}
          <button className="primary-button" type="submit">
            Check <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
