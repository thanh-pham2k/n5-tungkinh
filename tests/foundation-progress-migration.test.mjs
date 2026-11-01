import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { preserveFoundationProgress } from '../scripts/foundation-progress-migration.mjs';
import parser from '../src/services/lesson-parser.cjs';

const oldSource = '# Old\n\nOld content.';
const newSource = '# New\n\nNew content.';
const hash = (value) => createHash('sha256').update(value).digest('hex');
async function fixture() {
  const db = createClient({ url: ':memory:' });
  await db.executeMultiple(await readFile('database/changelog/v001/001-study-library.sql', 'utf8'));
  for (const user of ['one', 'two']) {
    await db.execute({
      sql: `INSERT INTO study_contents VALUES (?, ?, 'markdown', 'Old', 'en', ?, ?, ?, ?, 'time', 'time', 1)`,
      args: [
        `content-${user}`,
        user,
        oldSource,
        hash(oldSource),
        JSON.stringify(parser.parse(oldSource)),
        parser.parse(oldSource).length,
      ],
    });
    await db.execute({
      sql: 'INSERT INTO study_records VALUES (?, ?, ?, ?, ?)',
      args: [`log-${user}`, user, `content-${user}`, `request-${user}`, 'time'],
    });
    await db.execute({
      sql: 'INSERT INTO study_progress VALUES (?, ?, ?, ?, ?)',
      args: [`content-${user}`, user, '{"foundationCompletedAt":"2026-01-01"}', 3, 'time'],
    });
  }
  return db;
}
async function migrate(db) {
  const tx = await db.transaction('write');
  try {
    await preserveFoundationProgress(tx, oldSource, newSource);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

test('preserves content identities and progress while history retains the old source for each account', async () => {
  const db = await fixture();
  try {
    await migrate(db);
    for (const user of ['one', 'two']) {
      const current = await db.execute({
        sql: 'SELECT c.source, p.state_json, p.version FROM study_contents c JOIN study_progress p ON p.content_id=c.id AND p.library_id=c.library_id WHERE c.id=?',
        args: [`content-${user}`],
      });
      assert.equal(current.rows[0].source, newSource);
      assert.equal(current.rows[0].version, 3);
      assert.match(current.rows[0].state_json, /foundationCompletedAt/);
      const log = await db.execute({
        sql: 'SELECT c.source, p.state_json FROM study_records r JOIN study_contents c ON c.id=r.content_id LEFT JOIN study_progress p ON p.content_id=c.id AND p.library_id=r.library_id WHERE r.id=?',
        args: [`log-${user}`],
      });
      assert.equal(log.rows[0].source, oldSource);
      assert.match(log.rows[0].state_json, /foundationCompletedAt/);
    }
  } finally {
    db.close();
  }
});

test('a conflicting destination rolls back changes to every account', async () => {
  const db = await fixture();
  try {
    await db.execute({
      sql: `INSERT INTO study_contents VALUES ('conflict', 'two', 'markdown', 'New', 'en', ?, ?, ?, ?, 'time', 'time', 1)`,
      args: [
        newSource,
        hash(newSource),
        JSON.stringify(parser.parse(newSource)),
        parser.parse(newSource).length,
      ],
    });
    await assert.rejects(migrate(db), /already exists/);
    const contents = await db.execute(
      "SELECT id, source FROM study_contents WHERE id IN ('content-one', 'content-two') ORDER BY id",
    );
    assert.deepEqual(
      contents.rows.map((row) => String(row.source)),
      [oldSource, oldSource],
    );
    const logs = await db.execute('SELECT content_id FROM study_records ORDER BY id');
    assert.deepEqual(
      logs.rows.map((row) => String(row.content_id)),
      ['content-one', 'content-two'],
    );
  } finally {
    db.close();
  }
});

test('reviewed catalog publication switches sources and progress atomically', async () => {
  const { publishFoundation } = await import('../scripts/foundation-publish.mjs');
  const db = await fixture();
  const previous = JSON.stringify([{ id: 'lesson', source: oldSource }]);
  const updated = JSON.stringify([{ id: 'lesson', source: newSource }]);
  try {
    await db.execute({
      sql: 'INSERT INTO study_catalog VALUES (?, ?, ?)',
      args: ['english-foundation', previous, 'time'],
    });
    await assert.rejects(publishFoundation(db, updated, previous), /has progress/);
    await publishFoundation(db, updated, previous, ['lesson']);
    const row = await db.execute(
      "SELECT payload_json FROM study_catalog WHERE id='english-foundation'",
    );
    assert.equal(row.rows[0].payload_json, updated);
    const current = await db.execute("SELECT source FROM study_contents WHERE id = 'content-one'");
    assert.equal(current.rows[0].source, newSource);
    const historical = await db.execute(
      "SELECT c.source FROM study_records r JOIN study_contents c ON c.id = r.content_id WHERE r.id = 'log-one'",
    );
    assert.equal(historical.rows[0].source, oldSource);
  } finally {
    db.close();
  }
});

test('publication rolls back catalog and earlier migrations if a later destination conflicts', async () => {
  const { publishFoundation } = await import('../scripts/foundation-publish.mjs');
  const db = await fixture();
  const previous = JSON.stringify([{ id: 'lesson', source: oldSource }]);
  const updated = JSON.stringify([{ id: 'lesson', source: newSource }]);
  try {
    await db.execute({
      sql: 'INSERT INTO study_catalog VALUES (?, ?, ?)',
      args: ['english-foundation', previous, 'time'],
    });
    await db.execute({
      sql: `INSERT INTO study_contents VALUES ('conflict', 'two', 'markdown', 'New', 'en', ?, ?, ?, ?, 'time', 'time', 1)`,
      args: [
        newSource,
        hash(newSource),
        JSON.stringify(parser.parse(newSource)),
        parser.parse(newSource).length,
      ],
    });
    await assert.rejects(publishFoundation(db, updated, previous, ['lesson']), /already exists/);
    const row = await db.execute(
      "SELECT payload_json FROM study_catalog WHERE id='english-foundation'",
    );
    assert.equal(row.rows[0].payload_json, previous);
    const content = await db.execute("SELECT source FROM study_contents WHERE id='content-one'");
    assert.equal(content.rows[0].source, oldSource);
  } finally {
    db.close();
  }
});

test('does not transfer progress when a quiz answer changes', async () => {
  const db = await fixture();
  const before =
    '# Quiz\n\n```quiz-deck\nq1 | single_choice | Question? | A | B | C | D | 1 | Explanation.\n```';
  const after = before.replace('| 1 | Explanation.', '| 2 | Explanation.');
  const tx = await db.transaction('write');
  try {
    await assert.rejects(preserveFoundationProgress(tx, before, after), /Quiz content changed/);
    await tx.rollback();
  } finally {
    tx.close();
    db.close();
  }
});
