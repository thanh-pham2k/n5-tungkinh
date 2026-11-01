import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFoundationCatalog } from '../scripts/foundation-catalog.mjs';
import parser from '../src/services/lesson-parser.cjs';

test('Foundation Module 1 lessons contain valid ordered quizzes and listening prompts', async () => {
  const lessons = await loadFoundationCatalog();
  assert.equal(lessons.length, 6);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, lessons.length);
  for (const lesson of lessons) {
    const blocks = parser.parse(lesson.source);
    assert.deepEqual(
      blocks.filter((block) => block.type === 'error'),
      [],
      lesson.id,
    );
    const quizzes = blocks
      .filter((block) => block.type === 'deck')
      .flatMap((block) => block.quizzes);
    const counts = lesson.id === 'checkpoint-01' ? [14, 8, 8] : [6, 3, 3];
    assert.deepEqual(
      quizzes.map((quiz) => quiz.type),
      [
        ...Array(counts[0]).fill('single_choice'),
        ...Array(counts[1]).fill('word_order'),
        ...Array(counts[2]).fill('typing'),
      ],
      lesson.id,
    );
    for (const quiz of quizzes.filter((item) => item.type === 'word_order')) {
      const normalize = (text) =>
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim()
          .replace(/\s+/g, ' ');
      assert.deepEqual(
        normalize(quiz.tokens.join(' ')).split(' ').sort(),
        normalize(quiz.answer).split(' ').sort(),
        quiz.id,
      );
    }
    assert.match(lesson.source, /`audio:en\|[^`]+`/, lesson.id);
  }
});
