# FlagAtlas

A browser-only geography game with two modes: **Guess the Flag** and
**Place the Country**. Both use the same 195 countries, continent and starting
letter filters, and random or sequential (A–Z) order.

```sh
npm ci
npm run dev
```

Switch games with the selector above the playing area. Each mode keeps its
round, filter draft, and progress until the page is reloaded. Filters apply
when you start a new round; empty combinations show a message and cannot start.
The latest filter/order preferences save in this browser, as before.

In Place the Country, select a country’s boundaries or a neutral circle for a
small country. Use zoom buttons, wheel or pinch to zoom and drag to pan; Reset
view restores the world. The map includes keyboard instructions. Correct
locations stay green, wrong locations briefly turn red, and each deliberate
selection counts as an attempt. Use **Next Country** or enable automatic advance
after a correct answer. **Show answer** highlights and centers the country in
amber, records it as revealed, and lets you advance with **Next Country**.
Revealed answers do not earn correct-answer credit. Switching games or opening a dialog pauses advancement.
Starting a new round resets only the active game.

The map ships as local static data with no map API, runtime service, or added
dependencies. See [GEOGRAPHY.md](GEOGRAPHY.md) for data sources, reproducible
generation, small-country access, and boundary/territory classification policy.

Verification: `npm test`, `npm run check`, and `npm run build`. The Vite production
build goes to `dist/` for the existing Cloudflare Pages setup, with no new
environment variables. See [DEPLOYMENT.md](DEPLOYMENT.md) for publishing and
rollback instructions. Feature implementation does not publish the site.

