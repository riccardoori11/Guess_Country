export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const THEME_KEY = 'flag-atlas:appearance:v1';
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';
export const THEME_PAGE_COLORS = { light: '#f6f8fa', dark: '#10191f' };

export function loadThemePreference(
  storage?: Pick<Storage, 'getItem'>,
): ThemePreference {
  try {
    const value = (storage ?? window.localStorage).getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemePreference(
  preference: ThemePreference,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(THEME_KEY, preference);
  } catch {
    /* Appearance still works when browser storage is unavailable. */
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemIsDark: boolean,
): ResolvedTheme {
  return preference === 'system'
    ? systemIsDark
      ? 'dark'
      : 'light'
    : preference;
}

export function systemColorScheme(): MediaQueryList | undefined {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(COLOR_SCHEME_QUERY)
    : undefined;
}

export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.backgroundColor = THEME_PAGE_COLORS[theme];
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_PAGE_COLORS[theme]);
}
