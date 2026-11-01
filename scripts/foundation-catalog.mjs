import { readFile } from 'node:fs/promises';

const directory = 'docs/english-foundation';
async function loadPhase(phase) {
  const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'));
  return Promise.all(
    manifest
      .filter((entry) => entry.phase === phase)
      .map(async ({ file, replaces, ...entry }) => ({
        ...entry,
        source: await readFile(`${directory}/${file}`, 'utf8'),
      })),
  );
}
export const loadFoundationCatalog = () => loadPhase(1);
export const loadPhase2Catalog = () => loadPhase(2);
