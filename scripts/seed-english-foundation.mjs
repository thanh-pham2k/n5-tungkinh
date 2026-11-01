import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { loadFoundationCatalog, loadPhase2Catalog } from './foundation-catalog.mjs';
import { publishFoundation } from './foundation-publish.mjs';

const url = process.env.TURSO_DATABASE_URL;
if (
  !url ||
  !process.env.TURSO_AUTH_TOKEN ||
  !process.argv[2] ||
  new URL(url).hostname !== process.argv[2]
) {
  throw new Error('Seed target must explicitly match TURSO_DATABASE_URL hostname.');
}
const payload = JSON.stringify([
  ...(await loadFoundationCatalog()),
  ...(await loadPhase2Catalog()),
]);
const previous = process.argv[3]
  ? JSON.stringify(JSON.parse(await readFile(process.argv[3], 'utf8')))
  : null;
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await publishFoundation(db, payload, previous);
  console.log('English Foundation catalog verified.');
} finally {
  db.close();
}
