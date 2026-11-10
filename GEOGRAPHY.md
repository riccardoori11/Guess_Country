# Country placement geography

The placement game uses the same **195 countries and lowercase ISO 3166-1
alpha-2 IDs** as the flag game. All 195 have a geographic representation,
including Vatican City, Monaco, Nauru and Tuvalu. Names and continent filters
come exclusively from `src/data/countries.ts`, not map labels or name matching.

## Source and reproducibility

The source is Natural Earth's **v5.1.2**, **1:50 million Admin 0 – Countries**
GeoJSON from its maintained vector repository:

- [Pinned GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson)
- [Dataset description](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/)
- [Public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/)
- [Default disputed-boundaries policy](https://www.naturalearthdata.com/about/disputed-boundaries-policy/)
- Input SHA-256: `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`

Download the pinned file, then run:

```sh
curl -L --fail --silent https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson -o /tmp/ne_50m_admin_0_countries.geojson
node scripts/build-geography.mjs /tmp/ne_50m_admin_0_countries.geojson
```

The generator validates the checksum and coverage, maps `ISO_A2_EH` to atlas
IDs, and merges multiple source records with one supported code (Australia
and its Indian Ocean Territories / Ashmore and Cartier Islands). All polygon
rings and holes remain in their country's selectable path. Unsupported
features use unique Natural Earth IDs prefixed with `land-` and render as
neutral background land. There are 240 unique features after merging.

`src/data/geography.json` is the generated rendering data, separate from game
state and the map component. It contains projected paths and small-country
anchor points, with no country-name labels. An equirectangular projection maps
longitude −180…180 and latitude 90…−90 to a 960 × 480 view. Each ring is
simplified with Douglas–Peucker tolerance 0.11 projected units (about 0.04°), then rounded
to two decimals. Tiny rings retain their original vertices when simplification
would leave fewer than four. No country or polygon is discarded. The generated
file is about 454 KiB before HTTP compression. No map library, network tile
service, runtime geographic API, backend, or new dependency is required.

## Geographic policy

- **Continents:** preserve the flag game's existing UN M49 based single-region
  classification. Russia is Europe; Türkiye, Cyprus, Armenia, Azerbaijan,
  Georgia, Kazakhstan, Indonesia and Timor-Leste are Asia; Egypt is Africa.
  Selecting Europe therefore includes all of Russia's mapped territory.
- **Disconnected and overseas territory:** every polygon attached to the same
  supported source ISO code selects the same country. For example France's
  source geometry includes French Guiana, and Alaska and Hawaii select the
  United States. Dependencies with separate codes that are not among the
  atlas's 195 entries remain neutral background; they are not extra questions
  and are not silently reassigned through sovereignty fields.
- **Disputed boundaries:** use the pinned Natural Earth default Admin 0
  geometry as supplied. Natural Earth describes its default as de facto
  boundaries. This is a consistent educational map, not a legal position or a
  statement of recognition. The question pool remains the 193 UN members plus
  Palestine and the Holy See. Other source entities, such as Kosovo, Taiwan,
  Northern Cyprus and Somaliland, are neutral background and never become
  questions or incorrect guesses. Palestine remains fully selectable under
  `ps` even though its sovereignty metadata differs from its own ISO code.
- **Names:** use canonical atlas names for prompts, feedback and accessible
  labels, including Türkiye and Côte d’Ivoire. Geographic identity never
  depends on those strings matching a source label.

## Interaction and accessibility

The visible map has boundaries and no country names. Hover changes fill and
outline; completed countries stay green; the latest incorrect selection can
temporarily override green with red, then restores its completed state.
Result text and the legend accompany color feedback.
Show answer centers the map on the country and marks it amber for the rest of
the round. Revealed answers have a separate count and do not count as located.
Use Next Country after a reveal; automatic advancement applies only to correct guesses.

Countries whose largest polygon has an area below 22 projected square units
also have a neutral dot at Natural Earth's label anchor. Dots have 24 CSS-pixel
hit diameters and stay the same screen size while zooming; smaller countries
render above larger neighbors. Zoom in to separate overlapping dots, or hide
the dots and use the actual boundaries. All supported boundaries remain
selectable at up to 40× zoom, even with dots hidden.

Mouse/touch drag pans; wheel and two-finger pinch zoom around the gesture.
Zoom buttons and reset are available on mobile. Every country is keyboard
focusable and has its atlas name as a screen-reader label; Enter or Space
selects it. When the viewport itself is focused, arrow keys pan, +/− zoom,
and Home resets. Keyboard and screen-reader labels necessarily provide names
to assistive technology, while the visible geographic exercise stays blank.
Panning and pinch gestures never count as guesses. Completed countries remain
selectable during subsequent questions. Theme colors use CSS variables in the existing
light/dark theme; reduced-motion preference removes fill transitions.

Country coverage, disconnected paths, map feedback, keyboard selection,
wheel zoom, drag/pinch selection suppression, reset and small-country targets
are covered by `src/components/CountryMap.test.tsx`.
