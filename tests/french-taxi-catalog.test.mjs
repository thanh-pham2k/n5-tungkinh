import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrenchTaxiCatalog } from '../scripts/french-taxi-catalog.mjs';
import { parse } from '../src/services/lesson-parser.cjs';

test('French Taxi catalog contains 24 distinct valid lessons across 6 units', async () => {
  const lessons = await loadFrenchTaxiCatalog();
  assert.equal(lessons.length, 24);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 24);

  for (let unit = 1; unit <= 6; unit++) {
    const inUnit = lessons.filter((lesson) => lesson.unit === unit);
    assert.equal(inUnit.length, 4, `Unité ${unit} should have 4 lessons`);
  }

  let totalQuestions = 0;
  for (const lesson of lessons) {
    assert.equal(lesson.source, lesson.source.normalize('NFC'), `${lesson.id} must be NFC`);
    assert.match(lesson.source, /^# /);
    assert.match(lesson.source, /```quiz-deck\n/);

    const parsed = parse(lesson.source);
    assert.equal(
      parsed.filter((item) => item.type === 'error').length,
      0,
      `Lesson ${lesson.id} must have zero parser errors`,
    );

    const decks = parsed.filter((item) => item.type === 'deck');
    assert.ok(decks.length >= 5, `Lesson ${lesson.id} should have at least 5 quiz decks`);

    for (const deck of decks) {
      for (const q of deck.quizzes) {
        totalQuestions++;
        assert.ok(
          ['single_choice', 'word_order', 'typing'].includes(q.type),
          `Question ${q.id} in ${lesson.id} has invalid type ${q.type}`,
        );
        if (q.type === 'word_order') {
          assert.ok(
            q.tokens.length >= 2 && !q.tokens.some((token) => token.includes(';')),
            `Question ${q.id} in ${lesson.id} must use '/' token delimiters without ';'`,
          );
        }
        assert.ok(q.explanation, `Question ${q.id} in ${lesson.id} must have an explanation`);
      }
    }
  }

  assert.equal(totalQuestions, 1030, 'Catalog should contain 1030 questions across 24 lessons');
});
