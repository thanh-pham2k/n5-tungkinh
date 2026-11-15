import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { loadEviuCatalog } from './eviu-catalog.mjs';

const [hostname, snapshotPath] = process.argv.slice(2);
const url = process.env.TURSO_DATABASE_URL;
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
const previous = snapshot.study_catalog?.find((item) => item.id === 'eviu')?.payload_json;
if (typeof previous !== 'string') {
  throw new Error('Snapshot does not contain the EVIU catalog.');
}

const next = JSON.stringify(await loadEviuCatalog());
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const update = await db.execute({
    sql: 'UPDATE study_catalog SET payload_json = ?, updated_at = ? WHERE id = ? AND payload_json = ?',
    args: [next, new Date().toISOString(), 'eviu', previous],
  });
  if (update.rowsAffected !== 1) {
    const current = await db.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: ['eviu'],
    });
    if (current.rows[0]?.payload_json === next) {
      console.log('EVIU split catalog already up to date.');
    } else {
      throw new Error('EVIU catalog does not match snapshot.');
    }
  } else {
    console.log('Split EVIU catalog verified.');
  }
} finally {
  db.close();
}
