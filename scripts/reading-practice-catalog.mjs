import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('../src/services/lesson-parser.cjs');

export async function loadReadingPracticeCatalog() {
  const manifest = JSON.parse(await readFile('docs/reading-practice/manifest.json', 'utf8'));
  if (manifest.length !== 60 || new Set(manifest.map((item) => item.id)).size !== 60)
    throw new Error('Reading Practice must contain 50 lessons and 10 reviews.');
  return Promise.all(
    manifest.map(async ({ file, ...item }) => {
      const source = await readFile(`docs/reading-practice/${file}`, 'utf8');
      const blocks = parse(source);
      const decks = blocks.filter((block) => block.type === 'deck');
      const count = decks.reduce((total, deck) => total + deck.quizzes.length, 0);
      if (
        !source.startsWith('# ') ||
        blocks.some((block) => block.type === 'error') ||
        count !== (item.id.includes('review') ? 15 : 8)
      )
        throw new Error(`Invalid Reading Practice lesson: ${item.id} (${count} questions)`);
      return { ...item, source };
    }),
  );
}
