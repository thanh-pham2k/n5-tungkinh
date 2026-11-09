import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReadingPracticeCatalog } from '../scripts/reading-practice-catalog.mjs';

test('Reading Practice retains all 50 readings and 10 reviews with questions grouped by passage', async () => {
  const catalog = await loadReadingPracticeCatalog();
  const ids = new Set();
  assert.equal(catalog.length, 60);
  for (let week = 1; week <= 10; week++) {
    const items = catalog.filter((item) => item.week === week);
    assert.equal(items.length, 6);
    assert.equal(items.filter((item) => !item.id.includes('review')).length, 5);
    for (const item of items) {
      const qids = [...item.source.matchAll(/^([^\s|]+)\s*\|\s*single_choice\s*\|/gm)].map(
        (match) => match[1],
      );
      assert.equal(qids.length, item.id.includes('review') ? 15 : 8, item.id);
      for (const id of qids) {
        assert.ok(!ids.has(id), id);
        ids.add(id);
      }
      if (item.id.includes('review')) {
        const parts = item.source.split(/^## Passage [ABC]\b/gm);
        assert.equal(parts.length, 4, item.id);
        for (let i = 1; i <= 3; i++) {
          const partIds = [...parts[i].matchAll(/-R-Q(\d+)\s*\|/g)].map((m) => Number(m[1]));
          assert.deepEqual(
            partIds,
            Array.from({ length: 5 }, (_, j) => (i - 1) * 5 + j + 1),
          );
        }
      }
    }
  }
  assert.equal(ids.size, 550);
});
