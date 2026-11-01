import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFoundationCatalog, loadPhase2Catalog } from '../scripts/foundation-catalog.mjs';
import parser from '../src/services/lesson-parser.cjs';

function verifyLessons(lessons, expectedCount) {
  assert.equal(lessons.length, expectedCount);
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
    const isCheckpoint = lesson.id.includes('checkpoint');
    if (isCheckpoint) assert.equal(quizzes.length, 30, lesson.id);
    else assert.ok(quizzes.length >= 10, lesson.id);
    for (const deck of blocks.filter((block) => block.type === 'deck')) {
      const types = deck.quizzes.map((quiz) => quiz.type);
      const order = ['single_choice', 'word_order', 'typing'];
      assert.deepEqual(
        types,
        [...types].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      );
    }
    for (const quiz of quizzes.filter((item) => item.type === 'single_choice')) {
      assert.equal(
        new Set(quiz.options.map((option) => option.trim().toLocaleLowerCase())).size,
        quiz.options.length,
        quiz.id,
      );
      assert.ok(quiz.explanation.trim(), quiz.id);
    }
    for (const quiz of quizzes.filter((item) => item.type === 'typing')) {
      const match = quiz.question.match(/(?:xáo|sentence):\s*(.*)/i);
      assert.ok(match && match[1].includes(' / '), quiz.id);
      const words = (text) =>
        text
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim()
          .split(/\s+/)
          .sort();
      assert.deepEqual(words(match[1]), words(quiz.answer), quiz.id);
    }
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
}

test('Foundation Phase 1 lessons contain valid ordered quizzes and listening prompts', async () => {
  const lessons = await loadFoundationCatalog();
  verifyLessons(lessons, 13);
});

test('Foundation Phase 2 lessons contain valid ordered quizzes and listening prompts', async () => {
  const lessons = await loadPhase2Catalog();
  verifyLessons(lessons, 19);
});

test('Each phase has a self-assessment across reading listening speaking and writing', async () => {
  const one = (await loadFoundationCatalog()).find((item) => item.id === 'm4-checkpoint');
  const two = (await loadPhase2Catalog()).find((item) => item.id === 'p2-m6-checkpoint');
  for (const lesson of [one, two]) {
    for (const section of ['**Đọc:**', '**Nghe:**', '**Viết:**', '**Nói:**'])
      assert.ok(lesson.source.includes(section), `${lesson.id}: ${section}`);
    assert.match(lesson.source, /<details>/);
  }
});

test('everyday language targets have both instruction and an exercise', async () => {
  const lessons = await loadPhase2Catalog();
  for (const [id, patterns] of [
    ['compact-m7-lesson-02', ['want to', 'need to']],
    ['compact-m9-lesson-02', ['plan to', 'hope to']],
  ]) {
    const lesson = lessons.find((item) => item.id === id);
    const blocks = parser.parse(lesson.source);
    const quizzes = blocks
      .filter((block) => block.type === 'deck')
      .flatMap((block) => block.quizzes);
    for (const phrase of patterns) {
      assert.ok(lesson.source.includes(phrase), `${id}: instruction for ${phrase}`);
      assert.ok(
        quizzes.some((quiz) =>
          [quiz.question, quiz.answer, quiz.explanation, ...(quiz.options || [])]
            .filter((value) => typeof value === 'string')
            .some((value) => value.toLowerCase().includes(phrase)),
        ),
        `${id}: exercise for ${phrase}`,
      );
    }
  }
});

test('phase listening self-assessments present audio before the hidden transcript', async () => {
  const lessons = [...(await loadFoundationCatalog()), ...(await loadPhase2Catalog())];
  for (const id of ['m4-checkpoint', 'p2-m6-checkpoint']) {
    const source = lessons.find((item) => item.id === id).source;
    const section = source.split('### Nghe, rồi đọc')[1].split('### Nói và viết')[0];
    assert.match(section, /`audio:en\|[^`]+`[\s\S]*<details>\s*<summary>Mở đoạn văn<\/summary>/);
  }
});

test('all Phase 1 consolidated lessons alternate each concept and its practice before a separate review', async () => {
  const lessons = await loadFoundationCatalog();
  const compactLessons = lessons.filter((item) => !item.id.includes('checkpoint'));
  assert.equal(compactLessons.length, 9);
  for (const lesson of compactLessons) {
    const blocks = parser.parse(lesson.source);
    const decks = blocks.filter((block) => block.type === 'deck');
    assert.ok(decks.length >= 3, `${lesson.id} should have at least 3 decks`);
    assert.ok(lesson.source.includes('## Ôn tập tổng hợp'), `${lesson.id} has review heading`);
    const revStart = lesson.source.indexOf('## Ôn tập tổng hợp');
    const revEnd = lesson.source.indexOf('## Áp dụng', revStart);
    assert.ok(revStart >= 0 && revEnd > revStart, `${lesson.id} review bounds`);
    assert.match(lesson.source.slice(revStart, revEnd), /```quiz-deck/);
  }
});
