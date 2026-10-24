const { test: base, expect } = require('@playwright/test');
const { createClient } = require('@libsql/client');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const test = base.extend({
  resetStudyFixture: [
    async ({}, use) => {
      const db = createClient({
        url: pathToFileURL(resolve('.migration-artifacts/browser-test.db')).href,
      });
      await db.batch(
        ['DELETE FROM study_progress', 'DELETE FROM study_records', 'DELETE FROM study_contents'],
        'write',
      );
      db.close();
      await use();
    },
    { auto: true },
  ],
});
module.exports = { test, expect };
