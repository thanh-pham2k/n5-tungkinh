// Read-only connection check. Never log credentials or the database response body.
const databaseUrl = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!databaseUrl || !token) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN.');
  process.exitCode = 1;
} else {
  try {
    const endpoint = new URL(databaseUrl.replace(/^libsql:\/\//, 'https://'));
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
      throw new Error('Invalid database URL');
    }
    endpoint.pathname = '/v2/pipeline';
    endpoint.search = '';
    endpoint.hash = '';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        requests: [{ type: 'execute', stmt: { sql: 'SELECT 1 AS connected' } }, { type: 'close' }],
      }),
    });
    if (!response.ok) {
      console.error(`Turso connection check failed (HTTP ${response.status}).`);
      process.exitCode = 1;
    } else {
      const result = (await response.json()).results?.[0];
      if (result?.type !== 'ok' || String(result.response?.result?.rows?.[0]?.[0]?.value) !== '1') {
        throw new Error('Unexpected database response');
      }
      console.log('Turso connection OK (read-only SELECT 1). No schema or data changed.');
    }
  } catch {
    console.error('Turso connection check failed. Verify server environment and network access.');
    process.exitCode = 1;
  }
}
