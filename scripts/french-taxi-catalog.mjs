import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('../src/services/lesson-parser.cjs');

export async function loadFrenchTaxiCatalog() {
  const manifest = JSON.parse(await readFile('docs/french-taxi/manifest.json', 'utf8'));
  if (manifest.length !== 24 || new Set(manifest.map((item) => item.id)).size !== 24) {
    throw new Error('French Taxi manifest must have 24 distinct lessons.');
  }

  return Promise.all(
    manifest.map(async ({ file, ...item }) => {
      const source = await readFile(`docs/french-taxi/${file}`, 'utf8');
      const blocks = parse(source);
      if (
        !source.startsWith('# ') ||
        blocks.some((block) => block.type === 'error') ||
        !blocks.some((block) => block.type === 'deck')
      ) {
        throw new Error(`Invalid French Taxi lesson: ${item.id}`);
      }
      return { ...item, source };
    }),
  );
}
