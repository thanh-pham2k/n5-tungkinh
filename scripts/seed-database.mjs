import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@libsql/client';
const expectedHost = process.argv[2];
const url = process.env.TURSO_DATABASE_URL;
if (
  !url ||
  !expectedHost ||
  new URL(url).hostname !== expectedHost ||
  !process.env.TURSO_AUTH_TOKEN
)
  throw new Error('Seed target must explicitly match TURSO_DATABASE_URL hostname.');
const input = await readFile('docs/ielts/practice-data.js', 'utf8');
const ielts = JSON.parse(
  input.replace(/^\s*window\.IELTS_PRACTICE\s*=\s*/, '').replace(/;\s*$/, ''),
);
const catalog = {
  ielts,
  'markdown-example': await readFile('database/seed/markdown-example.md', 'utf8'),
  'word-order-example': await readFile('database/seed/word-order-example.txt', 'utf8'),
};
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  // No schema changes here; replacing a catalogue is a separate explicit operator command.
  await db.batch(
    Object.entries(catalog).map(([id, data]) => ({
      sql: 'INSERT INTO study_catalog (id, payload_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING',
      args: [id, JSON.stringify(data), new Date().toISOString()],
    })),
    'write',
  );
  for (const [id, data] of Object.entries(catalog)) {
    const stored = await db.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: [id],
    });
    const digest = (text) => createHash('sha256').update(text).digest('hex');
    if (digest(String(stored.rows[0]?.payload_json)) !== digest(JSON.stringify(data)))
      throw new Error(`Existing ${id} differs. Refusing automatic overwrite.`);
  }
  console.log(
    'Turso catalogue verified: IELTS + Markdown and Word Order examples. Existing user lessons unchanged.',
  );
} finally {
  db.close();
}
