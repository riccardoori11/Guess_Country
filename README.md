Try to guess the country by their flag

## Run locally

Requires **Node.js 22.12+** (or Node 20.19+) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

```sh
npm test          # Game logic, data integrity, local assets, and persistence
npm run check    # Strict TypeScript check
npm run build    # Type check and production build into dist/
npm run preview  # Serve the production build locally
```

The production app is static. Deploy `dist/` to any static host. No backend, API keys, account, or external runtime services are required. Flag images, the map, and the font are served locally.

## Play

- Type the country name; press Enter or select **Check answer**.
- Wrong guesses can be retried. A continent hint is free; **Reveal answer** and **Skip** resolve the flag without a correct answer. **Next flag** advances after an answer, skip, or reveal.
- Random mode uses a Fisher–Yates shuffle, without repeats. Linear mode uses explicit English alphabetical collation, independent of checkbox order and browser locale.
- Select any combination of continents and choose **Apply & start round**. This generates a fresh round and resets scores. **Deselect all** disables starting and explains how to continue.
- The round ends after every eligible country is resolved and advanced. Results include the full country review and a restart option.
- On smaller screens, the settings icon in the header opens the same controls in a dialog.

## Scoring and state

**Guess accuracy** is `correct answers / (correct answers + incorrect attempts)`, rounded to an integer percentage; it is 0 before the first guess. Skips and reveals are reported separately. An incorrect attempt, reveal, or skip resets the current streak. A hint does not reset it. Best streak is per round.

Progress counts resolved countries (correct, revealed, or skipped). The current sequence position remains visible until the player selects Next flag. An unchanged repeated wrong submission counts once; empty answers do not count. Resolved flags cannot receive more guesses. Actions carry a country ID so stale or duplicated advancement cannot advance a different flag. The UI also guards rapid clicks and held Enter keys.

Mode and continent preferences are versioned in localStorage, including a deliberate empty selection. Draft settings are saved automatically and apply to gameplay when a new round starts (or on reload). A round's score and position are in memory and reset on reload. Invalid/blocked storage falls back safely.

## Architecture

React 19 + TypeScript + Vite. No state framework or runtime data API.

```text
src/data/countries.ts       Country records, aliases, continent types and counts
src/lib/game.ts             Pure sequence generation, validation, reducer, and scoring
src/lib/preferences.ts      Validated, failure-tolerant localStorage persistence
src/components/             Game, settings, scores, image fallback, and native dialogs
src/App.tsx                 Round orchestration and shared settings state
src/styles.css              Responsive layout, design system, reduced-motion support
public/flags/               195 committed, original-aspect-ratio SVG flag assets
public/fonts/               Self-hosted DM Sans and OFL license
public/world-map.svg        Decorative Natural Earth map
scripts/download-flags.mjs  Optional asset refresh, outside gameplay
```

Game logic and persistence have no dependency on the UI. The SVG asset test checks coverage and rejects active elements / external image references. Images use object containment and preserve original proportions, including square Switzerland/Vatican City and nonrectangular Nepal. A failed image offers retry while retaining skip and reveal controls. Unknown flags have a neutral alt description so accessible labels do not give away answers. Dialogs use the native modal focus trap, Escape dismissal, and focus restoration. Controls use labels and visible focus states, feedback is announced, and animations respect reduced-motion preferences.

## Dataset and classification

Coverage is the **193 UN member states + two non-member observer states**, Palestine and the Holy See (displayed as Vatican City with its flag). Dependencies, territories, Taiwan, Kosovo, the Cook Islands, and Niue are outside this dataset's UN-based scope.

Each country belongs to exactly one continent, following the [UN M49 geographic regions](https://unstats.un.org/unsd/methodology/m49/), with the Americas divided into North America and South America. North America includes Central America and the Caribbean. Classification is a consistent game convention and does not make a political or territorial claim.

| Continent     | Countries |
| ------------- | --------: |
| Africa        |        54 |
| Asia          |        48 |
| Europe        |        44 |
| North America |        23 |
| South America |        12 |
| Oceania       |        14 |
| **Total**     |   **195** |

Transcontinental cases: Russia is in Europe. Türkiye, Cyprus, Armenia, Azerbaijan, Georgia, Kazakhstan, Indonesia, and Timor-Leste are in Asia. Egypt is in Africa. Overseas territories do not add a country to another continent.

Canonical names use familiar English forms. Explicit aliases include USA/US/United States of America, UK/Great Britain, UAE, Czech Republic, Ivory Coast, Cape Verde, Swaziland, Burma, East Timor, official Korean names, and Holy See. Matching normalizes case, combining diacritics, whitespace, apostrophes, full stops, hyphens, and `&`. It does not use fuzzy or substring matching. Ambiguous answers such as “Korea” and “Congo” are rejected; “Republic of the Congo” and “DR Congo” identify the two distinct countries.

## Asset sources and maintenance

- [UN member states](https://www.un.org/en/about-us/member-states) and [observer states](https://www.un.org/en/about-us/non-member-states): country scope.
- [Flagpedia / Flagcdn](https://flagpedia.net/download/api): public domain SVG flags, downloaded and stored locally on 2026-11-05. [Usage information](https://flagpedia.net/download/vector).
- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/): public domain 1:110m land polygons, converted to the decorative local SVG map.
- [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans): SIL Open Font License 1.1 (included at `public/fonts/OFL.txt`).
- [Lucide](https://lucide.dev/license): ISC-licensed interface icons.

Flag assets are snapshots. To refresh, run `node scripts/download-flags.mjs` with internet access, review the SVG changes, then run the tests. Country data and classifications should be reviewed alongside UN source changes. The game never refreshes flags at runtime.

## Automated coverage

Vitest also exercises the React UI in a browser-like happy-dom environment: correct and incorrect feedback, retry, next, skip, reveal, hints, settings dialogs, empty selections, filter/mode changes, image failure and retry, completion, restart confirmation, and duplicate-action guards.

Logic tests cover full dataset/asset integrity, continent assignments, deterministic ordering, multi-continent selection, an empty selection, unique shuffled sequences, aliases and diacritics, rejected ambiguous/partial answers, duplicate/stale actions, retries, scoring, skips/reveals, streaks, all-195 completion, restart and mode/filter switching, and preference persistence/corruption/storage errors.

## Deliberate limits

Preferences persist; in-progress rounds do not. There are no accounts or cross-device statistics. The initial website load requires a server connection; there is no service worker for offline reloads. Flag and country changes require a reviewed asset/data update.
