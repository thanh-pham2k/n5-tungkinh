import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';

const expectedHost = process.argv[2];
const allowUpdate = process.argv.includes('--update');
const url = process.env.TURSO_DATABASE_URL;
if (
  !url ||
  !expectedHost ||
  new URL(url).hostname !== expectedHost ||
  !process.env.TURSO_AUTH_TOKEN
)
  throw new Error('Target must explicitly match the configured Turso hostname.');

const payload = JSON.stringify(
  JSON.parse(await readFile('database/seed/visual-samples.json', 'utf8')),
);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  const transaction = await db.transaction('write');
  try {
    const existing = await transaction.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: ['visual-samples'],
    });
    if (
      existing.rows.length &&
      !allowUpdate &&
      digest(String(existing.rows[0].payload_json)) !== digest(payload)
    )
      throw new Error('Existing Visual Samples config differs; pass --update to overwrite.');
    if (!existing.rows.length) {
      await transaction.execute({
        sql: 'INSERT INTO study_catalog (id, payload_json, updated_at) VALUES (?, ?, ?)',
        args: ['visual-samples', payload, new Date().toISOString()],
      });
    } else if (allowUpdate) {
      await transaction.execute({
        sql: 'UPDATE study_catalog SET payload_json = ?, updated_at = ? WHERE id = ?',
        args: [payload, new Date().toISOString(), 'visual-samples'],
      });
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  const stored = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['visual-samples'],
  });
  if (digest(String(stored.rows[0]?.payload_json)) !== digest(payload))
    throw new Error('Visual Samples catalog verification failed.');
  console.log('Visual Samples catalog verified in Turso.');
} finally {
  db.close();
}
