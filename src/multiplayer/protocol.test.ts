import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MAX_MESSAGE_LENGTH,
  isRoomCode,
  normalizeRoomCode,
  parseClientMessage,
  parseSettings,
  sanitizeName,
} from './protocol';

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));

describe('room codes', () => {
  it('normalizes typed codes and rejects ambiguous characters', () => {
    expect(normalizeRoomCode(' ab-cd ef9 ')).toBe('ABCDEF');
    expect(isRoomCode('ABCDEF')).toBe(true);
    expect(isRoomCode('ABCDE0')).toBe(false);
    expect(isRoomCode('ABCDEI')).toBe(false);
    expect(isRoomCode('ABCDE')).toBe(false);
  });
});

describe('sanitizeName', () => {
  it('trims, collapses whitespace, strips control characters, and caps length', () => {
    expect(sanitizeName('  Ada \n Lovelace ')).toBe('Ada Lovelace');
    expect(sanitizeName('A​da\u0007')).toBe('Ada');
    expect(sanitizeName('🌍'.repeat(30))).toBe('🌍'.repeat(20));
    expect(sanitizeName('   ')).toBeNull();
    expect(sanitizeName(42)).toBeNull();
  });
});

describe('parseSettings', () => {
  it('accepts valid settings in canonical order', () => {
    expect(parseSettings({ ...DEFAULT_SETTINGS, letters: ['B', 'A'] })?.letters).toEqual(['A', 'B']);
  });

  it('rejects unknown modes, durations, continents, letters, and duplicates', () => {
    expect(parseSettings({ ...DEFAULT_SETTINGS, activity: 'chess' })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, duration: 45 })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, continents: ['Atlantis'] })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, letters: ['a'] })).toBeNull();
    expect(parseSettings({ ...DEFAULT_SETTINGS, letters: Array(27).fill('A') })).toBeNull();
  });
});

describe('parseClientMessage', () => {
  it('accepts each known message', () => {
    expect(parse({ type: 'join', name: 'Ada' })).toEqual({ type: 'join', name: 'Ada' });
    expect(parse({ type: 'start', extra: true })).toEqual({ type: 'start' });
    expect(parse({ type: 'answer', round: 1, countryId: 'fr', value: 'France' })).toEqual({
      type: 'answer',
      round: 1,
      countryId: 'fr',
      value: 'France',
    });
    expect(parse({ type: 'settings', settings: DEFAULT_SETTINGS })).toEqual({
      type: 'settings',
      settings: DEFAULT_SETTINGS,
    });
  });

  it('rejects malformed, oversized, and unknown messages', () => {
    expect(parseClientMessage('{nope')).toBeNull();
    expect(parseClientMessage('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
    expect(parseClientMessage(new ArrayBuffer(4))).toBeNull();
    expect(parse(['join'])).toBeNull();
    expect(parse({ type: 'score', value: 999 })).toBeNull();
    expect(parse({ type: 'answer', round: -1, countryId: 'fr', value: 'x' })).toBeNull();
    expect(parse({ type: 'answer', round: 1, countryId: 'fr', value: 'x'.repeat(101) })).toBeNull();
    expect(parse({ type: 'join', name: 'Ada', token: 5 })).toBeNull();
  });
});
