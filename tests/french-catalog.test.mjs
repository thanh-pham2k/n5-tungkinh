import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrenchCatalog } from '../scripts/french-catalog.mjs';
import { parse } from '../src/services/lesson-parser.cjs';

test('French catalog contains 14 distinct complete lessons in the agreed order', async () => {
  const lessons = await loadFrenchCatalog();
  assert.equal(lessons.length, 14);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 14);

  let totalQuestions = 0;
  for (const lesson of lessons) {
    assert.match(lesson.source, /^# /);
    assert.match(lesson.source, /```quiz-deck\n/);
    assert.doesNotMatch(lesson.source, /\|\s*typing\s*\|/);

    const parsed = parse(lesson.source);
    const decks = parsed.filter((item) => item.type === 'deck');
    assert.ok(decks.length > 0, `Lesson ${lesson.id} should have quiz decks`);

    for (const deck of decks) {
      for (const q of deck.quizzes) {
        totalQuestions++;
        assert.ok(
          q.type === 'single_choice' || q.type === 'word_order',
          `Question ${q.id} in ${lesson.id} must be single_choice or word_order`,
        );
        assert.ok(
          q.explanation && q.explanation.startsWith('Dịch:'),
          `Question ${q.id} in ${lesson.id} must have complete Vietnamese translation starting with 'Dịch:'`,
        );
        assert.ok(
          !q.explanation.includes('|'),
          `Question ${q.id} explanation must not contain pipe characters`,
        );
      }
    }
  }

  assert.equal(totalQuestions, 610, 'Catalog should contain exactly 610 questions');

  // Verify review lessons have summaries before quiz-deck
  const reviewIds = ['french-rev-01', 'french-rev-02', 'french-rev-03', 'french-final'];
  for (const rid of reviewIds) {
    const r = lessons.find((l) => l.id === rid);
    assert.ok(r, `Review lesson ${rid} must exist`);
    assert.match(r.source, /(Tóm tắt kiến thức|Bảng tổng hợp kiến thức)/);
  }
});
