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

## Play

- Type the country name; press Enter or select **Check answer**.
- Wrong guesses can be retried. A continent hint is free; **Reveal answer** and **Skip** resolve the flag without a correct answer. **Next flag** advances after an answer, skip, or reveal.
- Random mode uses a Fisher–Yates shuffle, without repeats. Linear mode uses explicit English alphabetical collation, independent of checkbox order and browser locale.
- Select any combination of continents and choose **Apply & start round**. This generates a fresh round and resets scores. **Deselect all** disables starting and explains how to continue.
- The round ends after every eligible country is resolved and advanced. Results include the full country review and a restart option.
- On smaller screens, the settings icon in the header opens the same controls in a dialog.
