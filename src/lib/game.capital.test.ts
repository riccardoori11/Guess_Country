import { describe, expect, it } from 'vitest';
import { countries } from '../data/countries';
import { capitalsByCountry } from '../data/capitals';
import {
  createSequence,
  gameReducer,
  getAccuracy,
  initialGame,
  isCorrectAnswer,
  isCorrectCapitalAnswer,
} from './game';

const finland = countries.find((country) => country.id === 'fi')!;
const france = countries.find((country) => country.id === 'fr')!;

describe('capital answer matching', () => {
  it('accepts every canonical capital and explicitly maintained variation', () => {
    for (const country of countries) {
      const capital = capitalsByCountry[country.id];
      expect(capital, country.id).toBeDefined();
      for (const answer of [capital.name, ...capital.aliases]) {
        expect(isCorrectCapitalAnswer(country, answer), `${country.name}: ${answer}`).toBe(true);
      }
      expect(isCorrectCapitalAnswer(country, '')).toBe(false);
      expect(isCorrectCapitalAnswer(country, 'not a city')).toBe(false);
    }
  });

  it('normalizes case, spacing, accents, and optional city punctuation', () => {
    expect(isCorrectCapitalAnswer(finland, '  HELSINKI  ')).toBe(true);
    const colombia = countries.find((country) => country.id === 'co')!;
    expect(isCorrectCapitalAnswer(colombia, 'Bogotá')).toBe(true);
    expect(isCorrectCapitalAnswer(colombia, 'bogota')).toBe(true);
    const usa = countries.find((country) => country.id === 'us')!;
    expect(isCorrectCapitalAnswer(usa, 'Washington, D.C.')).toBe(true);
    expect(isCorrectCapitalAnswer(usa, 'washington dc')).toBe(true);
  });

  it('rejects other capitals, country answers, partial names and fuzzy matches', () => {
    for (const answer of ['Paris', 'Finland', 'Helsin', 'Helsinkii', 'Helsinki or Paris']) {
      expect(isCorrectCapitalAnswer(finland, answer), answer).toBe(false);
    }
    expect(isCorrectAnswer(finland, 'Finland')).toBe(true);
    expect(isCorrectAnswer(finland, 'Helsinki')).toBe(false);
  });
});

describe('capital rounds use the shared reducer', () => {
  it('applies continent and country starting-letter filters before ordering', () => {
    const sequence = createSequence({ mode: 'linear', continents: ['Europe'], letters: ['F'] });
    expect(sequence.map((country) => country.id)).toEqual(['fi', 'fr']);
  });

  it('tracks mistakes, duplicate submission guards, accuracy and completion', () => {
    let state = initialGame([finland, france]);
    state = gameReducer(state, { type: 'capital', countryId: 'fi', value: 'Paris' });
    expect(state.incorrectAttempts).toBe(1);
    expect(gameReducer(state, { type: 'capital', countryId: 'fi', value: 'PARIS' })).toBe(state);
    state = gameReducer(state, { type: 'capital', countryId: 'fi', value: 'Helsinki' });
    expect(state.status).toBe('correct');
    expect(state.correct).toBe(1);
    expect(state.history[0].attempts).toBe(2);
    expect(getAccuracy(state)).toBe(50);
    expect(gameReducer(state, { type: 'capital', countryId: 'fi', value: 'Helsinki' })).toBe(state);
    state = gameReducer(state, { type: 'next', countryId: 'fi' });
    expect(gameReducer(state, { type: 'capital', countryId: 'fi', value: 'Helsinki' })).toBe(state);
    state = gameReducer(state, { type: 'capital', countryId: 'fr', value: 'Paris' });
    state = gameReducer(state, { type: 'next', countryId: 'fr' });
    expect(state.status).toBe('complete');
    expect(state.correct).toBe(2);
    expect(state.incorrectAttempts).toBe(1);
    expect(getAccuracy(state)).toBe(67);
  });

  it('keeps empty answers, reveals, skips and restarts consistent with the flag game', () => {
    let state = initialGame([finland, france]);
    state = gameReducer(state, { type: 'capital', countryId: 'fi', value: '  ' });
    expect(state.feedback).toBe('empty');
    expect(state.incorrectAttempts).toBe(0);
    state = gameReducer(state, { type: 'reveal', countryId: 'fi' });
    expect(state.revealed).toBe(1);
    expect(state.correct).toBe(0);
    state = gameReducer(state, { type: 'next', countryId: 'fi' });
    state = gameReducer(state, { type: 'skip', countryId: 'fr' });
    expect(state.skipped).toBe(1);
    state = gameReducer(state, { type: 'next', countryId: 'fr' });
    expect(state.status).toBe('complete');
    expect(state.history.map((result) => result.outcome)).toEqual(['revealed', 'skipped']);
    expect(gameReducer(state, { type: 'start', sequence: [finland, france] })).toEqual(initialGame([finland, france]));
  });
});
