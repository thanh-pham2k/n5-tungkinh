import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createClient } from '@libsql/client';
import { publishFoundation } from '../scripts/foundation-publish.mjs';

const oldLesson = [{ id: 'old', source: '# Existing lesson\n' }];
const changedLesson = [
  { id: 'old', source: '# Updated lesson\n' },
  { id: 'new', source: '# New lesson\n' },
];
const oldPayload = JSON.stringify(oldLesson);
const newPayload = JSON.stringify(changedLesson);
async function fixture() {
  const db = createClient({ url: ':memory:' });
  await db.executeMultiple(`CREATE TABLE study_catalog (id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE study_contents (id TEXT PRIMARY KEY, tool TEXT NOT NULL, source_hash TEXT NOT NULL);
    CREATE TABLE study_progress (content_id TEXT NOT NULL, library_id TEXT NOT NULL);`);
  await db.execute({
    sql: 'INSERT INTO study_catalog VALUES (?, ?, ?)',
    args: ['english-foundation', oldPayload, 'old'],
  });
  return db;
}
async function stored(db) {
  return String(
    (await db.execute("SELECT payload_json FROM study_catalog WHERE id = 'english-foundation'"))
      .rows[0].payload_json,
  );
}

test('Foundation publication verifies the reviewed version and refuses removals', async () => {
  const db = await fixture();
  try {
    await assert.rejects(publishFoundation(db, newPayload, '[]'), /reviewed snapshot/);
    assert.equal(await stored(db), oldPayload);
    await assert.rejects(publishFoundation(db, '[]', oldPayload), /remove existing lesson/);
    assert.equal(await stored(db), oldPayload);
    await publishFoundation(db, newPayload, oldPayload);
    assert.equal(await stored(db), newPayload);
    await publishFoundation(db, newPayload, null);
  } finally {
    db.close();
  }
});

test('Foundation publication preserves progress by refusing changed completed content', async () => {
  const db = await fixture();
  try {
    const hash = createHash('sha256').update(oldLesson[0].source.trim()).digest('hex');
    await db.execute({
      sql: 'INSERT INTO study_contents VALUES (?, ?, ?)',
      args: ['content', 'markdown', hash],
    });
    await db.execute({
      sql: 'INSERT INTO study_progress VALUES (?, ?)',
      args: ['content', 'owner'],
    });
    await assert.rejects(publishFoundation(db, newPayload, oldPayload), /has progress/);
    assert.equal(await stored(db), oldPayload);
    const appended = JSON.stringify([...oldLesson, changedLesson[1]]);
    await publishFoundation(db, appended, oldPayload);
    assert.equal(await stored(db), appended);
  } finally {
    db.close();
  }
});
