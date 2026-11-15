import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import parser from '../src/services/lesson-parser.cjs';
import { loadAllFoundationPhases } from '../scripts/foundation-catalog.mjs';

const draftPath = 'docs/english-foundation';
const normalized = (value) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .sort();

test('split lessons cover all 50 previous Phase 1-4 lessons and have usable exercises and audio', async () => {
  const manifest = JSON.parse(await readFile(`${draftPath}/manifest.json`, 'utf8'));
  const active = (await loadAllFoundationPhases()).filter(
    (item) => !item.id.includes('checkpoint'),
  );
  const splitEntries = manifest.filter((item) => item.splitFrom);
  assert.equal(splitEntries.length, 238);
  assert.deepEqual(
    splitEntries.map((item) => item.id).sort(),
    active.map((item) => item.id).sort(),
  );
  const sources = new Set(splitEntries.map((item) => item.splitFrom));
  assert.equal(sources.size, 50);
  for (const entry of splitEntries.filter((e) => e.phase === 1 || e.phase === 2)) {
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
