import { useEffect, useState } from 'react';
import {
  applyTheme,
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  systemColorScheme,
} from './theme';

// Only the appearance picker owns this state. Updating the document's theme
// never changes the game reducer, filters, input, or country sequence.
export function useTheme() {
  const [preference, setPreference] = useState(loadThemePreference);

  useEffect(() => {
    const media = systemColorScheme();
    const update = () =>
      applyTheme(resolveTheme(preference, media?.matches ?? false));
    update();
    saveThemePreference(preference);
    // Enable subtle color transitions only after the initial theme is applied.
    document.documentElement.dataset.themeReady = 'true';
    if (preference !== 'system' || !media) return;
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);

  return [preference, setPreference] as const;
}
