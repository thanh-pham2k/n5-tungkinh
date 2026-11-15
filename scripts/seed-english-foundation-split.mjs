import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { loadAllFoundationPhases } from './foundation-catalog.mjs';
import { publishSplitFoundation } from './foundation-split-publish.mjs';

const url = process.env.TURSO_DATABASE_URL;
const [hostname, snapshotPath] = process.argv.slice(2);
if (
  !url ||
  !process.env.TURSO_AUTH_TOKEN ||
  !hostname ||
  !snapshotPath ||
  new URL(url).hostname !== hostname
) {
  throw new Error('Provide the exact target database hostname and the reviewed snapshot path.');
}
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const previous = snapshot.study_catalog?.find(
  (item) => item.id === 'english-foundation',
)?.payload_json;
if (typeof previous !== 'string') {
  throw new Error('Snapshot does not contain the Foundation catalog.');
}
const splitEntries = JSON.parse(
  await readFile('docs/english-foundation/manifest.json', 'utf8'),
).filter((item) => item.splitFrom);
const next = JSON.stringify(await loadAllFoundationPhases());
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await publishSplitFoundation(db, previous, next, splitEntries);
  const result = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['english-foundation'],
  });
  if (result.rows[0]?.payload_json !== next) {
    throw new Error('Updated catalog verification failed.');
  }
  console.log('Split Foundation catalog verified.');
} finally {
  db.close();
}
