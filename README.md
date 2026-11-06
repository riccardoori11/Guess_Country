# FlagAtlas

Identify countries by their flags.

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

## Hosting

The production site is static: visitors do not need Node, npm, or a running
development server. [DEPLOYMENT.md](DEPLOYMENT.md) explains connecting a
**private GitHub repository to Cloudflare Pages**, including the exact build
settings, security review, updates, and rollback. No deployment has been
triggered by adding these files.

## Play

- Type the country name; press Enter or select **Check answer**.
- Wrong guesses can be retried. A continent hint is free; **Reveal answer** and **Skip** resolve the flag without a correct answer. **Next flag** advances after an answer, skip, or reveal.
- Random mode uses a Fisher–Yates shuffle, without repeats. Linear mode uses explicit English alphabetical collation, independent of checkbox order and browser locale.
- Select any combination of continents and starting letters, independently of Linear/Random mode, then choose **Apply & start round**. Each country must match both filters. All A–Z letters are selected by default.
- The round ends after every eligible country is resolved and advanced. Results include the full country review and a restart option.
- On smaller screens, the settings icon in the header opens the same controls in a dialog.

## Filter behavior

**Filter by Letter** uses the first letter of each canonical country name. Aliases are still accepted as answers but do not change classification: Côte d’Ivoire is under C (even if you answer “Ivory Coast”), Myanmar is under M, and Vatican City is under V. Accents are normalized for the English A–Z grid.

| Selected continents | Selected letters | Eligible countries        |
| ------------------- | ---------------- | ------------------------- |
| Europe              | A                | Albania, Andorra, Austria |
| Asia                | J                | Japan, Jordan             |
| South America       | B                | Bolivia, Brazil           |
| Africa              | M, N             | 10 countries              |

**During a round:** Editing mode, continents, or letters updates the available count immediately. The current flag, guess, hint, score, and sequence continue until you start another round. **Apply & start round**, the header’s **New round**, and **Explore again** all apply the current settings and reset all progress and statistics. The header asks for confirmation when you have made progress. Linear sorts the resulting pool alphabetically; Random shuffles that same pool once, without repeats.

**Empty selections:** Selecting no continents means zero eligible countries, never “all continents.” Selecting no letters also means zero countries. Both cases disable every start/restart control and explain what to select. A nonempty selection with no matches (such as Europe + J, or any continent + X) also disables starting and asks you to adjust your filters. An existing round can still be played while draft filters have no matches.

**Saved settings:** Mode, continents, and letters are saved automatically in this browser. Existing saved preferences from before letter filtering retain their mode and continents and default to all letters. An intentionally empty selection stays empty. Reloading uses the saved settings to set up a fresh round, with guidance if there are no eligible countries.

The pure intersection filter lives in `src/lib/filters.ts`; ordering, shuffling, answer validation, and scoring stay in `src/lib/game.ts`.

## Appearance

Use the appearance control in the header to choose **Light Mode**, **Dark Mode**, or **System Default**. On smaller screens, its sun, moon, or monitor icon shows the selected option. The open picker marks the current selection and supports keyboard controls, Escape, and clicking outside to dismiss.

New visitors follow their device’s color scheme. System Default responds to OS appearance changes while the game is open; explicit Light/Dark selections stay fixed. The selection is saved separately from gameplay preferences under `flag-atlas:appearance:v1`. Unavailable storage falls back safely and still allows switching for the current visit.

A small script in the document head sets the scheme and background before React or application styles load to avoid a flash of the wrong theme. `src/lib/theme.ts` and `src/lib/useTheme.ts` handle persistence and system updates; `src/theme.css` defines shared semantic color tokens for both appearances. Layout and component styles are shared. Country flag artwork retains its original colors. Color transitions respect `prefers-reduced-motion`.

Appearance changes preserve the current flag, typed guess, feedback, hint, scores, progress, filters (including unapplied changes), and game mode. The test suite covers theme persistence, the early bootstrap, system preference changes, listener cleanup, UI controls, game-state preservation, and AA contrast for text and status colors in both palettes.
