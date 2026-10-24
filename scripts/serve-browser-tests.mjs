import { createClient } from '@libsql/client';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
await mkdir('.migration-artifacts', { recursive: true });
const db = createClient({
  url: pathToFileURL(resolve('.migration-artifacts/browser-test.db')).href,
});
const existing = await db.execute(
  "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'study_catalog'",
);
if (!existing.rows.length)
  await db.executeMultiple(await readFile('database/changelog/v001/001-study-library.sql', 'utf8'));
const raw = await readFile('docs/ielts/practice-data.js', 'utf8');
const catalog = {
  ielts: JSON.parse(raw.replace(/^\s*window\.IELTS_PRACTICE\s*=\s*/, '').replace(/;\s*$/, '')),
  'markdown-example': await readFile('database/seed/markdown-example.md', 'utf8'),
  'word-order-example': await readFile('database/seed/word-order-example.txt', 'utf8'),
};
await db.batch(
  Object.entries(catalog).map(([id, data]) => ({
    sql: 'INSERT INTO study_catalog (id,payload_json,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json',
    args: [id, JSON.stringify(data), new Date().toISOString()],
  })),
  'write',
);
db.close();
console.log('Browser tests use isolated SQLite fixture, never the configured Turso database.');
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '4173'],
  { stdio: 'inherit', env: { ...process.env, KOTOBA_TEST_MODE: '1' } },
);
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
child.on('exit', (code) => process.exit(code || 0));
