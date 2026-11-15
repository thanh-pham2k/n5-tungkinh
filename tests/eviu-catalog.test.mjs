import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEviuCatalog } from '../scripts/eviu-catalog.mjs';

test('EVIU contains 104 split parts covering 41 distinct units in the agreed order', async () => {
  const lessons = await loadEviuCatalog();
  assert.equal(lessons.length, 104);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 104);
  for (const lesson of lessons) {
    assert.match(lesson.source, /^# Unit \d+/);
    assert.match(lesson.source, /TL;DR/);
    assert.match(lesson.source, /```quiz-deck\n/);
    assert.match(lesson.source, /```flipcard\n/);
  }
});
