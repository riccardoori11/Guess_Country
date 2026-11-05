// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { CONTINENTS, countries, type Continent } from './data/countries';
import { LETTERS } from './lib/filters';
import { PREFERENCES_KEY } from './lib/preferences';
import type { Preferences } from './lib/game';
import { THEME_KEY, type ThemePreference } from './lib/theme';

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
async function render(preferences: Partial<Preferences> = {}) {
  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({
      mode: 'linear',
      continents: [...CONTINENTS],
      letters: [...LETTERS],
      ...preferences,
    }),
  );
  await act(async () => {
    root.render(<App />);
  });
}
async function typeAnswer(value: string) {
  const input =
    container.querySelector<HTMLInputElement>('#country-answer')!;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function answer(value: string) {
  await typeAnswer(value);
  await act(async () => {
    container
      .querySelector('form')!
      .dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
  });
}
function flag() {
  return container.querySelector('.country-flag')?.getAttribute('src');
}
function continent(name: Continent, scope: ParentNode = container) {
  return scope.querySelectorAll<HTMLInputElement>(
    '.continent-option input',
  )[CONTINENTS.indexOf(name)];
}
async function chooseTheme(theme: ThemePreference) {
  const summary = container.querySelector<HTMLElement>(
    '.theme-picker summary',
  )!;
  const option = container
    .querySelector<HTMLInputElement>(
      `.theme-picker input[value="${theme}"]`,
    )!
    .closest('label')!
    .querySelector<HTMLElement>('span')!;
  await act(async () => {
    summary.focus();
    summary.click();
  });
  await act(async () => {
    option.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'mouse',
      }),
    );
    summary.blur();
  });
  expect(
    container.querySelector<HTMLDetailsElement>('.theme-picker')?.open,
  ).toBe(true);
  await click(option);
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

