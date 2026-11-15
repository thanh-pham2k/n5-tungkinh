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
  const expectedOrder = order.map((unit) => `unit-${String(unit).padStart(2, '0')}`);
  const actualOrder = [];
  for (const item of manifest) {
    if (!actualOrder.includes(item.splitFrom)) actualOrder.push(item.splitFrom);
  }
  if (
    manifest.length < 41 ||
    actualOrder.length !== 41 ||
    actualOrder.some((id, i) => id !== expectedOrder[i]) ||
    manifest.some((item, i) => item.order !== i + 1 || !item.id.startsWith(`${item.splitFrom}-p`))
  )
    throw new Error('EVIU manifest order is invalid.');
  return Promise.all(
    manifest.map(async ({ file, splitFrom, ...item }) => {
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
