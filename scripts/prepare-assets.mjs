import { mkdir, readFile, readdir, copyFile, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const practiceSource = await readFile(path.join(root, 'docs/ielts/practice-data.js'), 'utf8');
const practiceMatch = practiceSource.match(/^\s*window\.IELTS_PRACTICE\s*=\s*([\s\S]*?)\s*;?\s*$/);
if (!practiceMatch)
  throw new Error('IELTS source must assign a JSON object to window.IELTS_PRACTICE.');
const practiceData = JSON.parse(practiceMatch[1].replace(/;\s*$/, ''));
await mkdir(path.join(root, 'src/data'), { recursive: true });
await writeFile(
  path.join(root, 'src/data/practice-data.js'),
  `// Generated from docs/ielts/practice-data.js. Do not edit.\nexport default ${JSON.stringify(practiceData)};\n`,
);
const lessons = [];
await mkdir(path.join(root, 'public/data'), { recursive: true });
for (const name of (await readdir(path.join(root, 'input')))
  .filter((name) => name.endsWith('.txt'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  const slug = path.basename(name, '.txt');
  const text = await readFile(path.join(root, 'input', name), 'utf8');
  const groups = text
    .replace(/^\uFEFF/, '')
    .split(/^\s*---\s*$/m)
    .map((group) =>
      group
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((group) => group.length);
  const tracks = [];
  for (const [index, lines] of groups.entries()) {
    const file = `${slug}_group_${String(index + 1).padStart(2, '0')}.mp3`;
    const source = path.join(root, 'output', slug, file);
    try {
      await access(source);
    } catch {
      continue;
    }
    const relative = `audio/${slug}/${file}`;
    await mkdir(path.join(root, 'public/audio', slug), { recursive: true });
    await copyFile(source, path.join(root, 'public', relative));
    const items = lines
      .map((line) => {
        const separator = line.includes('\t') ? '\t' : ' - ';
        const at = line.indexOf(separator);
        return at < 0
          ? null
          : {
              japanese: line.slice(0, at).trim(),
              vietnamese: line.slice(at + separator.length).trim(),
            };
      })
      .filter(Boolean);
    tracks.push({ label: `Nhóm ${index + 1}`, src: relative, items });
  }
  if (tracks.length)
    lessons.push({ id: slug, title: /^\d+$/.test(slug) ? `Bài ${slug}` : slug, tracks });
}
await writeFile(
  path.join(root, 'public/data/lesson-mapper.json'),
  JSON.stringify({ lessons }, null, 2) + '\n',
);
await writeFile(path.join(root, 'public/.nojekyll'), '');
console.log(`Prepared ${lessons.length} lessons with available public MP3 files.`);
