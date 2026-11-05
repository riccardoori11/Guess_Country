import { describe, expect, it } from 'vitest';
import { CONTINENTS } from '../data/countries';
import { LETTERS } from './filters';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  PREFERENCES_KEY,
  savePreferences,
} from './preferences';

describe('preference persistence', () => {
  it('loads default preferences for a new browser', () => {
    expect(loadPreferences({ getItem: () => null })).toEqual(
      DEFAULT_PREFERENCES,
    );
  });
  it('round-trips mode, multiple continents, and nonconsecutive letters', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const expected = {
      mode: 'linear' as const,
      continents: ['Africa' as const, 'Europe' as const],
      letters: ['A' as const, 'J' as const, 'Z' as const],
    };
    savePreferences(expected, storage);
    expect(values.has(PREFERENCES_KEY)).toBe(true);
    expect(loadPreferences(storage)).toEqual(expected);
  });
  it('preserves an intentionally empty continent selection', () => {
    expect(
      loadPreferences({
        getItem: () => '{"mode":"random","continents":[]}',
      }).continents,
    ).toEqual([]);
  });
  it('sanitizes invalid values and removes duplicate continents', () => {
    expect(
      loadPreferences({
        getItem: () =>
          '{"mode":"invalid","continents":["Africa","Africa","Atlantis"]}',
      }),
    ).toEqual({
      mode: 'random',
      continents: ['Africa'],
      letters: [...LETTERS],
    });
    expect(
      loadPreferences({ getItem: () => '{"mode":"linear"}' }).continents,
    ).toEqual(CONTINENTS);
  });
  it('migrates old preferences to all letters while preserving the mode and continents', () => {
    expect(
      loadPreferences({
        getItem: () => '{"mode":"linear","continents":["Asia"]}',
      }),
    ).toEqual({
      mode: 'linear',
      continents: ['Asia'],
      letters: [...LETTERS],
    });
  });
  it('preserves an intentionally empty letter selection', () => {
    expect(
      loadPreferences({
        getItem: () =>
          '{"mode":"random","continents":["Europe"],"letters":[]}',
      }),
    ).toEqual({
      mode: 'random',
      continents: ['Europe'],
      letters: [],
    });
  });
  it('sanitizes unknown, malformed, and duplicate letters in alphabet order', () => {
    expect(
      loadPreferences({
        getItem: () => '{"letters":["Z","A","A","a","AA",3,null]}',
      }).letters,
    ).toEqual(['A', 'Z']);
    expect(
      loadPreferences({ getItem: () => '{"letters":"J"}' }).letters,
    ).toEqual(LETTERS);
    expect(
      loadPreferences({ getItem: () => '{"letters":["invalid"]}' })
        .letters,
    ).toEqual([]);
  });
  it('handles corrupted local storage and inaccessible storage', () => {
    expect(loadPreferences({ getItem: () => 'invalid' })).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(
      loadPreferences({
        getItem: () => {
          throw new Error('Denied');
        },
      }),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(() =>
      savePreferences(DEFAULT_PREFERENCES, {
        setItem: () => {
          throw new Error('Quota');
        },
      }),
    ).not.toThrow();
  });
});
