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
function capitalCard() {
  const card = container.querySelector('[aria-label="Guess the capital"]')
    ?? container.querySelector('#capital-completion-title')?.closest('section');
  if (!card) throw new Error('Missing capital game');
  return card;
}
function flagCard() {
  return container.querySelector('[aria-label="Guess the flag"]')!;
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
async function chooseCapital() { await click(button('Guess the Capital')); }
async function choosePlacement() {
  await click(button('Place the Country'));
  await act(async () => { await import('./components/PlacementGame'); });
}
async function typeAnswer(value: string, id = 'capital-answer') {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function answer(value: string, id = 'capital-answer') {
  await typeAnswer(value, id);
  await act(async () => {
    container.querySelector(`#${id}`)!.closest('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
}
function stat(name: 'correct' | 'incorrect') {
  return container.querySelector(`[data-testid="${name}-count"]`)?.textContent;
}
function namedStat(label: string) {
  return [...container.querySelectorAll('.score-details > div')].find(
    (row) => row.querySelector('span')?.textContent?.trim() === label,
  )?.querySelector('strong')?.textContent;
}
function continent(name: Continent) {
  return container.querySelectorAll<HTMLInputElement>('.continent-option input')[CONTINENTS.indexOf(name)];
}
function selectedLetter(letter: string) {
  return button(`Countries starting with ${letter}`).getAttribute('aria-pressed');
}
async function mapSelection(id: string) {
  const country = container.querySelector(`[data-country-id="${id}"]`);
  if (!country) throw new Error(`Missing map country: ${id}`);
  await click(country);
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
  vi.restoreAllMocks();
});

describe('capital game integration', () => {
  it('plays the combined Europe/F pool with empty, wrong and normalized capital answers', async () => {
    await render();
    await chooseCapital();
    expect(capitalCard().textContent).toContain('Finland');
    expect(container.querySelector('#capital-answer')).toBe(document.activeElement);
    await answer('   ');
    expect(stat('incorrect')).toBe('0');
    expect(container.querySelector('#capital-feedback')?.textContent).toMatch(/capital/i);
    await answer('Finland');
    expect(stat('incorrect')).toBe('1');
    expect(container.querySelector('#capital-answer')?.getAttribute('aria-invalid')).toBe('true');
    await answer('Paris');
    expect(stat('incorrect')).toBe('2');
    await answer('  hÉLsÍNkI  ');
    expect(stat('correct')).toBe('1');
    expect(capitalCard().querySelector('.result-message strong')?.textContent).toContain('Helsinki');
    expect(container.querySelector('.accuracy-ring strong')?.textContent).toContain('33');
    expect(document.activeElement).toBe(button('Next country', capitalCard()));
    await click(button('Next country', capitalCard()));
    expect(capitalCard().textContent).toContain('France');
    expect(container.querySelector('#capital-answer')).toBe(document.activeElement);
    await answer('pArIs');
    await click(button('See your results', capitalCard()));
    expect(container.querySelector('#capital-completion-title')).toBe(document.activeElement);
    expect(stat('correct')).toBe('2');
    expect(stat('incorrect')).toBe('2');
    expect(capitalCard().querySelectorAll('.review-row')).toHaveLength(2);
    expect(capitalCard().textContent).toContain('Helsinki');
    expect(capitalCard().textContent).toContain('Paris');
    expect(container.querySelector('.answer-history')?.textContent).toContain('Helsinki');
    expect(container.querySelector('.answer-history')?.textContent).toContain('Paris');
  });

  it('filters by the country name rather than the capital and blocks empty filter drafts', async () => {
    await render({ continents: [...CONTINENTS], letters: [...LETTERS] });
    await chooseCapital();
    await click(button('Deselect all continents'));
    await click(continent('Europe'));
    await click(button('Deselect all letters'));
    await click(button('Countries starting with H'));
    expect(container.querySelector('.country-pool')?.textContent).toMatch(/1 countr/);
    await click(button('Apply & start round'));
    expect(capitalCard().textContent).toContain('Hungary');
    await answer('Budapest');
    expect(stat('correct')).toBe('1');
    await click(button('Countries starting with H'));
    await click(button('Countries starting with Q'));
    expect(container.querySelector('.country-pool')?.textContent).toContain('0 countries');
    expect(container.querySelector('.empty-selection')?.textContent).toMatch(/no countries/i);
    expect(button('Apply & start round').disabled).toBe(true);
    expect(button('New round').disabled).toBe(true);
    expect(capitalCard().querySelector('.result-message strong')?.textContent).toContain('Budapest');
  });

  it('shuffles the selected country pool without repeating a capital question', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await render({ mode: 'random' });
    await chooseCapital();
    expect(capitalCard().textContent).toContain('France');
    await answer('Paris');
    await click(button('Next country', capitalCard()));
    expect(capitalCard().textContent).toContain('Finland');
    await answer('Helsinki');
    await click(button('See your results', capitalCard()));
    expect(stat('correct')).toBe('2');
    expect(capitalCard().querySelectorAll('.review-row')).toHaveLength(2);
  });

  it('keeps independent progress, input, hints and filter drafts across all three games', async () => {
    await render();
    await answer('Finland', 'country-answer');
    await click(button('Next flag', flagCard()));
    await answer('Canada', 'country-answer');
    await click(button('Need a hint?', flagCard()));
    await click(button('Countries starting with A'));
    await chooseCapital();
    await answer('Paris');
    await click(button('Need a hint?', capitalCard()));
    await click(button('Countries starting with B'));
    await choosePlacement();
    await mapSelection('se');
    await mapSelection('fi');
    await click(button('Next Country', container.querySelector('[aria-label="Place the Country"]')!));
    await click(button('Countries starting with C'));
    await click(button('Guess the Flag'));
    expect(flagCard().querySelector('.country-flag')?.getAttribute('src')).toBe('/flags/fr.svg');
    expect(container.querySelector<HTMLInputElement>('#country-answer')?.value).toBe('Canada');
    expect(button('Hint shown', flagCard()).disabled).toBe(true);
    expect(stat('correct')).toBe('1');
    expect(stat('incorrect')).toBe('1');
    expect(selectedLetter('A')).toBe('true');
    expect(selectedLetter('B')).toBe('false');
    expect(selectedLetter('C')).toBe('false');
    await chooseCapital();
    expect(capitalCard().textContent).toContain('Finland');
    expect(container.querySelector<HTMLInputElement>('#capital-answer')?.value).toBe('Paris');
    expect(button('Hint shown', capitalCard()).disabled).toBe(true);
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('1');
    expect(selectedLetter('A')).toBe('false');
    expect(selectedLetter('B')).toBe('true');
    expect(selectedLetter('C')).toBe('false');
    await answer('Helsinki');
    await click(button('Next country', capitalCard()));
    await typeAnswer('Mar');
    await choosePlacement();
    expect(container.querySelector('#placement-target')?.textContent).toContain('France');
    expect(stat('correct')).toBe('1');
    expect(stat('incorrect')).toBe('1');
    expect(selectedLetter('A')).toBe('false');
    expect(selectedLetter('B')).toBe('false');
    expect(selectedLetter('C')).toBe('true');
    await chooseCapital();
    expect(container.querySelector<HTMLInputElement>('#capital-answer')?.value).toBe('Mar');
    expect(stat('correct')).toBe('1');
    expect(stat('incorrect')).toBe('1');
  });

  it('restarts the capital game without resetting the flag game', async () => {
    await render();
    await answer('Finland', 'country-answer');
    await chooseCapital();
    await answer('London');
    await answer('Helsinki');
    await click(button('Next country', capitalCard()));
    await click(button('New round'));
    expect(container.querySelector('dialog')?.open).toBe(true);
    await click(button('Start new round', container.querySelector('dialog')!));
    expect(capitalCard().textContent).toContain('Finland');
    expect(container.querySelector<HTMLInputElement>('#capital-answer')?.value).toBe('');
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('0');
    await click(button('Guess the Flag'));
    expect(stat('correct')).toBe('1');
    expect(flagCard().querySelector('.result-message strong')?.textContent).toContain('Finland');
  });

  it('reveals and skips capitals without awarding correct answers and records their outcomes', async () => {
    await render();
    await chooseCapital();
    await answer('London');
    await click(button('Reveal answer', capitalCard()));
    expect(capitalCard().querySelector('.result-message strong')?.textContent).toContain('Helsinki');
    expect(stat('correct')).toBe('0');
    expect(stat('incorrect')).toBe('1');
    expect(namedStat('Revealed')).toBe('1');
    expect(container.querySelector('.answer-history')?.textContent).toContain('Helsinki');
    await click(button('Next country', capitalCard()));
    await click(button('Skip', capitalCard()));
    expect(capitalCard().querySelector('.result-message strong')?.textContent).toContain('Paris');
    expect(namedStat('Skipped')).toBe('1');
    expect(stat('correct')).toBe('0');
    await click(button('See your results', capitalCard()));
    expect(capitalCard().querySelector('.completion-breakdown')?.textContent).toContain('1 skipped');
    expect(capitalCard().querySelector('.completion-breakdown')?.textContent).toContain('1 revealed');
    expect(capitalCard().querySelectorAll('.review-row .outcome.revealed')).toHaveLength(1);
    expect(capitalCard().querySelectorAll('.review-row .outcome.skipped')).toHaveLength(1);
    expect(container.querySelector('.answer-history')?.textContent).toContain('Helsinki');
    expect(container.querySelector('.answer-history')?.textContent).toContain('Paris');
  });

  it('labels the capital input and preserves guesses and statistics across theme changes', async () => {
    await render();
    await chooseCapital();
    const input = container.querySelector<HTMLInputElement>('#capital-answer')!;
    expect(container.querySelector('label[for="capital-answer"]')?.textContent?.trim()).toBe('Capital of Finland');
    expect(input.getAttribute('aria-describedby')).toBe('capital-feedback');
    expect(container.querySelector('#capital-feedback')?.getAttribute('aria-live')).toBe('polite');
    await answer('London');
    for (const theme of ['dark', 'light']) {
      const option = container.querySelector<HTMLInputElement>(`.theme-picker input[value="${theme}"]`)!.closest('label')!.querySelector('span')!;
      await click(option);
      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(input.value).toBe('London');
      expect(stat('incorrect')).toBe('1');
      expect(capitalCard().textContent).toContain('Finland');
    }
    await answer('Helsinki');
    expect(stat('correct')).toBe('1');
  });

  it('shows an informative empty game for unmatched saved filters', async () => {
    await render({ letters: ['Q'] });
    await chooseCapital();
    expect(container.querySelector('#capital-answer')).toBeNull();
    expect(container.querySelector('.center-column')?.textContent).toMatch(/no countries match/i);
    expect(button('Start a new round').disabled).toBe(true);
  });
});
