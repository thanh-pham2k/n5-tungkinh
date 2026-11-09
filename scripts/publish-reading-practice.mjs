import { createHash } from 'node:crypto';
import { createClient } from '@libsql/client';
import { loadReadingPracticeCatalog } from './reading-practice-catalog.mjs';

const expectedHost = process.argv[2];
const url = process.env.TURSO_DATABASE_URL;
if (
  !url ||
  !expectedHost ||
  new URL(url).hostname !== expectedHost ||
  !process.env.TURSO_AUTH_TOKEN
)
  throw new Error('Target must explicitly match the configured Turso hostname.');
const payload = JSON.stringify(await loadReadingPracticeCatalog());
const digest = (value) => createHash('sha256').update(value).digest('hex');
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const transaction = await db.transaction('write');
  try {
    const existing = await transaction.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: ['reading-practice'],
    });
    if (existing.rows.length && digest(String(existing.rows[0].payload_json)) !== digest(payload))
      throw new Error('Existing Reading Practice catalog differs; refusing to overwrite.');
    if (!existing.rows.length)
      await transaction.execute({
        sql: 'INSERT INTO study_catalog (id, payload_json, updated_at) VALUES (?, ?, ?)',
        args: ['reading-practice', payload, new Date().toISOString()],
      });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  const stored = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['reading-practice'],
  });
  if (digest(String(stored.rows[0]?.payload_json)) !== digest(payload))
    throw new Error('Catalog verification failed.');
  console.log('Reading Practice catalog verified: 60 lessons.');
} finally {
  db.close();
}
