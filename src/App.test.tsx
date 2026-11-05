// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { CONTINENTS } from './data/countries';
import { PREFERENCES_KEY } from './lib/preferences';
import type { Preferences } from './lib/game';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
let clock = 100_000;

function button(
  text: string,
  scope: ParentNode = container,
): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find(
    (element) =>
      element.textContent?.trim() === text ||
      element.getAttribute('aria-label') === text,
  );
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
}
async function render(
  preferences: Preferences = { mode: 'linear', continents: [...CONTINENTS] },
) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  await act(async () => {
    root.render(<App />);
  });
}
async function answer(value: string) {
  const input = container.querySelector<HTMLInputElement>('#country-answer')!;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
function flag() {
  return container.querySelector('.country-flag')?.getAttribute('src');
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  clock = 100_000;
  vi.spyOn(Date, 'now').mockImplementation(() => {
    clock += 500;
    return clock;
  });
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('game interface', () => {
  it('renders a complete, focused game with accessible flag and answer labels', async () => {
    await render();
    expect(flag()).toBe('/flags/af.svg');
    expect(container.querySelector('#country-answer')).toBe(
      document.activeElement,
    );
    expect(container.querySelector('.country-flag')?.getAttribute('alt')).toBe(
      'Mystery country flag',
    );
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuemax'),
    ).toBe('195');
    expect(
      container.querySelector('[data-testid="correct-count"]')?.textContent,
    ).toBe('0');
  });

  it('supports wrong guesses, retry, correct feedback, and next-flag navigation', async () => {
    await render({ mode: 'linear', continents: ['Europe'] });
    await answer('Austria');
    expect(container.querySelector('#answer-feedback')?.textContent).toContain(
      'Not quite',
    );
    expect(
      container.querySelector('[data-testid="incorrect-count"]')?.textContent,
    ).toBe('1');
    await answer('Austria');
    expect(
      container.querySelector('[data-testid="incorrect-count"]')?.textContent,
    ).toBe('1');
    await answer(' alBANia  ');
    expect(container.querySelector('.result-message')?.textContent).toContain(
      'Albania',
    );
    expect(
      container.querySelector('[data-testid="correct-count"]')?.textContent,
    ).toBe('1');
    expect(container.querySelector('#country-answer')).toBeNull();
    expect(container.querySelector('.next-button')).toBe(
      document.activeElement,
    );
    await click(button('Next flag'));
    expect(flag()).toBe('/flags/ad.svg');
    expect(container.querySelector('#country-answer')).toBe(
      document.activeElement,
    );
  });

  it('provides a hint, reveal, skip, and separate score counters', async () => {
    await render({ mode: 'linear', continents: ['Oceania'] });
    await click(button('Need a hint?'));
    expect(container.querySelector('#answer-feedback')?.textContent).toContain(
      'Oceania',
    );
    await click(button('Reveal answer'));
    expect(container.querySelector('.result-message')?.textContent).toContain(
      'Australia',
    );
    expect(button('Reveal answer').disabled).toBe(true);
    await click(button('Next flag'));
    await click(button('Skip'));
    expect(container.querySelector('.result-message')?.textContent).toContain(
      'Fiji',
    );
    const details = container.querySelector('.score-details')!.textContent!;
    expect(details).toContain('Skipped1');
    expect(details).toContain('Revealed1');
    expect(
      container.querySelector('[data-testid="correct-count"]')?.textContent,
    ).toBe('0');
  });

  it('disables starting with no continents and regenerates the selected pool', async () => {
    await render();
    await click(button('Deselect all'));
    expect(container.querySelector('.country-pool')?.textContent).toContain(
      '0 countries',
    );
    expect(button('Apply & start round').disabled).toBe(true);
    expect(container.querySelector('.empty-selection')?.textContent).toContain(
      'Choose at least one',
    );
    const boxes = container.querySelectorAll<HTMLInputElement>(
      '.continent-option input',
    );
    await click(boxes[1]); // Asia
    await click(boxes[2]); // Europe
    expect(container.querySelector('.country-pool')?.textContent).toContain(
      '92 countries',
    );
    await click(button('Apply & start round'));
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuemax'),
    ).toBe('92');
    expect(flag()).toBe('/flags/af.svg');
    await click(button('Random'));
    await click(button('Apply & start round'));
    expect(container.querySelector('.game-mode-badge')?.textContent).toBe(
      'Random mode',
    );
    expect(
      container.querySelector('[data-testid="correct-count"]')?.textContent,
    ).toBe('0');
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).mode).toBe(
      'random',
    );
  });

  it('shows a helpful empty state after restoring an empty preference selection', async () => {
    await render({ mode: 'random', continents: [] });
    expect(container.querySelector('.empty-game')?.textContent).toContain(
      'Choose at least one continent',
    );
    expect(container.querySelector('#country-answer')).toBeNull();
    expect(button('Start a new round').disabled).toBe(true);
  });

  it('recovers from failed flag images and keeps skip available', async () => {
    await render();
    await act(async () => {
      container
        .querySelector('.country-flag')!
        .dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('.flag-error')?.textContent).toContain(
      'This flag couldn’t load',
    );
    expect(button('Skip').disabled).toBe(false);
    await click(button('Retry image'));
    expect(flag()).toBe('/flags/af.svg?retry=1');
    await act(async () => {
      container
        .querySelector('.country-flag')!
        .dispatchEvent(new Event('error'));
    });
    await click(button('Skip'));
    await click(button('Next flag'));
    expect(flag()).toBe('/flags/al.svg');
  });

  it('completes a pool and offers the full review and a fresh restart', async () => {
    await render({ mode: 'linear', continents: ['Oceania'] });
    for (let i = 0; i < 14; i++) {
      await click(button('Skip'));
      await click(button(i === 13 ? 'See your results' : 'Next flag'));
    }
    expect(container.querySelector('#completion-title')?.textContent).toContain(
      'What a world',
    );
    expect(
      container.querySelector('.completion-breakdown')?.textContent,
    ).toContain('14 skipped');
    expect(container.querySelectorAll('.review-row')).toHaveLength(14);
    await click(button('Explore again'));
    expect(flag()).toBe('/flags/au.svg');
    expect(container.querySelector('.round-progress')?.textContent).toContain(
      'Flag 1 / 14',
    );
  });

  it('opens mobile settings with unique labels and applies the same controls', async () => {
    await render();
    await click(button('Open game settings'));
    const dialog = container.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    const ids = [...container.querySelectorAll('[id]')].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    await click(button('Deselect all', dialog));
    expect(button('Apply & start round', dialog).disabled).toBe(true);
    await click(
      dialog.querySelectorAll<HTMLInputElement>('.continent-option input')[5],
    );
    await click(button('Apply & start round', dialog));
    expect(container.querySelector('dialog')).toBeNull();
    expect(flag()).toBe('/flags/au.svg');
  });

  it('prevents rapid double advancement and exposes hints after a wrong guess', async () => {
    await render({ mode: 'linear', continents: ['Europe'] });
    vi.mocked(Date.now).mockReturnValue(200_000);
    await answer('Albania');
    await click(button('Next flag'));
    expect(container.querySelector('.result-message')?.textContent).toContain(
      'Albania',
    );
    vi.mocked(Date.now).mockReturnValue(200_500);
    await click(button('Next flag'));
    expect(flag()).toBe('/flags/ad.svg');
    vi.mocked(Date.now).mockReturnValue(201_000);
    await answer('Austria');
    await click(button('Need a hint?'));
    expect(container.querySelector('#answer-feedback')?.textContent).toContain(
      'Europe',
    );
    expect(
      container.querySelector('[data-testid="incorrect-count"]')?.textContent,
    ).toBe('1');
  });

  it('requires a deliberate restart once the round has progress', async () => {
    await render({ mode: 'linear', continents: ['Europe'] });
    await answer('Albania');
    await click(button('New round'));
    expect(container.querySelector('dialog')?.textContent).toContain(
      'resets your current score',
    );
    await click(button('Keep exploring'));
    expect(container.querySelector('.result-message')?.textContent).toContain(
      'Albania',
    );
    await click(button('New round'));
    await click(button('Start new round'));
    expect(
      container.querySelector('[data-testid="correct-count"]')?.textContent,
    ).toBe('0');
    expect(flag()).toBe('/flags/al.svg');
  });
});
