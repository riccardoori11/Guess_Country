import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { CONTINENTS, countries, continentCounts } from '../data/countries';
import {
  createSequence,
  gameReducer,
  getAccuracy,
  initialGame,
  isCorrectAnswer,
  normalizeAnswer,
  type GameState,
  type Preferences,
} from './game';
import { LETTERS, eligibleCountries } from './filters';

const allLinear: Preferences = {
  mode: 'linear',
  continents: [...CONTINENTS],
  letters: [...LETTERS],
};
const country = (id: string) =>
  countries.find((value) => value.id === id)!;
function guess(state: GameState, value: string): GameState {
  return gameReducer(state, {
    type: 'guess',
    value,
    countryId: state.sequence[state.index].id,
  });
}

// A deterministic PRNG makes shuffle tests reproducible without weakening production randomness.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('country data and local assets', () => {
  it('contains 193 UN members and two observer states, with unique ISO IDs', () => {
    expect(countries).toHaveLength(195);
    expect(new Set(countries.map((c) => c.id)).size).toBe(195);
    expect(country('va').aliases).toContain('Holy See');
    expect(country('ps').name).toBe('Palestine');
    expect(countries.some((c) => ['tw', 'xk'].includes(c.id))).toBe(false);
  });
  it('assigns each country to one consistent continent', () => {
    expect(continentCounts).toEqual({
      Africa: 54,
      Asia: 48,
      Europe: 44,
      'North America': 23,
      'South America': 12,
      Oceania: 14,
    });
    for (const c of countries) expect(CONTINENTS).toContain(c.continent);
    expect(country('ru').continent).toBe('Europe');
    for (const id of ['tr', 'cy', 'am', 'az', 'ge', 'kz', 'id', 'tl'])
      expect(country(id).continent).toBe('Asia');
    expect(country('eg').continent).toBe('Africa');
  });
  it('has a valid local SVG asset for every country', () => {
    for (const c of countries) {
      const path = `public${c.flag}`;
      expect(existsSync(path), c.name).toBe(true);
      const content = readFileSync(path, 'utf8');
      expect(content, c.name).toMatch(/<svg[^>]+viewBox=/);
      expect(content, c.name).not.toMatch(
        /<(script|image)\b|(?:href|src)=["\']https?:\/\//gim,
      );
    }
  });
  it('does not assign a normalized alias to two countries', () => {
    const answers = new Map<string, string>();
    for (const c of countries)
      for (const name of [c.name, ...c.aliases]) {
        const answer = normalizeAnswer(name);
        expect(answers.get(answer) ?? c.id, name).toBe(c.id);
        answers.set(answer, c.id);
      }
  });
});

describe('country sequences', () => {
  it('starts every linear round in the same alphabetical order', () => {
    const a = createSequence(allLinear);
    expect(a).toEqual(createSequence(allLinear));
    expect(a[0].name).toBe('Afghanistan');
    expect(a.at(-1)?.name).toBe('Zimbabwe');
    const collator = new Intl.Collator('en', { sensitivity: 'base' });
    expect(a.map((c) => c.name)).toEqual(
      [...a.map((c) => c.name)].sort(collator.compare),
    );
  });
  it('ignores the order in which continent checkboxes were selected', () => {
    expect(
      createSequence({ ...allLinear, continents: ['Asia', 'Europe'] }),
    ).toEqual(
      createSequence({ ...allLinear, continents: ['Europe', 'Asia'] }),
    );
  });
  it('filters every continent and multiple continents without duplication', () => {
    for (const continent of CONTINENTS) {
      const sequence = eligibleCountries([continent]);
      expect(sequence).toHaveLength(continentCounts[continent]);
      expect(sequence.every((c) => c.continent === continent)).toBe(true);
    }
    const mixed = createSequence(
      {
        ...allLinear,
        mode: 'random',
        continents: ['Oceania', 'South America'],
      },
      rng(7),
    );
    expect(mixed).toHaveLength(26);
    expect(
      mixed.every((c) =>
        ['Oceania', 'South America'].includes(c.continent),
      ),
    ).toBe(true);
  });
  it('returns no countries for an empty selection', () => {
    expect(
      createSequence({ ...allLinear, mode: 'random', continents: [] }),
    ).toEqual([]);
    expect(initialGame([]).status).toBe('complete');
  });
  it('shuffles all countries once and generates different new rounds', () => {
    const a = createSequence({ ...allLinear, mode: 'random' }, rng(42));
    const b = createSequence({ ...allLinear, mode: 'random' }, rng(43));
    expect(a).toHaveLength(195);
    expect(new Set(a.map((c) => c.id)).size).toBe(195);
    expect([...a].map((c) => c.id).sort()).toEqual(
      countries.map((c) => c.id).sort(),
    );
    expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id));
    expect(a).not.toEqual(createSequence(allLinear));
  });
});

