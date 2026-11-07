import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('../src/services/lesson-parser.cjs');
const order = [
  1, 2, 3, 16, 17, 18, 19, 20, 24, 25, 21, 23, 28, 29, 26, 65, 66, 35, 36, 37, 74, 38, 39, 40, 75,
  76, 53, 55, 95, 98, 81, 82, 83, 84, 79, 80, 86, 89, 90, 91, 77,
];
export async function loadEviuCatalog() {
  const manifest = JSON.parse(await readFile('docs/eviu/manifest.json', 'utf8'));
  if (
    manifest.length !== 41 ||
    manifest.some(
      (item, i) =>
        item.id !== `unit-${String(order[i]).padStart(2, '0')}` ||
        item.order !== i + 1 ||
        item.file !== `${String(order[i]).padStart(2, '0')}.md`,
    )
  )
    throw new Error('EVIU manifest order is invalid.');
  return Promise.all(
    manifest.map(async ({ file, ...item }) => {
      const source = await readFile(`docs/eviu/${file}`, 'utf8');
      const blocks = parse(source);
      if (
        source.includes('[Truncated]') ||
        !source.includes('TL;DR') ||
        blocks.some((block) => block.type === 'error') ||
        !blocks.some((block) => block.type === 'deck') ||
        !blocks.some((block) => block.type === 'flipcards')
      )
        throw new Error(`Invalid EVIU lesson: ${item.id}`);
      return { ...item, source };
    }),
  );
}
