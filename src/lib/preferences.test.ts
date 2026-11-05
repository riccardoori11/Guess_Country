import { describe, expect, it } from 'vitest';
import { CONTINENTS } from '../data/countries';
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
  it('round-trips mode and multiple selected continents', () => {
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
    };
    savePreferences(expected, storage);
    expect(values.has(PREFERENCES_KEY)).toBe(true);
    expect(loadPreferences(storage)).toEqual(expected);
  });
  it('preserves an intentionally empty continent selection', () => {
    expect(
      loadPreferences({ getItem: () => '{"mode":"random","continents":[]}' })
        .continents,
    ).toEqual([]);
  });
  it('sanitizes invalid values and removes duplicate continents', () => {
    expect(
      loadPreferences({
        getItem: () =>
          '{"mode":"invalid","continents":["Africa","Africa","Atlantis"]}',
      }),
    ).toEqual({ mode: 'random', continents: ['Africa'] });
    expect(
      loadPreferences({ getItem: () => '{"mode":"linear"}' }).continents,
    ).toEqual(CONTINENTS);
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
