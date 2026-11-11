// @vitest-environment happy-dom
import { act, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countries, type Country } from '../data/countries';
import { capitalsByCountry } from '../data/capitals';
import { gameReducer, initialGame } from '../lib/game';
import { GameCard } from './GameCard';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const country = (id: string) => countries.find((value) => value.id === id)!;
const sequence = [country('fr'), country('pl')];
let root: Root;
let container: HTMLDivElement;

function Harness({ pool = sequence, inactive = false }: { pool?: Country[]; inactive?: boolean }) {
  const [game, dispatch] = useReducer(gameReducer, pool, initialGame);
  return <>
    <button onClick={() => dispatch({ type: 'start', sequence: [...pool] })}>Restart test round</button>
    <output data-testid="counts">{game.correct}/{game.incorrectAttempts}/{game.revealed}/{game.skipped}</output>
    <div hidden={inactive}>
      <GameCard game={game} mode="linear" activity="capital" dispatch={dispatch}
        onRestart={() => dispatch({ type: 'start', sequence: [...pool] })}
        restartDisabled={false} settingsOpen={inactive} />
    </div>
  </>;
}

async function render(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () => root.render(<Harness {...props} />));
}
function button(name: string) {
  const found = [...container.querySelectorAll('button')].find((value) => value.textContent?.trim() === name);
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function type(value: string) {
  const input = container.querySelector<HTMLInputElement>('#capital-answer')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function answer(value: string) {
  await type(value);
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  let now = 100_000;
  vi.spyOn(Date, 'now').mockImplementation(() => { now += 500; return now; });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('capital game card', () => {
  it('asks for a capital, retries country names and wrong cities, and resolves a keyboard-submitted answer', async () => {
    await render();
    expect(container.querySelector('#capital-country')?.textContent).toBe('France');
    expect(container.querySelector('label[for="capital-answer"]')?.textContent).toBe('Capital of France');
    expect(container.textContent).not.toContain('Paris');
    expect(document.activeElement).toBe(container.querySelector('#capital-answer'));
    await answer('France');
    expect(container.querySelector('#capital-answer')?.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('#capital-feedback')?.textContent).toContain('Not quite');
    expect(container.textContent).not.toContain('Paris');
    await answer('Rome');
    expect(container.querySelector('[data-testid="counts"]')?.textContent).toBe('0/2/0/0');
    await answer('  pArIs  ');
    expect(container.querySelector('.result-message strong')?.textContent).toBe('Paris');
    expect(container.querySelector('[data-testid="counts"]')?.textContent).toBe('1/2/0/0');
    expect(document.activeElement).toBe(button('Next country'));
    await click('Next country');
    expect(container.querySelector('#capital-country')?.textContent).toBe('Poland');
    expect(container.querySelector<HTMLInputElement>('#capital-answer')?.value).toBe('');
    expect(document.activeElement).toBe(container.querySelector('#capital-answer'));
  });

  it('offers a first-letter hint without leaking the full answer and handles blank input', async () => {
    await render();
    await answer('   ');
    expect(container.querySelector('#capital-feedback')?.textContent).toContain('Type a capital city');
    expect(container.querySelector('[data-testid="counts"]')?.textContent).toBe('0/0/0/0');
    await click('Need a hint?');
    expect(container.querySelector('#capital-feedback')?.textContent).toContain('capital starts with P');
    expect(container.textContent).not.toContain('Paris');
    await answer('Lyon');
    expect(container.querySelector('#capital-feedback')?.textContent).toContain('capital starts with P');
    await click('Restart test round');
    expect(button('Need a hint?').disabled).toBe(false);
    expect(container.querySelector('[data-testid="counts"]')?.textContent).toBe('0/0/0/0');
  });

  it('reveals special-case notes, tracks skips, and reviews canonical country/capital pairs at completion', async () => {
    await render({ pool: [country('za'), country('fr')] });
    expect(container.querySelector('.capital-note')).toBeNull();
    await click('Reveal answer');
    expect(container.querySelector('.result-message strong')?.textContent).toBe(capitalsByCountry.za.name);
    expect(capitalsByCountry.za.note).toBeTruthy();
    expect(container.querySelector('.capital-note')?.textContent).toBe(capitalsByCountry.za.note);
    expect(container.querySelector('[data-testid="counts"]')?.textContent).toBe('0/0/1/0');
    await click('Next country');
    await click('Skip');
    expect(container.querySelector('.result-message strong')?.textContent).toBe('Paris');
    expect(container.querySelector('[data-testid="counts"]')?.textContent).toBe('0/0/1/1');
    await click('See your results');
    expect(document.activeElement).toBe(container.querySelector('#capital-completion-title'));
    expect(container.querySelector('.completion-stats')?.textContent).toContain('Capitals guessed');
    const rows = [...container.querySelectorAll('.review-row')].map((row) => row.textContent);
    expect(rows[0]).toContain(`South Africa — ${capitalsByCountry.za.name}`);
    expect(rows[1]).toContain('France — Paris');
    await click('Explore again');
    expect(container.querySelector('#capital-country')?.textContent).toBe('South Africa');
    expect(container.querySelector('[data-testid="counts"]')?.textContent).toBe('0/0/0/0');
  });

  it('preserves a typed guess and hint in an inactive mounted card without stealing focus', async () => {
    await render();
    await type('Pa');
    await click('Need a hint?');
    const outside = button('Restart test round');
    outside.focus();
    await render({ inactive: true });
    expect(document.activeElement).toBe(outside);
    expect(container.querySelector<HTMLInputElement>('#capital-answer')?.value).toBe('Pa');
    await render();
    expect(document.activeElement).toBe(container.querySelector('#capital-answer'));
    expect(container.querySelector<HTMLInputElement>('#capital-answer')?.value).toBe('Pa');
    expect(button('Hint shown').disabled).toBe(true);
  });

  it('uses distinct IDs alongside the default flag card while retaining its existing labels', async () => {
    const game = initialGame(sequence);
    await act(async () => root.render(<>
      <GameCard game={game} mode="linear" dispatch={vi.fn()} onRestart={vi.fn()} restartDisabled={false} settingsOpen />
      <GameCard game={game} mode="linear" activity="capital" dispatch={vi.fn()} onRestart={vi.fn()} restartDisabled={false} settingsOpen={false} />
    </>));
    expect(container.querySelector('[aria-label="Guess the flag"]')).not.toBeNull();
    expect(container.querySelector('#country-answer')?.getAttribute('aria-describedby')).toBe('answer-feedback');
    expect(container.querySelector('#capital-answer')?.getAttribute('aria-describedby')).toBe('capital-feedback');
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(container.querySelector('.country-flag')).not.toBeNull();

    let complete = initialGame([country('fr')]);
    complete = gameReducer(complete, { type: 'reveal', countryId: 'fr' });
    complete = gameReducer(complete, { type: 'next', countryId: 'fr' });
    await act(async () => root.render(<>
      <GameCard game={complete} mode="linear" dispatch={vi.fn()} onRestart={vi.fn()} restartDisabled={false} settingsOpen />
      <GameCard game={complete} mode="linear" activity="capital" dispatch={vi.fn()} onRestart={vi.fn()} restartDisabled={false} settingsOpen={false} />
    </>));
    expect(container.querySelector('#completion-title')).not.toBeNull();
    expect(container.querySelector('#capital-completion-title')).not.toBeNull();
    const completedIds = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(completedIds).size).toBe(completedIds.length);
  });
});