describe('letter filter interface', () => {
  it('starts with all 26 letters selected and all 195 countries eligible', async () => {
    await render();
    const letters = container.querySelectorAll('.letter-option');
    expect(
      [...letters].map((element) => element.textContent).join(''),
    ).toBe(LETTERS.join(''));
    expect(
      [...letters].every(
        (element) => element.getAttribute('aria-pressed') === 'true',
      ),
    ).toBe(true);
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('195 countries');
    expect(
      container.querySelector('.letter-section h3')?.textContent,
    ).toBe('Filter by Letter');
  });

  it('updates counts for single and nonconsecutive letters and supports both bulk controls', async () => {
    await render();
    await click(button('Deselect all letters'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('0 countries');
    expect(
      container.querySelector('.empty-selection')?.textContent,
    ).toContain('Choose at least one letter');
    expect(button('Apply & start round').disabled).toBe(true);
    expect(button('New round').disabled).toBe(true);
    await click(button('Countries starting with J'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('3 countries');
    await click(button('Countries starting with A'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('14 countries');
    await click(button('Countries starting with J'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('11 countries');
    await click(button('Select all letters'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('195 countries');
    await click(button('Deselect all continents'));
    expect(container.querySelector('.empty-selection')?.textContent).toBe(
      'Choose at least one continent to start a round.',
    );
    await click(button('Deselect all letters'));
    expect(
      container.querySelector('.empty-selection')?.textContent,
    ).toContain('one continent and one letter');
  });

  it.each([
    {
      continents: [...CONTINENTS],
      letters: [],
      message: 'Choose at least one letter',
    },
    {
      continents: [],
      letters: [],
      message: 'one continent and one letter',
    },
    {
      continents: ['Europe'] as Continent[],
      letters: ['J'] as const,
      message: 'No countries match',
    },
  ])(
    'restores an empty pool with the appropriate explanation: $message',
    async ({ continents, letters, message }) => {
      await render({ continents, letters: [...letters] });
      expect(
        container.querySelector('.empty-game')?.textContent,
      ).toContain(message);
      expect(
        container.querySelector('.empty-selection')?.textContent,
      ).toContain(message);
      expect(container.querySelector('#country-answer')).toBeNull();
      expect(button('Start a new round').disabled).toBe(true);
      expect(button('New round').disabled).toBe(true);
    },
  );

  it('handles zero matches without ending the active round and applies the intersection when valid', async () => {
    await render({ continents: ['Europe'] });
    await click(button('Deselect all letters'));
    await click(button('Countries starting with J'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('0 countries');
    expect(
      container.querySelector('.empty-selection')?.textContent,
    ).toContain('No countries match');
    await click(button('Apply & start round'));
    expect(flag()).toBe('/flags/al.svg');
    expect(
      container.querySelector('.round-progress')?.textContent,
    ).toContain('Flag 1 / 44');
    await click(button('Deselect all continents'));
    await click(continent('Asia'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('2 countries');
    await click(button('Apply & start round'));
    expect(flag()).toBe('/flags/jp.svg');
    expect(
      container.querySelector('.round-progress')?.textContent,
    ).toContain('Flag 1 / 2');
    expect(
      container.querySelector('.game-mode-badge')?.textContent,
    ).toContain('Linear mode');
    expect(
      container.querySelector('.round-filters')?.textContent,
    ).toContain('Letters J');
  });

  it('preserves the guess, hint, and active settings while editing mobile filters', async () => {
    await render({ continents: ['Europe'], letters: ['A'] });
    await typeAnswer('Alba');
    await click(button('Need a hint?'));
    await click(button('Open game settings'));
    const dialog = container.querySelector('dialog')!;
    expect(dialog.querySelectorAll('.letter-option')).toHaveLength(26);
    await click(button('Deselect all letters', dialog));
    await click(button('Countries starting with J', dialog));
    await click(button('Random', dialog));
    expect(button('Apply & start round', dialog).disabled).toBe(true);
    await click(button('Close dialog', dialog));
    expect(
      container.querySelector<HTMLInputElement>('#country-answer')?.value,
    ).toBe('Alba');
    expect(
      container.querySelector('#answer-feedback')?.textContent,
    ).toContain('Europe');
    expect(flag()).toBe('/flags/al.svg');
    expect(
      container.querySelector('.round-progress')?.textContent,
    ).toContain('Flag 1 / 3');
    expect(
      container.querySelector('.game-mode-badge')?.textContent,
    ).toContain('Linear mode');
    expect(
      container.querySelector('.round-filters')?.textContent,
    ).toContain('Letters A');
    expect(button('New round').disabled).toBe(true);
    await click(button('Countries starting with A'));
    await click(button('Apply & start round'));
    expect(['/flags/al.svg', '/flags/ad.svg', '/flags/at.svg']).toContain(
      flag(),
    );
    expect(
      container.querySelector<HTMLInputElement>('#country-answer')?.value,
    ).toBe('');
    expect(button('Need a hint?').disabled).toBe(false);
    expect(container.querySelector('.game-mode-badge')?.textContent).toBe(
      'Random mode',
    );
  });

  it.each(['linear', 'random'] as const)(
    'finishes a filtered %s round without repeats and restarts with changed letters',
    async (mode) => {
      await render({
        mode,
        continents: ['South America'],
        letters: ['B'],
      });
      const seen: string[] = [];
      for (let i = 0; i < 2; i++) {
        seen.push(flag()!);
        expect(
          container.querySelector('.round-progress')?.textContent,
        ).toContain(`Flag ${i + 1} / 2`);
        await click(button('Skip'));
        await click(button(i === 1 ? 'See your results' : 'Next flag'));
      }
      expect(seen.sort()).toEqual(['/flags/bo.svg', '/flags/br.svg']);
      expect(container.querySelectorAll('.review-row')).toHaveLength(2);
      expect(
        container.querySelector('.completion-breakdown')?.textContent,
      ).toContain('2 skipped');
      await click(button('Deselect all letters'));
      expect(button('Explore again').disabled).toBe(true);
      expect(button('New round').disabled).toBe(true);
      await click(button('Countries starting with P'));
      await click(button('Explore again'));
      expect(['/flags/py.svg', '/flags/pe.svg']).toContain(flag());
      expect(
        container.querySelector('.round-progress')?.textContent,
      ).toContain('Flag 1 / 2');
      expect(
        container.querySelector('.game-mode-badge')?.textContent,
      ).toContain(`${mode === 'random' ? 'Random' : 'Linear'} mode`);
      expect(
        container.querySelector('.score-details')?.textContent,
      ).toContain('Skipped0');
      expect(container.querySelectorAll('.history-chip')).toHaveLength(0);
    },
  );

  it('restores saved letters, continents, and mode after remounting', async () => {
    await render({
      mode: 'random',
      continents: ['Asia'],
      letters: ['A', 'J'],
    });
    await click(button('Countries starting with Z'));
    await click(continent('Europe'));
    await click(button('Linear'));
    expect(
      JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).letters,
    ).toEqual(['A', 'J', 'Z']);
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });
    expect(
      [
        ...container.querySelectorAll(
          '.letter-option[aria-pressed="true"]',
        ),
      ].map((element) => element.textContent),
    ).toEqual(['A', 'J', 'Z']);
    expect(continent('Asia').checked).toBe(true);
    expect(continent('Europe').checked).toBe(true);
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('8 countries');
    expect(
      container.querySelector('.game-mode-badge')?.textContent,
    ).toContain('Linear mode');
    expect(flag()).toBe('/flags/af.svg');
  });

  it('applies pending mode, continent, and letter selections through the header restart', async () => {
    await render({ continents: ['Europe'], letters: ['A'] });
    await answer('Albania');
    await click(button('Deselect all continents'));
    await click(continent('Asia'));
    await click(button('Deselect all letters'));
    await click(button('Countries starting with J'));
    await click(button('Random'));
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('1');
    await click(button('New round'));
    expect(container.querySelector('dialog')?.textContent).toContain(
      'updated mode, continent, and letter selections',
    );
    await click(button('Start new round'));
    expect(['/flags/jp.svg', '/flags/jo.svg']).toContain(flag());
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('0');
    expect(
      container.querySelector('.round-progress')?.textContent,
    ).toContain('Flag 1 / 2');
    expect(
      container.querySelector('.round-filters')?.textContent,
    ).toContain('Letters J');
    expect(container.querySelector('.game-mode-badge')?.textContent).toBe(
      'Random mode',
    );
    expect(container.querySelectorAll('.history-chip')).toHaveLength(0);
  });

  it('resets answer, hints, and attempts on apply even when the first country stays the same', async () => {
    await render();
    await answer('Albania');
    await click(button('Need a hint?'));
    await click(button('Deselect all letters'));
    await click(button('Countries starting with A'));
    await click(button('Apply & start round'));
    expect(flag()).toBe('/flags/af.svg');
    expect(
      container.querySelector<HTMLInputElement>('#country-answer')?.value,
    ).toBe('');
    expect(
      container.querySelector('[data-testid="incorrect-count"]')
        ?.textContent,
    ).toBe('0');
    expect(
      container.querySelector('.round-progress')?.textContent,
    ).toContain('Flag 1 / 11');
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('0');
    expect(button('Need a hint?').disabled).toBe(false);
    expect(container.querySelector('#country-answer')).toBe(
      document.activeElement,
    );
  });
});

describe('game interface', () => {
  it('renders a complete, focused game with accessible flag and answer labels', async () => {
    await render();
    expect(flag()).toBe('/flags/af.svg');
    expect(container.querySelector('#country-answer')).toBe(
      document.activeElement,
    );
    expect(
      container.querySelector('.country-flag')?.getAttribute('alt'),
    ).toBe('Mystery country flag');
    expect(
      container
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuemax'),
    ).toBe('195');
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('0');
  });

  it('supports wrong guesses, retry, correct feedback, and next-flag navigation', async () => {
    await render({ mode: 'linear', continents: ['Europe'] });
    await answer('Austria');
    expect(
      container.querySelector('#answer-feedback')?.textContent,
    ).toContain('Not quite');
    expect(
      container.querySelector('[data-testid="incorrect-count"]')
        ?.textContent,
    ).toBe('1');
    await answer('Austria');
    expect(
      container.querySelector('[data-testid="incorrect-count"]')
        ?.textContent,
    ).toBe('1');
    await answer(' alBANia  ');
    expect(
      container.querySelector('.result-message')?.textContent,
    ).toContain('Albania');
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
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
    expect(
      container.querySelector('#answer-feedback')?.textContent,
    ).toContain('Oceania');
    await click(button('Reveal answer'));
    expect(
      container.querySelector('.result-message')?.textContent,
    ).toContain('Australia');
    expect(button('Reveal answer').disabled).toBe(true);
    await click(button('Next flag'));
    await click(button('Skip'));
    expect(
      container.querySelector('.result-message')?.textContent,
    ).toContain('Fiji');
    const details =
      container.querySelector('.score-details')!.textContent!;
    expect(details).toContain('Skipped1');
    expect(details).toContain('Revealed1');
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('0');
  });

  it('disables starting with no continents and regenerates the selected pool', async () => {
    await render();
    await click(button('Deselect all'));
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('0 countries');
    expect(button('Apply & start round').disabled).toBe(true);
    expect(
      container.querySelector('.empty-selection')?.textContent,
    ).toContain('Choose at least one');
    const boxes = container.querySelectorAll<HTMLInputElement>(
      '.continent-option input',
    );
    await click(boxes[1]); // Asia
    await click(boxes[2]); // Europe
    expect(
      container.querySelector('.country-pool')?.textContent,
    ).toContain('92 countries');
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
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
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
    expect(
      container.querySelector('#completion-title')?.textContent,
    ).toContain('What a world');
    expect(
      container.querySelector('.completion-breakdown')?.textContent,
    ).toContain('14 skipped');
    expect(container.querySelectorAll('.review-row')).toHaveLength(14);
    await click(button('Explore again'));
    expect(flag()).toBe('/flags/au.svg');
    expect(
      container.querySelector('.round-progress')?.textContent,
    ).toContain('Flag 1 / 14');
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
      dialog.querySelectorAll<HTMLInputElement>(
        '.continent-option input',
      )[5],
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
    expect(
      container.querySelector('.result-message')?.textContent,
    ).toContain('Albania');
    vi.mocked(Date.now).mockReturnValue(200_500);
    await click(button('Next flag'));
    expect(flag()).toBe('/flags/ad.svg');
    vi.mocked(Date.now).mockReturnValue(201_000);
    await answer('Austria');
    await click(button('Need a hint?'));
    expect(
      container.querySelector('#answer-feedback')?.textContent,
    ).toContain('Europe');
    expect(
      container.querySelector('[data-testid="incorrect-count"]')
        ?.textContent,
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
    expect(
      container.querySelector('.result-message')?.textContent,
    ).toContain('Albania');
    await click(button('New round'));
    await click(button('Start new round'));
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('0');
    expect(flag()).toBe('/flags/al.svg');
  });
});

describe('answer history', () => {
  function group(outcome: 'correct' | 'incorrect') {
    return container.querySelector<HTMLElement>(
      `.history-group--${outcome}`,
    )!;
  }

  function names(outcome: 'correct' | 'incorrect') {
    return [
      ...group(outcome).querySelectorAll('.history-chip > span'),
    ].map((element) => element.textContent);
  }

  it('replaces recent stops with two counted categories and helpful empty states', async () => {
    await render();
    expect(container.textContent).not.toContain('YOUR RECENT STOPS');
    expect(group('correct').querySelector('h2')?.textContent).toBe(
      'Correct Answers0',
    );
    expect(group('incorrect').querySelector('h2')?.textContent).toBe(
      'Incorrect Answers0',
    );
    expect(
      group('correct').querySelector('.history-empty')?.textContent,
    ).toContain('Countries you identify');
    expect(
      group('incorrect').querySelector('.history-empty')?.textContent,
    ).toContain('Revealed and skipped countries');
    expect(container.querySelectorAll('.history-chip')).toHaveLength(0);
  });

  it('uses final country outcomes while keeping individual wrong attempts separate', async () => {
    await render({ continents: ['Europe'], letters: ['A'] });
    await answer('wrong');
    await answer('another wrong guess');
    expect(names('correct')).toEqual([]);
    expect(names('incorrect')).toEqual([]);
    expect(
      container.querySelector('[data-testid="incorrect-count"]')
        ?.textContent,
    ).toBe('2');

    await answer('Albania');
    expect(names('correct')).toEqual(['Albania']);
    expect(names('incorrect')).toEqual([]);
    expect(
      group('correct').querySelector('img')?.getAttribute('src'),
    ).toBe('/flags/al.svg');

    await click(button('Next flag'));
    await answer('wrong');
    await click(button('Reveal answer'));
    expect(names('incorrect')).toEqual(['Andorra']);
    expect(button('Reveal answer').disabled).toBe(true);
    await click(button('Reveal answer'));
    expect(names('incorrect')).toEqual(['Andorra']);

    await click(button('Next flag'));
    await click(button('Skip'));
    expect(names('correct')).toEqual(['Albania']);
    expect(names('incorrect')).toEqual(['Andorra', 'Austria']);
    expect(
      group('incorrect').querySelector('.history-count')?.textContent,
    ).toBe('2');
    expect(
      container.querySelector('[data-testid="incorrect-count"]')
        ?.textContent,
    ).toBe('3');
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('1');
    expect(group('incorrect').querySelectorAll('.lucide-x')).toHaveLength(
      3,
    );

    await click(button('See your results'));
    expect(names('correct')).toEqual(['Albania']);
    expect(names('incorrect')).toEqual(['Andorra', 'Austria']);
    expect(container.querySelectorAll('.review-row')).toHaveLength(3);
  });

  it.each(['linear', 'random'] as const)(
    'keeps every result from a filtered %s round through completion and clears on restart',
    async (mode) => {
      await render({
        mode,
        continents: ['Europe', 'Oceania'],
        letters: ['A', 'F', 'S'],
      });
      const eligibleIds = [
        'al',
        'ad',
        'au',
        'at',
        'fj',
        'fi',
        'fr',
        'ws',
        'sm',
        'rs',
        'sk',
        'si',
        'sb',
        'es',
        'se',
        'ch',
      ];
      const correct: string[] = [];
      const incorrect: string[] = [];
      const seen: string[] = [];

      for (let i = 0; i < eligibleIds.length; i++) {
        const current = countries.find(
          (country) => country.flag === flag(),
        )!;
        expect(eligibleIds).toContain(current.id);
        expect(seen).not.toContain(current.id);
        seen.push(current.id);
        if (i % 2 === 0) {
          await answer(current.name);
          correct.push(current.name);
        } else {
          await click(button(i % 4 === 1 ? 'Reveal answer' : 'Skip'));
          incorrect.push(current.name);
        }
        expect(names('correct')).toEqual(correct);
        expect(names('incorrect')).toEqual(incorrect);
        await click(
          button(
            i === eligibleIds.length - 1
              ? 'See your results'
              : 'Next flag',
          ),
        );
      }

      expect(seen.sort()).toEqual(eligibleIds.sort());
      expect(container.querySelector('#completion-title')).not.toBeNull();
      expect(names('correct')).toEqual(correct);
      expect(names('incorrect')).toEqual(incorrect);
      expect(correct).toHaveLength(8);
      expect(incorrect).toHaveLength(8);
      expect(
        group('correct').querySelector('.history-count')?.textContent,
      ).toBe('8');
      expect(
        group('incorrect').querySelector('.history-count')?.textContent,
      ).toBe('8');
      expect(container.querySelectorAll('.review-row')).toHaveLength(16);
      expect(
        container.querySelector('[data-testid="incorrect-count"]')
          ?.textContent,
      ).toBe('0');

      await click(button('Explore again'));
      expect(names('correct')).toEqual([]);
      expect(names('incorrect')).toEqual([]);
      expect(container.querySelectorAll('.history-empty')).toHaveLength(2);
      expect(
        group('correct').querySelector('.history-count')?.textContent,
      ).toBe('0');
      expect(
        group('incorrect').querySelector('.history-count')?.textContent,
      ).toBe('0');
    },
  );

  it('preserves the active history while editing filters and clears it when applying a new round', async () => {
    await render({ continents: ['Europe'], letters: ['A'] });
    await answer('Albania');
    await click(button('Next flag'));
    await click(button('Skip'));
    await click(button('Deselect all continents'));
    await click(continent('Asia'));
    await click(button('Deselect all letters'));
    await click(button('Countries starting with J'));
    await click(button('Random'));
    expect(names('correct')).toEqual(['Albania']);
    expect(names('incorrect')).toEqual(['Andorra']);

    await click(button('Apply & start round'));
    expect(names('correct')).toEqual([]);
    expect(names('incorrect')).toEqual([]);
    const current = countries.find((country) => country.flag === flag())!;
    expect(['jp', 'jo']).toContain(current.id);
    await answer(current.name);
    expect(names('correct')).toEqual([current.name]);
    expect(names('incorrect')).toEqual([]);
  });

  it('keeps country names readable if a history flag fails to load', async () => {
    await render({ continents: ['Europe'], letters: ['A'] });
    await answer('Albania');
    const image = group('correct').querySelector('img')!;
    await act(async () => {
      image.dispatchEvent(new Event('error'));
    });
    expect(image.style.visibility).toBe('hidden');
    expect(names('correct')).toEqual(['Albania']);
    expect(
      group('correct').querySelector('.history-count')?.textContent,
    ).toBe('1');
  });
});

describe('appearance and game state', () => {
  it.each(['linear', 'random'] as const)(
    'preserves the %s round, score, progress, and filters through every appearance',
    async (mode) => {
      await render({ mode, continents: ['Europe'], letters: ['A'] });
      const current = countries.find(
        (country) => country.flag === flag(),
      )!;
      await answer(current.name);
      const savedGamePreferences = localStorage.getItem(PREFERENCES_KEY);
      for (const theme of ['dark', 'light', 'system'] as const) {
        await chooseTheme(theme);
        expect(localStorage.getItem(THEME_KEY)).toBe(theme);
        expect(localStorage.getItem(PREFERENCES_KEY)).toBe(
          savedGamePreferences,
        );
        expect(flag()).toBe(current.flag);
        expect(
          container.querySelector('.result-message')?.textContent,
        ).toContain(current.name);
        expect(
          container.querySelector('[data-testid="correct-count"]')
            ?.textContent,
        ).toBe('1');
        expect(
          container
            .querySelector('[role="progressbar"]')
            ?.getAttribute('aria-valuenow'),
        ).toBe('1');
        expect(
          container.querySelector('.round-progress')?.textContent,
        ).toContain('Flag 1 / 3');
        expect(
          container.querySelector('.game-mode-badge')?.textContent,
        ).toContain(`${mode === 'random' ? 'Random' : 'Linear'} mode`);
        expect(container.querySelectorAll('.history-chip')).toHaveLength(
          1,
        );
      }
      await click(button('Next flag'));
      expect(flag()).not.toBe(current.flag);
      expect(
        container.querySelector('.round-progress')?.textContent,
      ).toContain('Flag 2 / 3');
    },
  );

  it('preserves typed guesses, hints, and pending filter/mode edits when switching themes', async () => {
    await render({ continents: ['Asia'], letters: ['J'] });
    await typeAnswer('Ja');
    await click(button('Need a hint?'));
    await click(button('Countries starting with A'));
    await click(button('Random'));
    const preferences = localStorage.getItem(PREFERENCES_KEY);
    for (const theme of ['dark', 'light'] as const) {
      await chooseTheme(theme);
      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(flag()).toBe('/flags/jp.svg');
      expect(
        container.querySelector<HTMLInputElement>('#country-answer')
          ?.value,
      ).toBe('Ja');
      expect(
        container.querySelector('#answer-feedback')?.textContent,
      ).toContain('Asia');
      expect(
        container.querySelector('.round-progress')?.textContent,
      ).toContain('Flag 1 / 2');
      expect(
        container.querySelector('.game-mode-badge')?.textContent,
      ).toContain('Linear mode');
      expect(
        container.querySelector('.mode-switch button[aria-pressed="true"]')
          ?.textContent,
      ).toBe('Random');
      expect(
        button('Countries starting with A').getAttribute('aria-pressed'),
      ).toBe('true');
      expect(button('Apply & start round').disabled).toBe(false);
      expect(localStorage.getItem(PREFERENCES_KEY)).toBe(preferences);
    }
  });

  it('follows OS changes while settings are open without resetting guesses or attempts', async () => {
    let dark = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: () => void) => {
        listeners.delete(listener);
      },
    } as MediaQueryList);
    await render({ continents: ['Asia'], letters: ['J'] });
    await answer('Canada');
    await click(button('Need a hint?'));
    await click(button('Open game settings'));
    await act(async () => {
      dark = true;
      for (const listener of listeners) listener();
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(container.querySelector('dialog')?.open).toBe(true);
    expect(
      container.querySelector('[data-testid="incorrect-count"]')
        ?.textContent,
    ).toBe('1');
    await click(button('Close dialog'));
    expect(flag()).toBe('/flags/jp.svg');
    expect(
      container.querySelector<HTMLInputElement>('#country-answer')?.value,
    ).toBe('Canada');
    expect(
      container.querySelector('#answer-feedback')?.textContent,
    ).toContain('Asia');
  });

  it('preserves completion results and modals while retaining appearance through a deliberate restart', async () => {
    await render({ continents: ['Oceania'], letters: ['A'] });
    await answer('Australia');
    await click(button('See your results'));
    await chooseTheme('dark');
    expect(container.querySelector('#completion-title')).not.toBeNull();
    expect(container.querySelectorAll('.review-row')).toHaveLength(1);
    await click(button('How to play'));
    expect(container.querySelector('dialog')?.open).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    await click(button('Close dialog'));
    await chooseTheme('light');
    expect(container.querySelector('#completion-title')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('1');
    await click(button('Explore again'));
    expect(flag()).toBe('/flags/au.svg');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(
      container.querySelector('[data-testid="correct-count"]')
        ?.textContent,
    ).toBe('0');
  });
});
