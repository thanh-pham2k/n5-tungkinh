import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEviuCatalog } from '../scripts/eviu-catalog.mjs';

test('EVIU contains 41 distinct complete lessons in the agreed order', async () => {
  const lessons = await loadEviuCatalog();
  assert.equal(lessons.length, 41);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 41);
  for (const lesson of lessons) {
    assert.match(lesson.source, /^# Unit \d+/);
    assert.match(lesson.source, /Ôn tập tổng hợp/i);
    assert.match(lesson.source, /```flipcard\n/);
  }
});
