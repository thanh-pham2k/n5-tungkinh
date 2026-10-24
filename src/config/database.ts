import { createClient, type Client } from '@libsql/client';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
let client: Client | undefined;
export function database() {
  if (client) return client;
  // Explicitly isolated browser-test fixture. Vercel can never use a local database.
  if (process.env.KOTOBA_TEST_MODE === '1' && !process.env.VERCEL) {
    client = createClient({
      url: pathToFileURL(resolve('.migration-artifacts/browser-test.db')).href,
    });
    return client;
  }
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken || !url.startsWith('libsql://'))
    throw new Error('Database configuration unavailable');
  client = createClient({
    url,
    authToken,
    fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      }),
  });
  return client;
}
