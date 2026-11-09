import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('../src/services/lesson-parser.cjs');

export async function loadFrenchCatalog() {
  const manifest = JSON.parse(await readFile('docs/french/manifest.json', 'utf8'));
  if (manifest.length !== 14) {
    throw new Error('French manifest must have 14 lessons.');
  }

  return Promise.all(
    manifest.map(async ({ file, ...item }) => {
      const source = await readFile(`docs/french/${file}`, 'utf8');
      const blocks = parse(source);
      if (
        !source.startsWith('# ') ||
        blocks.some((block) => block.type === 'error') ||
        !blocks.some((block) => block.type === 'deck')
      ) {
        throw new Error(`Invalid French lesson: ${item.id}`);
      }
      return { ...item, source };
    }),
  );
}
