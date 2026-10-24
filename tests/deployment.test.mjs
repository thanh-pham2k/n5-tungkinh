import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readNextConfig(vercel) {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import config from './next.config.mjs';console.log(JSON.stringify(config));",
    ],
    { encoding: 'utf8', env: { ...process.env, VERCEL: vercel, NEXT_PUBLIC_BASE_PATH: '' } },
  );
  assert.equal(result.status, 0);
  return JSON.parse(result.stdout);
}
test('Vercel uses the Next.js server build; local preview keeps static export', () => {
  assert.equal(readNextConfig('1').output, undefined);
  assert.equal(readNextConfig('').output, 'export');
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, 'nextjs');
  assert.equal(config.outputDirectory, '.next');
  assert.equal(config.env, undefined);
  assert.equal(config.build?.env, undefined);
});
test('local credentials are ignored by Git and excluded from Vercel uploads', () => {
  const ignored = spawnSync('git', ['check-ignore', '-q', '.env.local']);
  assert.equal(ignored.status, 0);
  assert.match(readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8'), /^\.env\*$/m);
  assert.doesNotMatch(
    readFileSync(new URL('../.env.example', import.meta.url), 'utf8'),
    /eyJ[a-zA-Z0-9_-]+\./,
  );
});
