import { createClient } from '@libsql/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadEviuCatalog } from './eviu-catalog.mjs';

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
const catalog = await loadEviuCatalog();
const payload = JSON.stringify(catalog);
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const old = await db.execute({
    sql: 'SELECT payload_json, updated_at FROM study_catalog WHERE id = ?',
    args: ['eviu'],
  });
  const existing = old.rows[0] ? String(old.rows[0].payload_json) : null;
  if (existing !== null && existing !== payload)
    throw new Error(
      'EVIU catalog exists and differs; refusing to overwrite progress-linked content.',
    );
  await mkdir('.migration-artifacts', { recursive: true });
  const backup = `.migration-artifacts/eviu-before-${Date.now()}.json`;
  await writeFile(
    backup,
    JSON.stringify(
      { id: 'eviu', previous: existing, updatedAt: old.rows[0]?.updated_at ?? null },
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
  if (mode === '--apply' && existing === null) {
    await db.execute({
      sql: 'INSERT INTO study_catalog (id, payload_json, updated_at) VALUES (?, ?, ?)',
      args: ['eviu', payload, new Date().toISOString()],
    });
  }
  const check = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['eviu'],
  });
  if (mode === '--apply' && check.rows[0]?.payload_json !== payload)
    throw new Error('EVIU verification failed.');
  console.log(
    `${mode}: ${catalog.length} validated lessons; existing catalog ${existing === null ? 'absent' : 'matches'}; backup ${backup}${mode === '--apply' ? '; read-back verified' : ''}.`,
  );
} finally {
  db.close();
}
