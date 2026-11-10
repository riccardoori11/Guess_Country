// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { CONTINENTS, type Continent } from './data/countries';
import { LETTERS } from './lib/filters';
import type { Preferences } from './lib/game';
import { PREFERENCES_KEY } from './lib/preferences';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;

function button(label: string, scope: ParentNode = container) {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent?.trim() === label || element.getAttribute('aria-label') === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}
async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}
async function render(preferences: Partial<Preferences> = {}) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    mode: 'linear', continents: ['Europe'], letters: ['F'], ...preferences,
  }));
  await act(async () => { root.render(<App />); });
}
async function placement() {
  await click(button('Place the Country'));
  await act(async () => { await import('./components/PlacementGame'); });
}
function mapCountry(id: string) {
  const country = container.querySelector(`[data-country-id="${id}"]`);
  if (!country) throw new Error(`Missing map country: ${id}`);
  return country;
}
async function selectCountry(id: string) { await click(mapCountry(id)); }
function stat(name: 'correct' | 'incorrect') {
  return container.querySelector(`[data-testid="${name}-count"]`)?.textContent;
}
function prompt() {
  return container.querySelector('[aria-label="Place the Country"] h2')?.textContent;
}
async function typeAnswer(value: string) {
  const input = container.querySelector<HTMLInputElement>('#country-answer')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function answer(value: string) {
  await typeAnswer(value);
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
function continent(name: Continent) {
  return container.querySelectorAll<HTMLInputElement>('.continent-option input')[CONTINENTS.indexOf(name)];
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  let now = 100_000;
  vi.spyOn(Date, 'now').mockImplementation(() => { now += 500; return now; });
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('country placement integration', () => {
  it('retries wrong countries, records selections and completes the combined Europe/F pool', async () => {
    await render();
    await placement();
    expect(prompt()).toContain('Finland');
    await selectCountry('de');
    expect(stat('incorrect')).toBe('1');
    expect(container.textContent).toContain('Germany');
    await selectCountry('se');
    await selectCountry('fi');
    expect(stat('correct')).toBe('1');
    expect(stat('incorrect')).toBe('2');
    expect(container.querySelector('.accuracy-ring strong')?.textContent).toContain('33');
    const history = container.querySelector('.answer-history');
    expect(history?.textContent).toContain('Finland');
    expect(history?.textContent).toContain('Germany');
    expect(history?.textContent).toContain('Sweden');
    await click(button('Next Country'));
    expect(prompt()).toContain('France');
    await selectCountry('fr');
    expect(stat('correct')).toBe('2');
    await click(button('See your results'));
    expect(container.querySelector('[aria-label="Place the Country"]')?.textContent).toMatch(/round complete/i);
    expect(stat('incorrect')).toBe('2');
    await click(button('Explore again', container.querySelector('[aria-label="Place the Country"]')!));
    expect(prompt()).toContain('Finland');
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('0');
  });

  it('applies shared filter controls and rejects empty combinations without interrupting the active round', async () => {
    await render({ continents: [...CONTINENTS], letters: [...LETTERS] });
    await placement();
    await click(button('Deselect all continents'));
    await click(continent('Europe'));
    await click(button('Deselect all letters'));
    await click(button('Countries starting with F'));
    expect(container.querySelector('.country-pool')?.textContent).toContain('2 countries');
    await click(button('Apply & start round'));
    expect(prompt()).toContain('Finland');
    await click(button('Countries starting with F'));
    await click(button('Countries starting with Q'));
    expect(container.querySelector('.country-pool')?.textContent).toContain('0 countries');
    expect(container.querySelector('.empty-selection')?.textContent).toBeTruthy();
    expect(button('Apply & start round').disabled).toBe(true);
    expect(button('New round').disabled).toBe(true);
    expect(prompt()).toContain('Finland');
  });

  it('keeps each game progress, flag input and filter drafts when switching modes', async () => {
    await render();
    await answer('Finland');
    await click(button('Next flag'));
    await answer('Canada');
    await click(button('Countries starting with A'));
    expect(stat('correct')).toBe('1');
    expect(stat('incorrect')).toBe('1');
    await placement();
    expect(prompt()).toContain('Finland');
    expect(stat('correct')).toBe('0');
    expect(button('Countries starting with A').getAttribute('aria-pressed')).toBe('false');
    await selectCountry('de');
    await selectCountry('fi');
    await click(button('Next Country'));
    expect(prompt()).toContain('France');
    await click(button('Guess the Flag'));
    expect(container.querySelector('.country-flag')?.getAttribute('src')).toBe('/flags/fr.svg');
    expect(container.querySelector<HTMLInputElement>('#country-answer')?.value).toBe('Canada');
    expect(stat('correct')).toBe('1');
    expect(stat('incorrect')).toBe('1');
    expect(button('Countries starting with A').getAttribute('aria-pressed')).toBe('true');
    await placement();
    expect(prompt()).toContain('France');
    expect(stat('correct')).toBe('1');
    expect(stat('incorrect')).toBe('1');
  });

  it('restarts only the active round after confirmation and leaves the other game intact', async () => {
    await render();
    await answer('Finland');
    await placement();
    await selectCountry('de');
    await selectCountry('fi');
    await click(button('Next Country'));
    await click(button('New round'));
    expect(container.querySelector('dialog')?.open).toBe(true);
    await click(button('Start new round'));
    expect(prompt()).toContain('Finland');
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('0');
    expect(container.querySelector('.answer-history')?.textContent).not.toContain('Germany');
    await click(button('Guess the Flag'));
    expect(stat('correct')).toBe('1');
    expect(container.querySelector('.country-flag')?.getAttribute('src')).toBe('/flags/fi.svg');
  });

  it('shuffles the filtered pool and visits every country once', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await render({ mode: 'random' });
    await placement();
    expect(prompt()).toContain('France');
    await selectCountry('fr');
    await click(button('Next Country'));
    expect(prompt()).toContain('Finland');
    await selectCountry('fi');
    await click(button('See your results'));
    expect(stat('correct')).toBe('2');
    expect(container.querySelectorAll('.placement-results li')).toHaveLength(2);
  });

  it('pauses automatic advancement while another game is visible', async () => {
    await render();
    await placement();
    vi.useFakeTimers();
    const checkbox = container.querySelector<HTMLInputElement>('input[aria-label="Automatically advance after a correct answer"]')
      ?? [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
        (input) => input.closest('label')?.textContent?.includes('Automatically advance after a correct answer'),
      );
    expect(checkbox).toBeTruthy();
    await click(checkbox!);
    await selectCountry('fi');
    await click(button('Guess the Flag'));
    await act(async () => { vi.advanceTimersByTime(2000); });
    await placement();
    expect(prompt()).toContain('Finland');
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(prompt()).toContain('France');
    expect(stat('correct')).toBe('1');
  });

  it('shows answers without awarding locations, preserves revealed history and resets it on restart', async () => {
    await render();
    await placement();
    vi.useFakeTimers();
    const autoAdvance = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
      (input) => input.closest('label')?.textContent?.includes('Automatically advance after a correct answer'),
    )!;
    await click(autoAdvance);
    await selectCountry('de');
    await click(button('Show answer'));
    expect(mapCountry('fi').classList.contains('is-revealed')).toBe(true);
    expect(mapCountry('fi').classList.contains('is-completed')).toBe(false);
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('1');
    const revealedStat = [...container.querySelectorAll('.score-details > div')].find(
      (row) => row.querySelector('span')?.textContent?.trim() === 'Revealed',
    );
    expect(revealedStat?.querySelector('strong')?.textContent).toBe('1');
    const history = container.querySelector('.placement-history')!;
    expect(history.textContent).toContain('Answer shown.');
    expect(history.textContent).toContain('Germany');
    expect(history.textContent).toContain('Correct answer: Finland.');
    expect(history.textContent).not.toContain('Correct on your first try');
    expect(container.querySelector('.placement-game [role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(prompt()).toContain('Finland');
    await click(button('Guess the Flag'));
    await placement();
    expect(mapCountry('fi').classList.contains('is-revealed')).toBe(true);
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('1');
    await click(button('Next Country'));
    expect(prompt()).toContain('France');
    expect(mapCountry('fi').classList.contains('is-revealed')).toBe(true);
    await click(button('Show answer'));
    await click(button('See your results'));
    expect(container.querySelector('.placement-prompt')?.textContent).toContain('0 located, 2 revealed');
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('1');
    expect(container.querySelectorAll('.placement-history li.revealed')).toHaveLength(2);
    expect(container.querySelector('.placement-history')?.textContent).not.toContain('Correct on your first try');
    await click(button('Explore again', container.querySelector('.placement-game')!));
    expect(prompt()).toContain('Finland');
    expect(container.querySelector('.map-country.is-revealed')).toBeNull();
    expect(container.querySelectorAll('.placement-history li')).toHaveLength(0);
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('0');
  });

  it('provides an informative initial empty game for unmatched saved filters', async () => {
    await render({ letters: ['Q'] });
    await placement();
    const card = container.querySelector('[aria-label="Place the Country"]');
    expect(card?.textContent).toMatch(/no countries|no country|no matches/i);
    expect(button('Start a new round').disabled).toBe(true);
    expect(container.querySelector('[data-country-id]')).toBeNull();
  });
});
