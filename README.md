# FlagAtlas

A browser-only geography game with three modes: **Guess the Flag**,
**Place the Country**, and **Guess the Capital**.

## Multiplayer

Anyone can create a room and share its 6-character code (or the
`?room=CODE` invite link). The room leader (the creator, or whoever they hand
leadership to) picks the game, the time limit (30 sec – 5 min), and the
continent/letter filters, then starts a match. Everyone gets the same shuffled
countries and races to answer the most correctly before time runs out. Ties
are broken by fewer wrong guesses.

If the leader leaves or disconnects, the longest-present player becomes leader.
People who join mid-match play from the next match. Refreshing the page during
a match keeps your score. Rooms are deleted after an hour without activity.

### How it works

- `worker/index.ts` is a Cloudflare Worker that serves the built site from
  `dist/` and the multiplayer API under `/api/*`.
- Each room is a Durable Object (`RoomObject`) holding the room state and
  connected over WebSockets. The server picks the questions and checks every
  answer with the same matching code the solo games use, so scores can't be
  forged from the browser.
- `src/multiplayer/room.ts` contains the room rules (pure functions, unit
  tested); `src/multiplayer/protocol.ts` defines and validates the messages.

## Development

```sh
npm install
npm run dev          # Vite dev server (solo games)
npm run dev:worker   # in a second terminal: local Worker + rooms on :8787
npm test
npm run check        # type-checks the app and the Worker
```

Vite proxies `/api` to the local Worker, so multiplayer works at the Vite URL.
Local room data lives in `.wrangler/` (ignored by Git).

## Deployment

The site deploys as one Cloudflare Worker with static assets (configured in
`wrangler.jsonc`); Durable Objects can't be hosted on Cloudflare Pages alone.
No secrets or environment variables are required.

```sh
npx wrangler login
npm run deploy       # builds, then runs `wrangler deploy`
```
