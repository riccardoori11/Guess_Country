import { countries, type Continent, type Country } from '../data/countries';

export type GameMode = 'random' | 'linear';
export interface Preferences {
  mode: GameMode;
  continents: Continent[];
}
export type Outcome = 'correct' | 'revealed' | 'skipped';
export interface Result {
  country: Country;
  outcome: Outcome;
  attempts: number;
}
export interface GameState {
  sequence: Country[];
  index: number;
  status: 'playing' | Outcome | 'complete';
  feedback: 'idle' | 'incorrect' | 'empty';
  correct: number;
  incorrectAttempts: number;
  skipped: number;
  revealed: number;
  streak: number;
  bestStreak: number;
  currentAttempts: number;
  lastGuess: string;
  history: Result[];
}
export type GameAction =
  | { type: 'start'; sequence: Country[] }
  | { type: 'guess'; countryId: string; value: string }
  | { type: 'reveal'; countryId: string }
  | { type: 'skip'; countryId: string }
  | { type: 'next'; countryId: string };

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`.]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCorrectAnswer(country: Country, answer: string): boolean {
  const normalized = normalizeAnswer(answer);
  return (
    normalized.length > 0 &&
    [country.name, ...country.aliases].some(
      (name) => normalizeAnswer(name) === normalized,
    )
  );
}

export function eligibleCountries(continents: readonly Continent[]): Country[] {
  return countries.filter((country) => continents.includes(country.continent));
}

export function createSequence(
  preferences: Preferences,
  random: () => number = Math.random,
): Country[] {
  // An explicit English collator gives the same order regardless of browser locale.
  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  const sequence = eligibleCountries(preferences.continents).sort((a, b) =>
    collator.compare(a.name, b.name),
  );
  if (preferences.mode === 'random') {
    // Fisher–Yates: every eligible country occurs exactly once.
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
    }
  }
  return sequence;
}

export function initialGame(sequence: Country[]): GameState {
  return {
    sequence,
    index: 0,
    status: sequence.length ? 'playing' : 'complete',
    feedback: 'idle',
    correct: 0,
    incorrectAttempts: 0,
    skipped: 0,
    revealed: 0,
    streak: 0,
    bestStreak: 0,
    currentAttempts: 0,
    lastGuess: '',
    history: [],
  };
}

function resolve(state: GameState, outcome: Outcome): GameState {
  const streak = outcome === 'correct' ? state.streak + 1 : 0;
  return {
    ...state,
    status: outcome,
    feedback: 'idle',
    streak,
    bestStreak: Math.max(streak, state.bestStreak),
    correct: state.correct + Number(outcome === 'correct'),
    skipped: state.skipped + Number(outcome === 'skipped'),
    revealed: state.revealed + Number(outcome === 'revealed'),
    history: [
      ...state.history,
      {
        country: state.sequence[state.index],
        outcome,
        attempts: state.currentAttempts + Number(outcome === 'correct'),
      },
    ],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'start') return initialGame(action.sequence);
  if (
    state.status === 'complete' ||
    action.countryId !== state.sequence[state.index]?.id
  )
    return state;
  if (action.type === 'next') {
    if (state.status === 'playing') return state;
    const index = state.index + 1;
    return {
      ...state,
      index,
      status: index >= state.sequence.length ? 'complete' : 'playing',
      feedback: 'idle',
      currentAttempts: 0,
      lastGuess: '',
    };
  }
  if (state.status !== 'playing') return state;
  if (action.type === 'reveal' || action.type === 'skip')
    return resolve(state, action.type === 'reveal' ? 'revealed' : 'skipped');
  const normalized = normalizeAnswer(action.value);
  if (!normalized) return { ...state, feedback: 'empty' };
  // Repeated Enter / button clicks on an unchanged wrong answer count once.
  if (normalized === state.lastGuess)
    return state.feedback === 'incorrect'
      ? state
      : { ...state, feedback: 'incorrect' };
  if (isCorrectAnswer(state.sequence[state.index], action.value))
    return resolve(state, 'correct');
  return {
    ...state,
    feedback: 'incorrect',
    incorrectAttempts: state.incorrectAttempts + 1,
    currentAttempts: state.currentAttempts + 1,
    streak: 0,
    lastGuess: normalized,
  };
}

export function getAccuracy(state: GameState): number {
  // Correct answers / all guesses. Skips and reveals have their own counters.
  const guesses = state.correct + state.incorrectAttempts;
  return guesses ? Math.round((state.correct / guesses) * 100) : 0;
}
