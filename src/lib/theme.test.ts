import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_KEY,
  THEME_PAGE_COLORS,
} from './theme';

describe('theme preferences', () => {
  it('defaults to System Default for new, invalid, or inaccessible storage', () => {
    for (const saved of [
      null,
      '',
      'invalid',
      'LIGHT',
      '{"theme":"dark"}',
    ]) {
      expect(loadThemePreference({ getItem: () => saved })).toBe('system');
    }
    expect(
      loadThemePreference({
        getItem: () => {
          throw new Error('Denied');
        },
      }),
    ).toBe('system');
  });

  it.each(['light', 'dark', 'system'] as const)(
    'persists and restores %s',
    (preference) => {
      const data = new Map<string, string>();
      const storage = {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
          data.set(key, value);
        },
      };
      saveThemePreference(preference, storage);
      expect(data.get(THEME_KEY)).toBe(preference);
      expect(loadThemePreference(storage)).toBe(preference);
    },
  );

  it('keeps explicit modes independent of the OS and resolves System Default in both schemes', () => {
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    for (const systemIsDark of [true, false]) {
      expect(resolveTheme('light', systemIsDark)).toBe('light');
      expect(resolveTheme('dark', systemIsDark)).toBe('dark');
    }
  });

  it('handles blocked or full storage when saving without disrupting the app', () => {
    expect(() =>
      saveThemePreference('dark', {
        setItem: () => {
          throw new Error('Full');
        },
      }),
    ).not.toThrow();
  });
});

// Check the actual palette values used by the app, including small status text.
function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}

describe('shared theme palettes', () => {
  const css = readFileSync('src/theme.css', 'utf8');
  const blocks = [
    ...css.matchAll(/:root(?:\[data-theme='dark'\])?\s*\{([^}]+)\}/g),
  ];
  const palettes = blocks.map((block) =>
    Object.fromEntries(
      [...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/g)].map(
        (match) => [match[1], match[2]],
      ),
    ),
  );

  it('defines the same semantic colors for Light and Dark', () => {
    expect(palettes).toHaveLength(2);
    expect(Object.keys(palettes[0]).sort()).toEqual(
      Object.keys(palettes[1]).sort(),
    );
    expect(palettes[0]['page-bg']).toBe(THEME_PAGE_COLORS.light);
    expect(palettes[1]['page-bg']).toBe(THEME_PAGE_COLORS.dark);
  });

  it.each(['light', 'dark'])(
    'keeps %s text and interactive states above WCAG AA contrast',
    (theme) => {
      const palette = palettes[theme === 'light' ? 0 : 1];
      const pairs = [
        ['text', 'page-bg'],
        ['text', 'surface'],
        ['text-secondary', 'surface-elevated'],
        ['text-muted', 'surface-muted'],
        ['text-faint', 'page-bg'],
        ['text-faint', 'surface-muted'],
        ['accent', 'accent-soft'],
        ['accent', 'surface'],
        ['on-accent', 'accent'],
        ['on-accent', 'accent-hover'],
        ['success', 'success-bg'],
        ['success', 'success-icon-bg'],
        ['error', 'error-bg'],
        ['error', 'surface'],
        ['warning', 'warning-bg'],
      ];
      for (const [foreground, background] of pairs) {
        expect(
          contrast(palette[foreground], palette[background]),
          `${theme}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(palette.focus, palette.surface),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it('uses tokens for every interface color and respects reduced motion', () => {
    const styles = readFileSync('src/styles.css', 'utf8');
    expect(styles).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/\binvert\(/);
  });
});
