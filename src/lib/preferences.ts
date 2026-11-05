import { CONTINENTS } from '../data/countries';
import { LETTERS } from './filters';
import type { Preferences } from './game';

export const PREFERENCES_KEY = 'flag-atlas:preferences:v1';
export const DEFAULT_PREFERENCES: Preferences = {
  mode: 'random',
  continents: [...CONTINENTS],
  letters: [...LETTERS],
};

export function loadPreferences(
  storage?: Pick<Storage, 'getItem'>,
): Preferences {
  try {
    const source = storage ?? window.localStorage;
    const value: unknown = JSON.parse(
      source.getItem(PREFERENCES_KEY) ?? 'null',
    );
    if (!value || typeof value !== 'object') return DEFAULT_PREFERENCES;
    const record = value as Record<string, unknown>;
    const savedContinents = record.continents;
    const continents = Array.isArray(savedContinents)
      ? CONTINENTS.filter((continent) =>
          savedContinents.includes(continent),
        )
      : [...CONTINENTS];
    // Existing v1 preferences have no letters: preserve their mode/continents
    // and include every letter. An explicitly saved empty array stays empty.
    const savedLetters = record.letters;
    const letters = Array.isArray(savedLetters)
      ? LETTERS.filter((letter) => savedLetters.includes(letter))
      : [...LETTERS];
    return {
      mode: record.mode === 'linear' ? 'linear' : 'random',
      continents,
      letters,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(
  preferences: Preferences,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(
      PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    /* Private browsing / full storage should never stop a game. */
  }
}
