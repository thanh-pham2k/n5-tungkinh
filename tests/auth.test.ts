import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { USERS, signUser, verifyUserToken } from '../src/modules/auth/auth';
import { studyRepository } from '../src/modules/study/repository';
import { createStudyService } from '../src/modules/study/service';
import { CreateLesson } from '../src/contracts/study-contract';

const schema = readFileSync(
  new URL('../database/changelog/v001/001-study-library.sql', import.meta.url),
  'utf8',
);

test('configured accounts are thanhpv and yentr with password 1', () => {
  assert.equal(USERS.thanhpv?.password, '1');
  assert.equal(USERS.thanhpv?.username, 'thanhpv');
  assert.equal(USERS.yentr?.password, '1');
  assert.equal(USERS.yentr?.username, 'yentr');
  assert.equal(Object.keys(USERS).length, 2);
});

test('auth token signs correctly and verifies valid users', () => {
  const tokenThanh = signUser('thanhpv');
  const verifiedThanh = verifyUserToken(tokenThanh);
  assert.ok(verifiedThanh);
  assert.equal(verifiedThanh.username, 'thanhpv');

  const tokenYen = signUser('yentr');
  const verifiedYen = verifyUserToken(tokenYen);
  assert.ok(verifiedYen);
  assert.equal(verifiedYen.username, 'yentr');
});

test('auth token rejects tampered signature or invalid users', () => {
  const token = signUser('thanhpv');
  const [payload, signature] = token.split('.');
  assert.equal(verifyUserToken(`${payload}.invalidsig`), null);
  assert.equal(verifyUserToken('random-garbage'), null);
  assert.equal(verifyUserToken(''), null);
  assert.equal(verifyUserToken(undefined), null);

  // Unknown user payload
  const fakePayload = Buffer.from(
    JSON.stringify({ username: 'unknown_user', exp: Date.now() + 10000 }),
  ).toString('base64url');
  assert.equal(verifyUserToken(`${fakePayload}.${signature}`), null);
});

test('study data is strictly isolated between thanhpv and yentr accounts', async () => {
  const db = createClient({ url: 'file::memory:' });
  await db.executeMultiple(schema);
  const service = createStudyService(studyRepository(db));

  try {
    const csvThanh =
      'vocabulary,hiragana,meaning_vi,example_ja,example_vi\ncat,,mèo,This is a cat.,Đây là mèo.';
    const inputThanh = CreateLesson.parse({
      tool: 'instant',
      source: csvThanh,
      language: 'en',
      requestId: randomUUID(),
    });

    // 1. thanhpv creates a lesson
    const lessonThanh = await service.create('thanhpv', inputThanh, 'thanhpv');
    assert.equal(lessonThanh.itemCount, 1);

    // 2. yentr lists lessons - must be empty
    const yentrList = await service.list('yentr', 'instant', 20);
    assert.equal(yentrList.data.length, 0);

    // 3. thanhpv lists lessons - sees 1 lesson
    const thanhpvList = await service.list('thanhpv', 'instant', 20);
    assert.equal(thanhpvList.data.length, 1);
    assert.equal(thanhpvList.data[0].id, lessonThanh.id);

    // 4. yentr attempts to read thanhpv's lesson directly - throws 404
    await assert.rejects(service.get('yentr', lessonThanh.id, 'yentr'), {
      code: 'not_found',
    });

    // 5. thanhpv saves progress
    await service.progress('thanhpv', 'thanhpv', lessonThanh.id, 0, {
      completed: true,
      score: 100,
    });
    const thanhpvLoaded = await service.get('thanhpv', lessonThanh.id, 'thanhpv');
    assert.deepEqual(thanhpvLoaded.progress, { completed: true, score: 100 });

    // 6. yentr cannot update thanhpv's progress
    await assert.rejects(
      service.progress('yentr', 'yentr', lessonThanh.id, 0, { completed: false }),
      { code: 'not_found' },
    );

    // 7. yentr creates their own lesson (even with the same source CSV)
    const inputYen = CreateLesson.parse({
      tool: 'instant',
      source: csvThanh,
      language: 'en',
      requestId: randomUUID(),
    });
    const lessonYen = await service.create('yentr', inputYen, 'yentr');
    assert.ok(lessonYen.id);

    // Verify logs are isolated
    const thanhpvLogs = await service.listLogs('thanhpv', 'instant', 20);
    const yentrLogs = await service.listLogs('yentr', 'instant', 20);
    assert.equal(thanhpvLogs.data.length, 1);
    assert.equal(yentrLogs.data.length, 1);
    assert.notEqual(thanhpvLogs.data[0].id, yentrLogs.data[0].id);

    // 8. thanhpv removes their log, yentr's log remains unaffected
    await service.removeLog('thanhpv', thanhpvLogs.data[0].id);
    const thanhpvLogsAfter = await service.listLogs('thanhpv', 'instant', 20);
    const yentrLogsAfter = await service.listLogs('yentr', 'instant', 20);
    assert.equal(thanhpvLogsAfter.data.length, 0);
    assert.equal(yentrLogsAfter.data.length, 1);
  } finally {
    db.close();
  }
});
