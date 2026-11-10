// Rebuild with: node scripts/build-geography.mjs /path/to/ne_50m_admin_0_countries.geojson
// Download URL and checksum are documented in GEOGRAPHY.md.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const input = process.argv[2];
if (!input) throw new Error('Pass the pinned Natural Earth GeoJSON file path.');
const source = await readFile(input);
const digest = createHash('sha256').update(source).digest('hex');
const expected = '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb';
if (digest !== expected) throw new Error('Unexpected source checksum; review the geography source before updating it.');
const { features } = JSON.parse(source);
const countrySource = await readFile(new URL('../src/data/countries.ts', import.meta.url), 'utf8');
const countryIds = new Set([...countrySource.matchAll(/^([a-z]{2})\|/gm)].map((match) => match[1]));

const project = ([longitude, latitude]) => [(longitude + 180) * 960 / 360, (90 - latitude) * 480 / 180];
const round = (value) => Number(value.toFixed(2));
function simplify(points, tolerance = 0.11) {
  // Douglas–Peucker on projected coordinates, preserving each polygon's closure.
  if (points.length <= 4) return points;
  const last = points.length - 1;
  const keep = new Set([0, last]);
  const stack = [[0, last]];
  while (stack.length) {
    const [start, end] = stack.pop();
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    let furthest = -1;
    let maximum = tolerance * tolerance;
    for (let index = start + 1; index < end; index++) {
      const [px, py] = points[index];
      const fraction = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
      const distance = (px - ax - fraction * dx) ** 2 + (py - ay - fraction * dy) ** 2;
      if (distance > maximum) { maximum = distance; furthest = index; }
    }
    if (furthest !== -1) {
      keep.add(furthest);
      stack.push([start, furthest], [furthest, end]);
    }
  }
  const result = [...keep].sort((a, b) => a - b).map((index) => points[index]);
  return result.length >= 4 ? result : points;
}
function ringArea(ring) {
  return Math.abs(ring.reduce((sum, [x, y], index) => {
    const [nextX, nextY] = ring[(index + 1) % ring.length];
    return sum + x * nextY - nextX * y;
  }, 0)) / 2;
}
const collected = new Map();
for (const feature of features) {
  const properties = feature.properties;
  const id = properties.ISO_A2_EH.toLowerCase();
  const supported = countryIds.has(id);
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const projected = polygons.map((polygon) => polygon.map((ring) => ring.map(project)));
  const largestArea = Math.max(...projected.map((polygon) => ringArea(polygon[0])));
  const path = projected.map((polygon) => polygon.map((ring) => {
    // Tiny rings retain original vertices; no tiny country is dropped.
    const points = simplify(ring);
    return `M${points.slice(0, -1).map(([x, y]) => `${round(x)},${round(y)}`).join('L')}Z`;
  }).join('')).join('');
  const key = supported ? id : `land-${properties.NE_ID}`;
  const previous = collected.get(key);
  // The source has separate records for some Australian territories sharing
  // ISO_A2_EH=AU. Merge them into a single selectable country.
  collected.set(key, {
    id: key,
    path: (previous?.path || '') + path,
    area: Math.max(previous?.area || 0, largestArea),
    point: previous && previous.area >= largestArea ? previous.point : project([properties.LABEL_X, properties.LABEL_Y]).map(round),
  });
}
// Small-country targets render above larger neighbors, rather than underneath
// their polygons (for example Monaco and Italy).
const records = [...collected.values()].sort((a, b) => b.area - a.area).map(({ id, path, area, point }) => ({
  id,
  path,
  ...(countryIds.has(id) && area < 22 ? { point } : {}),
}));
const missing = [...countryIds].filter((id) => !records.some((record) => record.id === id));
if (missing.length) throw new Error(`Missing supported countries: ${missing.join(', ')}`);
if (countryIds.size !== 195) throw new Error('Review changed country coverage.');
await writeFile(new URL('../src/data/geography.json', import.meta.url), JSON.stringify(records));
console.log(`Generated ${records.length} map features; all ${countryIds.size} atlas countries covered.`);
