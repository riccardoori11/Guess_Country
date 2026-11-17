// Shared by the browser and the Cloudflare Worker. Everything here must stay
// free of DOM and Worker-only APIs. Every inbound value is validated by the
// parse* helpers before the room logic sees it.
import { CONTINENTS, type Continent } from '../data/countries';
import { LETTERS, eligibleCountries, type Letter } from '../lib/filters';

export const ACTIVITIES = ['flag', 'placement', 'capital'] as const;
export type MultiplayerActivity = (typeof ACTIVITIES)[number];
export const ACTIVITY_NAMES: Record<MultiplayerActivity, string> = {
  flag: 'Guess the Flag',
  placement: 'Place the Country',
  capital: 'Guess the Capital',
};

/** Match lengths in seconds the room leader can choose from. */
export const DURATIONS = [30, 60, 120, 180, 300] as const;
export type Duration = (typeof DURATIONS)[number];

export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 20;
export const MAX_ANSWER_LENGTH = 100;
export const MAX_MESSAGE_LENGTH = 2048;
/** "Get ready" period between the leader pressing start and the first question. */
export const COUNTDOWN_MS = 3000;
/** Answers closer together than this are rejected (limits scripted guessing). */
export const MIN_ANSWER_INTERVAL_MS = 200;
/** Rooms with no activity for this long are deleted. */
export const ROOM_IDLE_MS = 60 * 60 * 1000;

// No 0/O or 1/I so codes can be read aloud and typed without confusion.
// 32 symbols divide 256 evenly, so random bytes map without bias.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`,
);

/** WebSocket close codes the client acts on (4000–4999 are application codes). */
export const CLOSE_CODES = {
  replaced: 4000,
  left: 4001,
  notFound: 4004,
  full: 4005,
  expired: 4010,
} as const;

export interface RoomSettings {
  activity: MultiplayerActivity;
  duration: Duration;
  continents: Continent[];
  letters: Letter[];
}

export const DEFAULT_SETTINGS: RoomSettings = {
  activity: 'flag',
  duration: 60,
  continents: [...CONTINENTS],
  letters: [...LETTERS],
};

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  /** False for people who joined while a match was already running. */
  inMatch: boolean;
  score: number;
}

export interface Standing {
  id: string;
  name: string;
  rank: number;
  score: number;
  wrong: number;
  skipped: number;
}

export interface RoomSnapshot {
  code: string;
  phase: 'lobby' | 'playing';
  leaderId: string | null;
  settings: RoomSettings;
  round: number;
  startsAt: number;
  endsAt: number;
  /** Server clock when this snapshot was sent, for client clock offset. */
  serverNow: number;
  players: PublicPlayer[];
  /** Standings from the most recent finished match, if any. */
  results: Standing[] | null;
}

export interface Question {
  round: number;
  /** 1-based question number for this player in this round. */
  number: number;
  countryId: string;
}

export type ErrorCode =
  | 'invalid-message'
  | 'not-joined'
  | 'not-leader'
  | 'invalid-name'
  | 'room-full'
  | 'empty-pool'
  | 'wrong-phase'
  | 'unknown-player'
  | 'too-fast'
  | 'not-found';

export type ClientMessage =
  | { type: 'join'; name: string; token?: string }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'start' }
  | { type: 'transfer'; playerId: string }
  | { type: 'answer'; round: number; countryId: string; value: string }
  | { type: 'skip'; round: number; countryId: string }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'welcome'; playerId: string; token: string }
  | { type: 'state'; room: RoomSnapshot }
  | { type: 'question'; question: Question | null }
  | {
      type: 'feedback';
      round: number;
      countryId: string;
      outcome: 'correct' | 'incorrect' | 'skipped';
      value?: string;
    }
  | { type: 'error'; code: ErrorCode; message: string };

export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function isRoomCode(value: unknown): value is string {
  return typeof value === 'string' && ROOM_CODE_PATTERN.test(value);
}

/** Trims, strips control/format characters, and caps length by code point. */
export function sanitizeName(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  const cleaned = value
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const name = [...cleaned].slice(0, MAX_NAME_LENGTH).join('').trim();
  return name || null;
}

export function poolSize(settings: Pick<RoomSettings, 'continents' | 'letters'>): number {
  return eligibleCountries(settings.continents, settings.letters).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueSubset<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] | null {
  if (!Array.isArray(value) || value.length > allowed.length) return null;
  if (!value.every((item) => (allowed as readonly unknown[]).includes(item)))
    return null;
  // Keep canonical order so settings compare and display consistently.
  return allowed.filter((item) => value.includes(item));
}

export function parseSettings(value: unknown): RoomSettings | null {
  if (!isRecord(value)) return null;
  const { activity, duration } = value;
  if (!(ACTIVITIES as readonly unknown[]).includes(activity)) return null;
  if (!(DURATIONS as readonly unknown[]).includes(duration)) return null;
  const continents = uniqueSubset(value.continents, CONTINENTS);
  const letters = uniqueSubset(value.letters, LETTERS);
  if (!continents || !letters) return null;
  return {
    activity: activity as MultiplayerActivity,
    duration: duration as Duration,
    continents,
    letters,
  };
}

const isShortString = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;
const isRound = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_LENGTH) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'join':
      if (!isShortString(value.name, 200)) return null;
      if (value.token !== undefined && !isShortString(value.token, 64)) return null;
      return value.token === undefined
        ? { type: 'join', name: value.name }
        : { type: 'join', name: value.name, token: value.token };
    case 'settings': {
      const settings = parseSettings(value.settings);
      return settings && { type: 'settings', settings };
    }
    case 'start':
    case 'leave':
      return { type: value.type };
    case 'transfer':
      return isShortString(value.playerId, 64)
        ? { type: 'transfer', playerId: value.playerId }
        : null;
    case 'answer':
      return isRound(value.round) &&
        isShortString(value.countryId, 8) &&
        isShortString(value.value, MAX_ANSWER_LENGTH)
        ? {
            type: 'answer',
            round: value.round,
            countryId: value.countryId,
            value: value.value,
          }
        : null;
    case 'skip':
      return isRound(value.round) && isShortString(value.countryId, 8)
        ? { type: 'skip', round: value.round, countryId: value.countryId }
        : null;
    default:
      return null;
  }
}
