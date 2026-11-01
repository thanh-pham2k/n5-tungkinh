import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { publishCompactFoundation } from '../scripts/foundation-compact-publish.mjs';
import parser from '../src/services/lesson-parser.cjs';

const old = [
  { id: 'l1', module: 1, source: '# First\n\nOld first.' },
  { id: 'l2', module: 1, source: '# Second\n\nOld second.' },
  { id: 'checkpoint-1', module: 1, source: '# Checkpoint' },
];
const merged = { id: 'merged', module: 1, phase: 1, source: '# Combined\n\nNew combined lesson.' };
const next = [merged, old[2]];
const mapping = [{ id: 'merged', replaces: ['l1', 'l2'] }];
const before = JSON.stringify(old);
const after = JSON.stringify(next);
const hash = (value) => createHash('sha256').update(value.trim()).digest('hex');
async function fixture() {
  const db = createClient({ url: ':memory:' });
  await db.executeMultiple(await readFile('database/changelog/v001/001-study-library.sql', 'utf8'));
  await db.execute({
    sql: 'INSERT INTO study_catalog VALUES (?, ?, ?)',
    args: ['english-foundation', before, 'time'],
  });
  for (const [library, sources] of [
    ['complete', old.slice(0, 2)],
    ['partial', old.slice(0, 1)],
  ]) {
    for (const item of sources) {
      const id = `${library}-${item.id}`;
      const parsed = parser.parse(item.source);
      await db.execute({
        sql: `INSERT INTO study_contents VALUES (?,?,'markdown','Old','en',?,?,?,?,'time','time',1)`,
        args: [id, library, item.source, hash(item.source), JSON.stringify(parsed), parsed.length],
      });
      await db.execute({
        sql: 'INSERT INTO study_records VALUES (?,?,?,?,?)',
        args: [`log-${id}`, library, id, `request-${id}`, 'time'],
      });
      await db.execute({
        sql: 'INSERT INTO study_progress VALUES (?,?,?,?,?)',
        args: [
          id,
          library,
          JSON.stringify({
            foundationCompletedAt:
              item.id === 'l1' ? '2026-01-01T00:00:00.000Z' : '2026-01-02T00:00:00.000Z',
          }),
          2,
          'time',
        ],
      });
    }
  }
  return db;
}
test('only fully completed source lessons give merged completion and old history remains', async () => {
  const db = await fixture();
  try {
    await publishCompactFoundation(db, before, after, mapping);
    const rows = await db.execute({
      sql: 'SELECT c.library_id,p.state_json FROM study_contents c JOIN study_progress p ON p.content_id=c.id WHERE c.source_hash=?',
      args: [hash(merged.source)],
    });
    assert.equal(rows.rows.length, 2);
    const complete = JSON.parse(rows.rows.find((row) => row.library_id === 'complete').state_json);
    const partial = JSON.parse(rows.rows.find((row) => row.library_id === 'partial').state_json);
    assert.equal(complete.foundationCompletedAt, '2026-01-02T00:00:00.000Z');
    assert.equal(partial.foundationCompletedAt, undefined);
    assert.deepEqual(partial.foundationMergedParts, { l1: '2026-01-01T00:00:00.000Z' });
    const originals = await db.execute('SELECT COUNT(*) AS n FROM study_records');
    assert.equal(Number(originals.rows[0].n), 3);
    const progress = await db.execute(
      "SELECT COUNT(*) AS n FROM study_progress WHERE content_id LIKE 'partial-%'",
    );
    assert.equal(Number(progress.rows[0].n), 1);
    await publishCompactFoundation(db, before, after, mapping);
    const reapply = await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM study_contents WHERE source_hash = ?',
      args: [hash(merged.source)],
    });
    assert.equal(Number(reapply.rows[0].n), 2);
  } finally {
    db.close();
  }
});
test('refuses a changed snapshot and rolls back when target content exists', async () => {
  const db = await fixture();
  try {
    await assert.rejects(publishCompactFoundation(db, '[]', after, mapping));
    const parsed = parser.parse(merged.source);
    await db.execute({
      sql: `INSERT INTO study_contents VALUES ('collision','complete','markdown','Existing','en',?,?,?,?,'time','time',1)`,
      args: [merged.source, hash(merged.source), JSON.stringify(parsed), parsed.length],
    });
    await assert.rejects(publishCompactFoundation(db, before, after, mapping), /already exists/);
    const catalog = await db.execute(
      "SELECT payload_json FROM study_catalog WHERE id='english-foundation'",
    );
    assert.equal(catalog.rows[0].payload_json, before);
    const originals = await db.execute('SELECT COUNT(*) AS n FROM study_records');
    assert.equal(Number(originals.rows[0].n), 3);
  } finally {
    db.close();
  }
});
