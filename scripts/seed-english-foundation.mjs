import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { loadFoundationCatalog } from './foundation-catalog.mjs';

const url = process.env.TURSO_DATABASE_URL;
if (
  !url ||
  !process.env.TURSO_AUTH_TOKEN ||
  !process.argv[2] ||
  new URL(url).hostname !== process.argv[2]
) {
  throw new Error('Seed target must explicitly match TURSO_DATABASE_URL hostname.');
}
const payload = JSON.stringify(await loadFoundationCatalog());
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
  if (result.rows[0]?.payload_json !== payload) {
    if (!process.argv[3])
      throw new Error('Existing course differs; provide a reviewed JSON snapshot.');
    const previous = JSON.stringify(JSON.parse(await readFile(process.argv[3], 'utf8')));
    if (result.rows[0]?.payload_json !== previous)
      throw new Error('Existing course does not match the reviewed snapshot.');
    const changed = await db.execute({
      sql: 'UPDATE study_catalog SET payload_json = ?, updated_at = ? WHERE id = ? AND payload_json = ?',
      args: [payload, new Date().toISOString(), 'english-foundation', previous],
    });
    if (changed.rowsAffected !== 1)
      throw new Error('Course changed during update; refusing to overwrite.');
    const verified = await db.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: ['english-foundation'],
    });
    if (verified.rows[0]?.payload_json !== payload) throw new Error('Course verification failed.');
  }
  console.log('English Foundation catalog verified.');
} finally {
  db.close();
}
