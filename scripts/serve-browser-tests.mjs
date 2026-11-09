import { createClient } from '@libsql/client';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { loadFoundationCatalog, loadPhase2Catalog } from './foundation-catalog.mjs';
import { publishCompactFoundation } from './foundation-compact-publish.mjs';
import { loadEviuCatalog } from './eviu-catalog.mjs';
import { loadFrenchCatalog } from './french-catalog.mjs';
import { publishFoundation } from './foundation-publish.mjs';
await mkdir('.migration-artifacts', { recursive: true });
const db = createClient({
  url: pathToFileURL(
    process.env.KOTOBA_LOCAL_PREVIEW === '1'
      ? resolve('.migration-artifacts/local-preview.db')
      : resolve('.migration-artifacts/browser-test.db'),
  ).href,
});
const existing = await db.execute(
  "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'study_catalog'",
);
if (!existing.rows.length)
  await db.executeMultiple(await readFile('database/changelog/v001/001-study-library.sql', 'utf8'));
const raw = await readFile('docs/ielts/practice-data.js', 'utf8');
const catalog = {
  eviu: await loadEviuCatalog(),
  ielts: JSON.parse(raw.replace(/^\s*window\.IELTS_PRACTICE\s*=\s*/, '').replace(/;\s*$/, '')),
  'markdown-example': await readFile('database/seed/markdown-example.md', 'utf8'),
  'word-order-example': await readFile('database/seed/word-order-example.txt', 'utf8'),
  'work-english-30': JSON.parse(await readFile('database/seed/work-english-30.json', 'utf8')),
  'english-foundation': [...(await loadFoundationCatalog()), ...(await loadPhase2Catalog())],
  french: await loadFrenchCatalog(),
};
const isLocalPreview = process.env.KOTOBA_LOCAL_PREVIEW === '1';
await db.batch(
  Object.entries(catalog)
    .filter(([id]) => !isLocalPreview || id !== 'english-foundation')
    .map(([id, data]) => ({
      sql: 'INSERT INTO study_catalog (id,payload_json,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json',
      args: [id, JSON.stringify(data), new Date().toISOString()],
    })),
  'write',
);
if (isLocalPreview) {
  const found = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['english-foundation'],
  });
  const previous = found.rows[0] ? String(found.rows[0].payload_json) : null;
  const next = JSON.stringify(catalog['english-foundation']);
  const mapping = JSON.parse(
    await readFile('docs/english-foundation/manifest.json', 'utf8'),
  ).filter((entry) => entry.replaces);
  if (
    previous &&
    JSON.parse(previous).some((entry) => mapping.some((item) => item.replaces.includes(entry.id)))
  )
    await publishCompactFoundation(db, previous, next, mapping);
  else await publishFoundation(db, next, previous);
}
db.close();
console.log(
  'Local test mode uses an isolated SQLite fixture, never the configured Turso database.',
);
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '4173'],
  { stdio: 'inherit', env: { ...process.env, KOTOBA_TEST_MODE: '1' } },
);
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
child.on('exit', (code) => process.exit(code || 0));
