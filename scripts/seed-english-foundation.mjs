import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
if (
  !url ||
  !process.env.TURSO_AUTH_TOKEN ||
  !process.argv[2] ||
  new URL(url).hostname !== process.argv[2]
) {
  throw new Error('Seed target must explicitly match TURSO_DATABASE_URL hostname.');
}
const source = await readFile(
  'docs/english-foundation/phase-01-build-sentences/module-01-basic-sentence-structure/01-a-complete-sentence.md',
  'utf8',
);
const payload = JSON.stringify(source);
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await db.execute({
    sql: 'INSERT INTO study_catalog (id,payload_json,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING',
    args: ['english-foundation', payload, new Date().toISOString()],
  });
  const result = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['english-foundation'],
  });
  if (result.rows[0]?.payload_json !== payload)
    throw new Error('Existing course differs; refusing to overwrite.');
  console.log('English Foundation catalog verified.');
} finally {
  db.close();
}
