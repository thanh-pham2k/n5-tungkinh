import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import parser from '../src/services/lesson-parser.cjs';
import { loadFoundationCatalog, loadPhase2Catalog } from '../scripts/foundation-catalog.mjs';

const draftPath = 'docs/english-foundation';
const normalized = (value) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .sort();

test('compact draft covers every original lesson once and has usable exercises and audio', async () => {
  const manifest = JSON.parse(await readFile(`${draftPath}/manifest.json`, 'utf8'));
  const original = [...(await loadFoundationCatalog()), ...(await loadPhase2Catalog())].filter(
    (item) => !item.id.includes('checkpoint'),
  );
  const compact = manifest.filter((item) => item.replaces);
  assert.equal(compact.length, 22);
  assert.deepEqual(compact.map((item) => item.id).sort(), original.map((item) => item.id).sort());
  const replacements = compact.flatMap((item) => item.replaces);
  assert.equal(replacements.length, 50);
  assert.equal(new Set(replacements).size, 50);
  const archive = await readFile(`${draftPath}/archive/lessons-before-consolidation.md`, 'utf8');
  const archivedIds = [...archive.matchAll(/^## (\S+) — docs\/english-foundation\/phase-/gm)]
    .map((match) => match[1])
    .filter((id) => id !== 'README');
  assert.deepEqual(replacements.slice().sort(), archivedIds.sort());
  for (const entry of compact) {
    const source = await readFile(`${draftPath}/${entry.file}`, 'utf8');
    const blocks = parser.parse(source);
    assert.deepEqual(
      blocks.filter((block) => block.type === 'error'),
      [],
      entry.id,
    );
    const quizzes = blocks
      .filter((block) => block.type === 'deck')
      .flatMap((block) => block.quizzes);
    assert.ok(quizzes.length >= 10, entry.id);
    for (const deck of blocks.filter((block) => block.type === 'deck')) {
      const types = deck.quizzes.map((quiz) => quiz.type);
      const order = ['single_choice', 'word_order', 'typing'];
      assert.deepEqual(
        types,
        [...types].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      );
    }
    assert.match(source, /`audio:en\|[^`]+`/, entry.id);
    for (const quiz of quizzes) {
      if (quiz.type === 'word_order')
        assert.deepEqual(normalized(quiz.tokens.join(' ')), normalized(quiz.answer), quiz.id);
      if (quiz.type === 'typing') {
        const words = quiz.question.match(/(?:xáo|sentence):\s*(.*)/i);
        assert.ok(words, quiz.id);
        assert.deepEqual(normalized(words[1]), normalized(quiz.answer), quiz.id);
      }
    }
  }
});
