import { describe, expect, it } from 'vitest';
import { CONTINENTS, countries, type Continent } from '../data/countries';
import {
  LETTERS,
  eligibleCountries,
  emptySelectionMessage,
  startingLetter,
  type Letter,
} from './filters';
import {
  createSequence,
  gameReducer,
  initialGame,
  isCorrectAnswer,
} from './game';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('canonical starting-letter filters', () => {
  it('offers every English letter once and includes the full dataset by default', () => {
    expect(LETTERS.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(eligibleCountries(CONTINENTS, LETTERS)).toEqual(countries);
    for (const country of countries)
      expect(LETTERS).toContain(startingLetter(country));
    expect(startingLetter({ name: '  Éxample' })).toBe('E');
  });

  it.each<{ continents: Continent[]; letters: Letter[]; names: string[] }>(
    [
      {
        continents: ['Europe'],
        letters: ['A'],
        names: ['Albania', 'Andorra', 'Austria'],
      },
      { continents: ['Asia'], letters: ['J'], names: ['Japan', 'Jordan'] },
      {
        continents: ['South America'],
        letters: ['B'],
        names: ['Bolivia', 'Brazil'],
      },
      {
        continents: ['Africa'],
        letters: ['M', 'N'],
        names: [
          'Madagascar',
          'Malawi',
          'Mali',
          'Mauritania',
          'Mauritius',
          'Morocco',
          'Mozambique',
          'Namibia',
          'Niger',
          'Nigeria',
        ],
      },
      {
        continents: [...CONTINENTS],
        letters: ['J'],
        names: ['Jamaica', 'Japan', 'Jordan'],
      },
    ],
  )(
    'intersects $continents with $letters',
    ({ continents, letters, names }) => {
      expect(
        eligibleCountries(continents, letters).map(
          (country) => country.name,
        ),
      ).toEqual(names);
    },
  );

  it('combines multiple continents and nonconsecutive letters without duplicates', () => {
    const pool = eligibleCountries(['Asia', 'Europe'], ['A', 'J', 'Z']);
    expect(pool.map((country) => country.id).sort()).toEqual(
      ['ad', 'af', 'al', 'am', 'at', 'az', 'jp', 'jo'].sort(),
    );
    expect(new Set(pool.map((country) => country.id)).size).toBe(
      pool.length,
    );
    expect(eligibleCountries(['Asia', 'Asia'], ['J', 'J'])).toHaveLength(
      2,
    );
  });

  it('uses canonical names while keeping aliases valid as answers', () => {
    for (const [id, letter, aliasLetter, alias] of [
      ['ci', 'C', 'I', 'Ivory Coast'],
      ['mm', 'M', 'B', 'Burma'],
      ['sz', 'E', 'S', 'Swaziland'],
      ['va', 'V', 'H', 'Holy See'],
      ['gb', 'U', 'G', 'Great Britain'],
      ['tl', 'T', 'E', 'East Timor'],
    ] as const) {
      const country = countries.find((value) => value.id === id)!;
      expect(eligibleCountries(CONTINENTS, [letter])).toContainEqual(
        country,
      );
      expect(
        eligibleCountries(CONTINENTS, [aliasLetter]),
      ).not.toContainEqual(country);
      expect(isCorrectAnswer(country, alias)).toBe(true);
    }
  });

  it('returns an empty pool for empty filters or selections with no matches', () => {
    expect(eligibleCountries(CONTINENTS, [])).toEqual([]);
    expect(eligibleCountries([], LETTERS)).toEqual([]);
    expect(eligibleCountries([], [])).toEqual([]);
    expect(eligibleCountries(['Europe'], ['J'])).toEqual([]);
    expect(eligibleCountries(CONTINENTS, ['X'])).toEqual([]);
  });

  it('explains empty continents, empty letters, both empty, and zero matches distinctly', () => {
    expect(emptySelectionMessage([], [], 0)).toContain(
      'one continent and one letter',
    );
    expect(emptySelectionMessage([], LETTERS, 0)).toBe(
      'Choose at least one continent to start a round.',
    );
    expect(emptySelectionMessage(CONTINENTS, [], 0)).toBe(
      'Choose at least one letter to start a round.',
    );
    expect(emptySelectionMessage(['Europe'], ['J'], 0)).toContain(
      'No countries match',
    );
    expect(emptySelectionMessage(['Asia'], ['J'], 2)).toBeUndefined();
  });
});

describe('filtered gameplay modes', () => {
  it('keeps Linear mode alphabetical and independent of filter selection order', () => {
    const a = createSequence({
      mode: 'linear',
      continents: ['Asia', 'Europe'],
      letters: ['M', 'J', 'A'],
    });
    const b = createSequence({
      mode: 'linear',
      continents: ['Europe', 'Asia'],
      letters: ['A', 'M', 'J'],
    });
    expect(a).toEqual(b);
    expect(a[0].name).toBe('Afghanistan');
    const names = a.map((country) => country.name);
    expect(names).toEqual(
      [...names].sort(
        new Intl.Collator('en', { sensitivity: 'base' }).compare,
      ),
    );
    expect(new Set(a.map((country) => country.id)).size).toBe(a.length);
  });

  it('shuffles only the intersection once and produces a new random sequence on restart', () => {
    const filters = {
      continents: ['Africa', 'Europe'] as Continent[],
      letters: ['M', 'N'] as Letter[],
    };
    const a = createSequence({ ...filters, mode: 'random' }, rng(42));
    const b = createSequence({ ...filters, mode: 'random' }, rng(43));
    const pool = eligibleCountries(filters.continents, filters.letters);
    expect(a).toHaveLength(pool.length);
    expect(new Set(a.map((country) => country.id)).size).toBe(pool.length);
    expect(a.map((country) => country.id).sort()).toEqual(
      pool.map((country) => country.id).sort(),
    );
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(createSequence({ ...filters, mode: 'linear' }));
  });

  it.each(['linear', 'random'] as const)(
    'exhausts a filtered %s round exactly once and resets on filter/mode changes',
    (mode) => {
      let game = initialGame(
        createSequence(
          { mode, continents: ['Africa'], letters: ['M', 'N'] },
          rng(19),
        ),
      );
      const ids = game.sequence.map((country) => country.id);
      expect(ids).toHaveLength(10);
      for (const country of game.sequence) {
        game = gameReducer(game, {
          type: 'guess',
          countryId: country.id,
          value: country.name,
        });
        game = gameReducer(game, { type: 'next', countryId: country.id });
      }
      expect(game.status).toBe('complete');
      expect(game.correct).toBe(10);
      expect(game.index).toBe(10);
      expect(game.history.map((result) => result.country.id)).toEqual(ids);
      const next = createSequence({
        mode: mode === 'linear' ? 'random' : 'linear',
        continents: ['Asia'],
        letters: ['J'],
      });
      game = gameReducer(game, { type: 'start', sequence: next });
      expect(game).toEqual(initialGame(next));
      expect(game.sequence.map((country) => country.id).sort()).toEqual([
        'jo',
        'jp',
      ]);
    },
  );

  it.each(['linear', 'random'] as const)(
    'returns no sequence in %s mode for empty selections or no matches',
    (mode) => {
      expect(
        createSequence({ mode, continents: [...CONTINENTS], letters: [] }),
      ).toEqual([]);
      expect(
        createSequence({ mode, continents: [], letters: [...LETTERS] }),
      ).toEqual([]);
      expect(
        createSequence({ mode, continents: ['Europe'], letters: ['J'] }),
      ).toEqual([]);
    },
  );
});
