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
export const loadPhase3Catalog = () => loadPhase(3);
export const loadPhase4Catalog = () => loadPhase(4);
export const loadAllFoundationPhases = async () => [
  ...(await loadPhase(1)),
  ...(await loadPhase(2)),
  ...(await loadPhase(3)),
  ...(await loadPhase(4)),
];