describe('strict, friendly answer matching', () => {
  it.each([
    ['us', '  uNiTeD    sTaTeS  '],
    ['us', 'USA'],
    ['us', 'U.S.A.'],
    ['us', 'United States of America'],
    ['gb', 'UK'],
    ['gb', 'Great Britain'],
    ['ae', 'U.A.E.'],
    ['ci', 'cote d’ivoire'],
    ['ci', 'Ivory Coast'],
    ['st', 'Sao Tome and Principe'],
    ['tr', 'Turkey'],
    ['tr', 'TÜRKİYE'],
    ['cz', 'Czech Republic'],
    ['cv', 'Cape Verde'],
    ['sz', 'Swaziland'],
    ['mm', 'Burma'],
    ['tl', 'East Timor'],
    ['vn', 'Viet Nam'],
    ['lc', 'St. Lucia'],
    ['kn', 'St. Kitts & Nevis'],
    ['va', 'Holy See'],
    ['cd', 'DRC'],
  ])('accepts %s as %s', (id, answer) => {
    expect(isCorrectAnswer(country(id), answer)).toBe(true);
  });
  it.each([
    ['us', 'America'],
    ['us', 'United'],
    ['us', 'United St'],
    ['gb', 'England'],
    ['kr', 'Korea'],
    ['kp', 'Korea'],
    ['cg', 'Congo'],
    ['cd', 'Congo'],
    ['gn', 'Equatorial Guinea'],
    ['ne', 'Nigeria'],
    ['dm', 'Dominican Republic'],
    ['fr', ''],
    ['fr', '   '],
    ['au', 'Austria'],
    ['sk', 'Slovenia'],
  ])(
    'rejects ambiguous, partial, or wrong answers %s / %s',
    (id, answer) => {
      expect(isCorrectAnswer(country(id), answer)).toBe(false);
    },
  );
  it('accepts every canonical name and every documented alias', () => {
    for (const c of countries)
      for (const name of [c.name, ...c.aliases])
        expect(isCorrectAnswer(c, name), name).toBe(true);
  });
});

describe('round lifecycle and scoring', () => {
  const sequence = [country('jp'), country('ca'), country('fr')];
  it('tracks correct guesses, incorrect attempts, and accuracy', () => {
    let state = initialGame(sequence);
    expect(getAccuracy(state)).toBe(0);
    state = guess(state, 'Korea');
    expect(state.incorrectAttempts).toBe(1);
    expect(state.feedback).toBe('incorrect');
    state = guess(state, 'Japan');
    expect(state.correct).toBe(1);
    expect(state.status).toBe('correct');
    expect(state.history[0].attempts).toBe(2);
    expect(getAccuracy(state)).toBe(50);
  });
  it('ignores empty and duplicate submissions and actions for stale flags', () => {
    let state = initialGame(sequence);
    state = guess(state, '   ');
    expect(state.feedback).toBe('empty');
    expect(state.incorrectAttempts).toBe(0);
    state = guess(state, 'wrong');
    expect(guess(state, ' WRONG ')).toBe(state);
    const blank = guess(state, '');
    expect(guess(blank, 'wrong').feedback).toBe('incorrect');
    expect(guess(blank, 'wrong').incorrectAttempts).toBe(1);
    state = guess(state, 'Japan');
    expect(guess(state, 'Japan')).toBe(state);
    state = gameReducer(state, { type: 'next', countryId: 'jp' });
    expect(gameReducer(state, { type: 'next', countryId: 'jp' })).toBe(
      state,
    );
    expect(gameReducer(state, { type: 'skip', countryId: 'jp' })).toBe(
      state,
    );
  });
  it('requires resolving the flag before advancing', () => {
    const state = initialGame(sequence);
    expect(gameReducer(state, { type: 'next', countryId: 'jp' })).toBe(
      state,
    );
  });
  it('tracks skipped and revealed countries separately and reaches completion', () => {
    let state = initialGame(sequence);
    state = gameReducer(state, { type: 'skip', countryId: 'jp' });
    state = gameReducer(state, { type: 'next', countryId: 'jp' });
    state = gameReducer(state, { type: 'reveal', countryId: 'ca' });
    state = gameReducer(state, { type: 'next', countryId: 'ca' });
    state = guess(state, 'France');
    state = gameReducer(state, { type: 'next', countryId: 'fr' });
    expect(state.status).toBe('complete');
    expect(state.index).toBe(3);
    expect(state.history).toHaveLength(3);
    expect(state.skipped).toBe(1);
    expect(state.revealed).toBe(1);
    expect(state.correct).toBe(1);
    expect(getAccuracy(state)).toBe(100);
    expect(gameReducer(state, { type: 'next', countryId: 'fr' })).toBe(
      state,
    );
  });
  it('maintains current and best streaks, resetting on wrong guesses and skips', () => {
    let state = initialGame(sequence);
    state = guess(state, 'Japan');
    state = gameReducer(state, { type: 'next', countryId: 'jp' });
    state = guess(state, 'Canada');
    expect(state.streak).toBe(2);
    expect(state.bestStreak).toBe(2);
    state = gameReducer(state, { type: 'next', countryId: 'ca' });
    state = guess(state, 'Germany');
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(2);
    state = guess(state, 'France');
    expect(state.streak).toBe(1);
  });
  it('resets all statistics and history on restart or mode/filter changes', () => {
    let state = guess(initialGame(sequence), 'Japan');
    const next = createSequence({ ...allLinear, continents: ['Oceania'] });
    state = gameReducer(state, { type: 'start', sequence: next });
    expect(state).toEqual(initialGame(next));
    expect(state.sequence[0].name).toBe('Australia');
  });
  it('can exhaust the entire 195-country pool without repeating', () => {
    let state = initialGame(createSequence(allLinear));
    for (const c of state.sequence) {
      state = guess(state, c.name);
      state = gameReducer(state, { type: 'next', countryId: c.id });
    }
    expect(state.status).toBe('complete');
    expect(state.correct).toBe(195);
    expect(state.bestStreak).toBe(195);
    expect(state.history).toHaveLength(195);
  });
});
