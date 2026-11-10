import { createHash, randomUUID } from 'node:crypto';
import parser from '../src/services/lesson-parser.cjs';

// Called only inside a reviewed catalog publication transaction. Keep current
// content IDs (and therefore progress/version), while log entries keep the old source.
export async function preserveFoundationProgress(tx, oldSource, newSource, options = {}) {
  const oldText = oldSource.trim();
  const nextText = newSource.trim();
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  const oldHash = hash(oldText);
  const newHash = hash(nextText);
  if (oldHash === newHash) return;
  const parsed = parser.parse(nextText);
  if (!parsed.length || parsed.some((block) => block.type === 'error'))
    throw new Error('Updated lesson is not valid Markdown quiz content.');
  const previousParsed = parser.parse(oldText);
  const signature = (blocks) =>
    blocks
      .filter((block) => block.type === 'deck')
      .flatMap((block) => block.quizzes)
      .map(({ id, type, answer, options, tokens }) => ({ id, type, answer, options, tokens }));
  if (previousParsed.some((block) => block.type === 'error'))
    throw new Error('Previous lesson is not valid Markdown quiz content.');
  const quizChanged =
    JSON.stringify(signature(previousParsed)) !== JSON.stringify(signature(parsed));
  if (quizChanged && !options.preserveCompletionOnly)
    throw new Error('Quiz content changed; progress must be reviewed separately.');
  const first = parsed[0];
  const title = String(
    first.topic ||
      first.question ||
      first.vocabulary ||
      first.prompt ||
      first.content ||
      first.quizzes?.[0]?.question ||
      'Bài học',
  )
    .replace(/\s+/g, ' ')
    .slice(0, 100);
  const originals = await tx.execute({
    sql: 'SELECT * FROM study_contents WHERE tool = ? AND source_hash = ?',
    args: ['markdown', oldHash],
  });
  for (const row of originals.rows) {
    if (quizChanged) {
      const states = await tx.execute({
        sql: 'SELECT state_json FROM study_progress WHERE content_id = ?',
        args: [row.id],
      });
      for (const state of states.rows) {
        const value = JSON.parse(String(state.state_json));
        if (
          !value ||
          Array.isArray(value) ||
          typeof value !== 'object' ||
          Object.keys(value).some(
            (key) =>
              ![
                'foundationCompletedAt',
                'foundationCompletionCount',
                'foundationMergedParts',
              ].includes(key),
          )
        )
          throw new Error('Progress includes quiz state; manual reconciliation required.');
      }
    }
    if (String(row.source) !== oldText) throw new Error('Old source does not match its hash.');
    const collision = await tx.execute({
      sql: 'SELECT id FROM study_contents WHERE library_id = ? AND tool = ? AND language = ? AND source_hash = ?',
      args: [row.library_id, row.tool, row.language, newHash],
    });
    if (collision.rows.length)
      throw new Error('Updated content already exists; manual reconciliation required.');
    const historicalId = randomUUID();
    const update = await tx.execute({
      sql: 'UPDATE study_contents SET source = ?, source_hash = ?, parsed_json = ?, item_count = ?, title = ? WHERE id = ? AND source_hash = ?',
      args: [nextText, newHash, JSON.stringify(parsed), parsed.length, title, row.id, oldHash],
    });
    if (update.rowsAffected !== 1) throw new Error('Content changed during migration.');
    await tx.execute({
      sql: `INSERT INTO study_contents (id, library_id, tool, title, language, source, source_hash, parsed_json, item_count, created_at, last_studied_at, study_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        historicalId,
        row.library_id,
        row.tool,
        row.title,
        row.language,
        row.source,
        row.source_hash,
        row.parsed_json,
        row.item_count,
        row.created_at,
        row.last_studied_at,
        row.study_count,
      ],
    });
    await tx.execute({
      sql: 'UPDATE study_records SET content_id = ? WHERE content_id = ? AND library_id = ?',
      args: [historicalId, row.id, row.library_id],
    });
    await tx.execute({
      sql: `INSERT INTO study_progress (content_id, library_id, state_json, version, updated_at)
                            SELECT ?, library_id, state_json, version, updated_at FROM study_progress WHERE content_id = ?`,
      args: [historicalId, row.id],
    });
  }
}
