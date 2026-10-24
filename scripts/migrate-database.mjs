// Apply the reviewed Liquibase update-sql output only to the intended, initially empty Turso DB.
// Never called by build, startup or requests. BEGIN IMMEDIATE serializes remote migration runners.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
const [, , sqlPath, expectedHost] = process.argv;
if (!sqlPath || !expectedHost)
  throw new Error('Usage: db:migrate <Liquibase-generated.sql> <expected-database-host>');
const url = process.env.TURSO_DATABASE_URL;
if (!url || new URL(url).hostname !== expectedHost || !process.env.TURSO_AUTH_TOKEN)
  throw new Error('Migration target does not match environment.');
const sql = await readFile(sqlPath, 'utf8');
const checksum = sql.match(/'9:[a-f0-9]+'/)?.[0].slice(1, -1);
if (!checksum || !sql.includes('Liquibase version: 4.33.0') || !sql.includes('001-study-library'))
  throw new Error('Expected reviewed Liquibase 4.33.0 output with ledger tracking.');
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const tx = await db.transaction('write');
try {
  const tables = await tx.execute(
    "SELECT name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  if (tables.rows.length) {
    if (!tables.rows.some((r) => r.name === 'DATABASECHANGELOG'))
      throw new Error('Non-empty target has no Liquibase ledger. Refusing baseline migration.');
    const ledger = await tx.execute(
      "SELECT MD5SUM FROM DATABASECHANGELOG WHERE ID = '001-study-library' AND AUTHOR = 'kotoba' AND FILENAME = 'database/changelog/v001/001-study-library.sql'",
    );
    if (ledger.rows.length !== 1 || ledger.rows[0].MD5SUM !== checksum)
      throw new Error(
        'Migration checksum mismatch. Generate a new changeset; never edit an applied one.',
      );
    await tx.commit();
    console.log('Migration already applied; checksum matches. No changes.');
  } else {
    await mkdir('.migration-artifacts', { recursive: true });
    await writeFile(
      `.migration-artifacts/baseline-${Date.now()}.json`,
      JSON.stringify({ expectedHost, tables: tables.rows, checksum }),
    );
    await tx.executeMultiple(sql);
    const ledger = await tx.execute(
      "SELECT MD5SUM FROM DATABASECHANGELOG WHERE ID = '001-study-library'",
    );
    if (ledger.rows[0]?.MD5SUM !== checksum) throw new Error('Tracking verification failed.');
    await tx.commit();
    console.log('Liquibase schema and ledger applied atomically to verified Turso target.');
  }
} catch (error) {
  await tx.rollback();
  throw error;
} finally {
  tx.close();
  db.close();
}
