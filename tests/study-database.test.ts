import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { studyRepository } from '../src/modules/study/repository';
import { createStudyService } from '../src/modules/study/service';
import { CreateLesson } from '../src/contracts/study-contract';
import { parseLesson } from '../src/modules/study/parse';
const csv =
  'vocabulary,hiragana,meaning_vi,example_ja,example_vi\ncat,,mèo,This is a cat.,Đây là mèo.';
const schema = readFileSync(
  new URL('../database/changelog/v001/001-study-library.sql', import.meta.url),
  'utf8',
);
test('all current reference content validates before DB save; malformed shared content is rejected', () => {
  const raw = readFileSync(new URL('../docs/ielts/practice-data.js', import.meta.url), 'utf8');
  const catalog = JSON.parse(
    raw.replace(/^\s*window\.IELTS_PRACTICE\s*=\s*/, '').replace(/;\s*$/, ''),
  );
  for (const topic of catalog.structures)
    assert.ok(parseLesson('structures', JSON.stringify(topic)).itemCount > 0);
  for (const topic of catalog.speaking)
    assert.ok(parseLesson('speaking', JSON.stringify(topic)).itemCount > 0);
  assert.throws(
    () =>
      parseLesson(
        'speaking',
        JSON.stringify({
          topic: 'Bad',
          date: '2026-10-24',
          questions: [{ id: 'q', part: 2, text: 'Q', points: { malformed: true } }],
        }),
      ),
    { code: 'validation_error' },
  );
});
async function setup() {
  const db = createClient({ url: 'file::memory:' });
  await db.executeMultiple(schema);
  return { db, service: createStudyService(studyRepository(db)) };
}
test('successful parse saves content and record atomically, reimport deduplicates content, retry is idempotent', async () => {
  const { db, service } = await setup();
  try {
    const input = CreateLesson.parse({
      tool: 'instant',
      source: csv,
      language: 'en',
      requestId: randomUUID(),
    });
    const first = await service.create('shared', input, 'visitor-a');
    assert.equal(first.itemCount, 1);
    assert.equal(first.source, csv);
    assert.equal((first.parsed as any[])[0].vocabulary, 'cat');
    const retry = await service.create('shared', input, 'visitor-a');
    assert.equal(retry.id, first.id);
    assert.equal(retry.studyCount, 1);
    const again = await service.create(
      'shared',
      { ...input, requestId: randomUUID() },
      'visitor-a',
    );
    assert.equal(again.id, first.id);
    assert.equal(again.studyCount, 2);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM study_records')).rows[0].n, 2);
    await assert.rejects(
      service.create('shared', { ...input, source: csv.replace('cat', 'dog') }, 'visitor-a'),
      { code: 'conflict' },
    );
    await assert.rejects(
      service.create(
        'shared',
        { ...input, source: 'broken', requestId: randomUUID() },
        'visitor-a',
      ),
      { code: 'validation_error' },
    );
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM study_contents')).rows[0].n, 1);
  } finally {
    db.close();
  }
});
test('shared content survives reopening; private progress is isolated per session and stale updates conflict', async () => {
  const { db, service } = await setup();
  try {
    const first = await service.create(
      'shared',
      CreateLesson.parse({ tool: 'instant', source: csv, language: 'en', requestId: randomUUID() }),
      'a',
    );
    assert.deepEqual((await service.get('shared', first.id, 'b')).parsed, first.parsed);
    await service.progress('shared', 'a', first.id, 0, { later: ['cat'] });
    assert.deepEqual((await service.get('shared', first.id, 'a')).progress, { later: ['cat'] });
    assert.deepEqual((await service.get('shared', first.id, 'b')).progress, {});
    await assert.rejects(service.progress('shared', 'a', first.id, 0, { later: [] }), {
      code: 'conflict',
    });
    await service.progress('shared', 'a', first.id, 1, { later: [] });
    assert.equal((await service.get('shared', first.id, 'a')).version, 2);
    await assert.rejects(service.get('other-library', first.id, 'a'), { code: 'not_found' });
    await assert.rejects(service.progress('shared', 'a', randomUUID(), 0, {}), {
      code: 'not_found',
    });
  } finally {
    db.close();
  }
});
test('history pagination is bounded, cursor tied to filter; rollback never leaves orphan history', async () => {
  const { db, service } = await setup();
  try {
    for (let i = 0; i < 3; i++)
      await service.create(
        'shared',
        CreateLesson.parse({
          tool: 'instant',
          source: csv.replace('cat', `word${i}`),
          language: 'en',
          requestId: randomUUID(),
        }),
        'a',
      );
    const page = await service.list('shared', 'instant', 2);
    assert.equal(page.data.length, 2);
    assert.equal(page.page.hasMore, true);
    const next = await service.list('shared', 'instant', 2, page.page.nextCursor!);
    assert.equal(next.data.length, 1);
    assert.equal(next.page.nextCursor, null);
    assert.equal(new Set([...page.data, ...next.data].map((q) => q.id)).size, 3);
    await assert.rejects(service.list('shared', 'cards', 2, page.page.nextCursor!), {
      code: 'invalid_cursor',
    });
    await db.execute(
      "CREATE TRIGGER fail_record BEFORE INSERT ON study_records BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    await assert.rejects(
      service.create(
        'shared',
        CreateLesson.parse({
          tool: 'instant',
          source: csv.replace('cat', 'rollback'),
          language: 'en',
          requestId: randomUUID(),
        }),
        'a',
      ),
    );
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM study_contents')).rows[0].n, 3);
    assert.equal((await db.execute('SELECT COUNT(*) AS n FROM study_records')).rows[0].n, 3);
  } finally {
    db.close();
  }
});
