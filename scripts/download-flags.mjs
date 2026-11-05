// Refresh committed assets from Flagpedia. Gameplay never calls this service.
// Run with Node 22+ from any directory. Review changed flags before committing.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const source = await readFile(
  new URL('../src/data/countries.ts', import.meta.url),
  'utf8',
);
const ids = [...source.matchAll(/^\s*([a-z]{2})\|/gm)].map((match) => match[1]);
const output = new URL('../public/flags/', import.meta.url);
await mkdir(output, { recursive: true });
const queue = [...ids];
let downloaded = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const response = await fetch(`https://flagcdn.com/${id}.svg`);
      if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
      let svg = await response.text();
      const tag = svg.match(/<svg[^>]*>/)?.[0] ?? '';
      if (!tag.includes('viewBox=')) {
        const width = tag.match(/width="([\d.]+)"/)?.[1];
        const height = tag.match(/height="([\d.]+)"/)?.[1];
        if (width && height)
          svg = svg.replace('<svg ', `<svg viewBox="0 0 ${width} ${height}" `);
      }
      if (!svg.includes('<svg')) throw new Error(`Invalid SVG for ${id}`);
      await writeFile(new URL(`${id}.svg`, output), svg);
      downloaded++;
    }
  }),
);
console.log(`Downloaded ${downloaded} SVG flags from Flagpedia / Flagcdn.`);
