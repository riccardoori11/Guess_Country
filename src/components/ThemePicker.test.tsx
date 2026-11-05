// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ThemePicker } from './ThemePicker';
import {
  applyTheme,
  COLOR_SCHEME_QUERY,
  resolveTheme,
  THEME_KEY,
  THEME_PAGE_COLORS,
  type ThemePreference,
} from '../lib/theme';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
let systemIsDark: boolean;
let listeners: Set<EventListenerOrEventListenerObject>;
let media: MediaQueryList;

async function mount() {
  await act(async () => {
    root.render(<ThemePicker />);
  });
}
async function choose(value: ThemePreference) {
  const summary = container.querySelector('summary')!;
  const visibleLabel = container
    .querySelector<HTMLInputElement>(`input[value="${value}"]`)!
    .closest('label')!
    .querySelector('span')!;
  await act(async () => {
    summary.focus();
    summary.click();
  });
  await act(async () => {
    visibleLabel.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'mouse',
      }),
    );
    summary.blur();
  });
  expect(container.querySelector('details')?.open).toBe(true);
  await act(async () => {
    visibleLabel.click();
  });
}
async function changeSystem(dark: boolean) {
  await act(async () => {
    systemIsDark = dark;
    const event = new Event('change') as MediaQueryListEvent;
    for (const listener of [...listeners]) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-ready');
  document.documentElement.style.cssText = '';
  document.head.innerHTML = '<meta name="theme-color" content="#087e83">';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  systemIsDark = false;
  listeners = new Set();
  media = {
    get matches() {
      return systemIsDark;
    },
    media: COLOR_SCHEME_QUERY,
    addEventListener: (
      _: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      listeners.add(listener);
    },
    removeEventListener: (
      _: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      listeners.delete(listener);
    },
  } as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

describe('appearance control', () => {
  it.each([
    ['light', 'mouse'],
    ['dark', 'mouse'],
    ['light', 'touch'],
    ['dark', 'touch'],
  ] as const)(
    'keeps the visible %s option available through transient blur on %s until its label activates',
    async (preference, pointerType) => {
      await mount();
      const summary = container.querySelector('summary')!;
      const picker = container.querySelector('details')!;
      const input = container.querySelector<HTMLInputElement>(
        `input[value="${preference}"]`,
      )!;
      const visibleLabel = input.closest('label')!.querySelector('span')!;
      await act(async () => {
        summary.focus();
        summary.click();
      });
      expect(picker.open).toBe(true);
      // A pointer press on label text can blur the summary before the label's
      // click forwards activation to its radio. No focus destination is known yet.
      await act(async () => {
        visibleLabel.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerType }),
        );
        summary.blur();
      });
      expect(document.activeElement).toBe(document.body);
      expect(picker.open).toBe(true);
      await act(async () => {
        visibleLabel.click();
      });
      expect(input.checked).toBe(true);
      expect(document.documentElement.dataset.theme).toBe(preference);
      expect(localStorage.getItem(THEME_KEY)).toBe(preference);
      expect(picker.open).toBe(false);
    },
  );

  it.each([
    ['system', 'light'],
    ['system', 'dark'],
    ['light', 'dark'],
    ['dark', 'light'],
    ['light', 'system'],
    ['dark', 'system'],
  ] as const)(
    'switches %s → %s through the visible option and applies only the selected preference',
    async (from, to) => {
      localStorage.setItem(THEME_KEY, from);
      systemIsDark = to !== 'dark'; // Explicit choices initially oppose the OS.
      await mount();
      await choose(to);
      expect(document.documentElement.dataset.theme).toBe(
        resolveTheme(to, systemIsDark),
      );
      expect(
        container.querySelector<HTMLInputElement>(`input[value="${to}"]`)
          ?.checked,
      ).toBe(true);
      expect(container.querySelectorAll('input:checked')).toHaveLength(1);
      expect(container.querySelector('summary')?.textContent).toContain(
        to === 'system'
          ? 'System Default'
          : to === 'dark'
            ? 'Dark Mode'
            : 'Light Mode',
      );
      expect(localStorage.getItem(THEME_KEY)).toBe(to);
      expect(listeners.size).toBe(to === 'system' ? 1 : 0);
      await changeSystem(!systemIsDark);
      expect(document.documentElement.dataset.theme).toBe(
        resolveTheme(to, systemIsDark),
      );
      expect(localStorage.getItem(THEME_KEY)).toBe(to);
    },
  );

  it('defaults to System Default and tracks OS changes without a reload', async () => {
    systemIsDark = true;
    await mount();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(
      container.querySelector<HTMLInputElement>('input[value="system"]')
        ?.checked,
    ).toBe(true);
    expect(
      container.querySelector('summary')?.getAttribute('aria-label'),
    ).toBe('Appearance: System Default');
    await changeSystem(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content'),
    ).toBe(THEME_PAGE_COLORS.light);
  });

  it('selects Light/Dark explicitly, ignores OS changes, and resumes tracking in System Default', async () => {
    await mount();
    await choose('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(listeners.size).toBe(0);
    await changeSystem(true);
    await changeSystem(false);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(container.querySelector('details')?.open).toBe(false);
    expect(container.querySelector('summary')).toBe(
      document.activeElement,
    );
    await choose('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    await changeSystem(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    await choose('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(listeners.size).toBe(1);
    await changeSystem(false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it.each(['light', 'dark', 'system'] as const)(
    'restores selected %s after refreshing and cleans up system listeners',
    async (preference) => {
      await mount();
      expect(listeners.size).toBe(1);
      // Start from a different setting so the visible selection always changes.
      await choose(preference === 'dark' ? 'light' : 'dark');
      await choose(preference);
      await act(async () => {
        root.unmount();
      });
      expect(listeners.size).toBe(0);
      // Refreshing runs the document bootstrap before mounting React again.
      const bootstrap = readFileSync('index.html', 'utf8').match(
        /<script id="theme-init">([\s\S]*?)<\/script>/,
      )![1];
      systemIsDark = preference !== 'dark';
      new Function(bootstrap)();
      expect(document.documentElement.dataset.theme).toBe(
        resolveTheme(preference, systemIsDark),
      );
      root = createRoot(container);
      await mount();
      expect(document.documentElement.dataset.theme).toBe(
        resolveTheme(preference, systemIsDark),
      );
      expect(
        container.querySelector<HTMLInputElement>(
          `input[value="${preference}"]`,
        )?.checked,
      ).toBe(true);
      expect(localStorage.getItem(THEME_KEY)).toBe(preference);
      expect(listeners.size).toBe(preference === 'system' ? 1 : 0);
      await changeSystem(!systemIsDark);
      expect(document.documentElement.dataset.theme).toBe(
        resolveTheme(preference, systemIsDark),
      );
    },
  );

  it('closes with Escape and outside clicks and shows the current selection', async () => {
    await mount();
    const summary = container.querySelector('summary')!;
    await act(async () => {
      summary.click();
    });
    expect(container.querySelector('details')?.open).toBe(true);
    expect(
      container.querySelector('.theme-option.is-selected')?.textContent,
    ).toContain('System Default');
    await act(async () => {
      summary.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(container.querySelector('details')?.open).toBe(false);
    expect(summary).toBe(document.activeElement);
    await act(async () => {
      summary.click();
      document.body.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      );
    });
    expect(container.querySelector('details')?.open).toBe(false);
  });

  it('dismisses the picker when keyboard focus moves outside it', async () => {
    await mount();
    const summary = container.querySelector('summary')!;
    const nextControl = document.createElement('button');
    container.appendChild(nextControl);
    await act(async () => {
      summary.focus();
      summary.click();
      nextControl.focus();
    });
    expect(container.querySelector('details')?.open).toBe(false);
    expect(document.activeElement).toBe(nextControl);
  });

  it('continues working with unavailable localStorage and no matchMedia API', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
    await mount();
    expect(document.documentElement.dataset.theme).toBe('light');
    await choose('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('pre-render appearance bootstrap', () => {
  const html = readFileSync('index.html', 'utf8');
  const bootstrap = html.match(
    /<script id="theme-init">([\s\S]*?)<\/script>/,
  )![1];
  const execute = () => new Function(bootstrap)();

  it.each([
    [null, true, 'dark'],
    [null, false, 'light'],
    ['system', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['invalid', true, 'dark'],
  ] as const)(
    'applies saved %s with system dark=%s before React renders',
    (saved, dark, expected) => {
      systemIsDark = dark;
      if (saved !== null) localStorage.setItem(THEME_KEY, saved);
      execute();
      expect(container.children).toHaveLength(0);
      expect(document.documentElement.dataset.theme).toBe(expected);
      expect(document.documentElement.style.colorScheme).toBe(expected);
      expect(
        document
          .querySelector('meta[name="theme-color"]')
          ?.getAttribute('content'),
      ).toBe(THEME_PAGE_COLORS[expected]);
      const preference =
        saved === 'light' || saved === 'dark' ? saved : 'system';
      expect(expected).toBe(resolveTheme(preference, dark));
      expect(html.indexOf('id="theme-init"')).toBeLessThan(
        html.indexOf('src="/src/main.tsx"'),
      );
    },
  );

  it('still follows the OS when storage cannot be read', () => {
    systemIsDark = true;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    execute();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('can apply a theme without a browser chrome meta tag', () => {
    document.head.innerHTML = '';
    expect(() => applyTheme('dark')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
