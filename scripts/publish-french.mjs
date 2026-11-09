import { createClient } from '@libsql/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadFrenchCatalog } from './french-catalog.mjs';

const [mode, hostname] = process.argv.slice(2);
const url = process.env.TURSO_DATABASE_URL;
if (
  !['--dry-run', '--apply'].includes(mode) ||
  !url ||
  !process.env.TURSO_AUTH_TOKEN ||
  !hostname ||
  new URL(url).hostname !== hostname
)
  throw new Error(
    'Use --dry-run or --apply with the exact database hostname and server credentials.',
  );
const catalog = await loadFrenchCatalog();
const payload = JSON.stringify(catalog);
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const old = await db.execute({
    sql: 'SELECT payload_json, updated_at FROM study_catalog WHERE id = ?',
    args: ['french'],
  });
  const existing = old.rows[0] ? String(old.rows[0].payload_json) : null;
  await mkdir('.migration-artifacts', { recursive: true });
  const backup = `.migration-artifacts/french-before-${Date.now()}.json`;
  await writeFile(
    backup,
    JSON.stringify(
      { id: 'french', previous: existing, updatedAt: old.rows[0]?.updated_at ?? null },
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
  if (mode === '--apply') {
    if (existing === null) {
      await db.execute({
        sql: 'INSERT INTO study_catalog (id, payload_json, updated_at) VALUES (?, ?, ?)',
        args: ['french', payload, new Date().toISOString()],
      });
    } else if (existing !== payload) {
      await db.execute({
        sql: 'UPDATE study_catalog SET payload_json = ?, updated_at = ? WHERE id = ?',
        args: [payload, new Date().toISOString(), 'french'],
      });
    }
  }
  const check = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['french'],
  });
  if (mode === '--apply' && check.rows[0]?.payload_json !== payload)
    throw new Error('French verification failed.');
  console.log(
    `${mode}: ${catalog.length} validated lessons; existing catalog ${existing === null ? 'absent' : 'matches'}; backup ${backup}${mode === '--apply' ? '; read-back verified' : ''}.`,
  );
} finally {
  db.close();
}
