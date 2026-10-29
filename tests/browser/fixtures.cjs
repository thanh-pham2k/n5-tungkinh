const { test: base, expect } = require('@playwright/test');
const { createClient } = require('@libsql/client');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHmac } = require('node:crypto');

const AUTH_SECRET = process.env.APP_AUTH_SECRET || 'kotoba-lab-auth-signing-key-2026-fixed';

function makeAuthToken(username) {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${username}:${expiresAt}`;
  const hmac = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}:${hmac}`;
}

const test = base.extend({
  resetStudyFixture: [
    async ({ context }, use) => {
      const db = createClient({
        url: pathToFileURL(resolve('.migration-artifacts/browser-test.db')).href,
      });
      await db.batch(
        ['DELETE FROM study_progress', 'DELETE FROM study_records', 'DELETE FROM study_contents'],
        'write',
      );
      db.close();

      await context.addCookies([
        {
          name: 'kotoba-auth-token',
          value: makeAuthToken('thanhpv'),
          domain: '127.0.0.1',
          path: '/',
          httpOnly: true,
          sameSite: 'Strict',
        },
      ]);

      await use();
    },
    { auto: true },
  ],
});
module.exports = { test, expect, makeAuthToken };
