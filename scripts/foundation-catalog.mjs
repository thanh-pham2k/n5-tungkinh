import { readFile } from 'node:fs/promises';

const directory =
  'docs/english-foundation/phase-01-build-sentences/module-01-basic-sentence-structure';
const entries = [
  ['lesson-01', 'Lesson 1', 'The Complete Sentence', '01-a-complete-sentence.md'],
  ['lesson-02', 'Lesson 2', 'Subject + Verb', '02-subject-verb.md'],
  ['lesson-03', 'Lesson 3', 'Subject + Verb + Object', '03-subject-verb-object.md'],
  ['lesson-04', 'Lesson 4', 'Subject + be + Noun', '04-subject-be-noun.md'],
  ['lesson-05', 'Lesson 5', 'Subject + be + Adjective', '05-subject-be-adjective.md'],
  ['checkpoint-01', 'Mini Checkpoint', 'Basic Sentence Structure', '06-mini-checkpoint.md'],
];
export async function loadFoundationCatalog() {
  return Promise.all(
    entries.map(async ([id, label, title, file]) => ({
      id,
      label,
      title,
      source: await readFile(`${directory}/${file}`, 'utf8'),
    })),
  );
}
