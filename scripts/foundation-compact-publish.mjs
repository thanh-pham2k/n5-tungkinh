import { createHash, randomUUID } from 'node:crypto';
import parser from '../src/services/lesson-parser.cjs';

const sourceHash = (value) => createHash('sha256').update(value.trim()).digest('hex');

// Replaces the catalog only after an exact snapshot check. Old contents, records,
// and progress are never modified. A merged lesson inherits completion only when
// every constituent lesson was completed in that account.
export async function publishCompactFoundation(db, previousPayload, nextPayload, mapping) {
  const before = JSON.parse(previousPayload);
  const after = JSON.parse(nextPayload);
  if (!Array.isArray(before) || !Array.isArray(after) || !Array.isArray(mapping))
    throw new Error('Invalid catalog or mapping.');
  const oldLessons = before.filter((item) => !item.id.includes('checkpoint'));
  const ids = mapping.flatMap((item) => item.replaces);
  if (
    ids.length !== oldLessons.length ||
    new Set(ids).size !== ids.length ||
    oldLessons.some((item) => !ids.includes(item.id))
  )
    throw new Error('Mapping must cover each previous lesson exactly once.');
  if (
    new Set(after.map((item) => item.id)).size !== after.length ||
    mapping.some((item) => !after.some((entry) => entry.id === item.id))
  )
    throw new Error('New catalog or mapping IDs are invalid.');
  const checkpoints = before.filter((item) => item.id.includes('checkpoint'));
  if (
    after.length !== mapping.length + checkpoints.length ||
    new Set(mapping.map((item) => item.id)).size !== mapping.length ||
    mapping.some((item) => !Array.isArray(item.replaces) || item.replaces.length === 0) ||
    checkpoints.some(
      (item) => !after.some((entry) => entry.id === item.id && entry.source === item.source),
    )
  )
    throw new Error('Checkpoint content must remain unchanged.');
  const transaction = await db.transaction('write');
  try {
    const catalog = await transaction.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: ['english-foundation'],
    });
    if (catalog.rows[0]?.payload_json === nextPayload) {
      await transaction.commit();
      return;
    }
    if (catalog.rows[0]?.payload_json !== previousPayload)
      throw new Error('Catalog changed since review.');
    for (const target of mapping) {
      const item = after.find((entry) => entry.id === target.id);
      const sources = target.replaces.map((id) => before.find((entry) => entry.id === id));
      if (
        sources.some(
          (entry) =>
            !entry || (entry.module || 1) !== item.module || (entry.phase || 1) !== item.phase,
        )
      )
        throw new Error(`Invalid source mapping for ${target.id}.`);
      const parsed = parser.parse(item.source.trim());
      if (!parsed.length || parsed.some((block) => block.type === 'error'))
        throw new Error(`Invalid lesson ${target.id}.`);
      const byLibrary = new Map();
      for (const old of sources) {
        const rows = await transaction.execute({
          sql: `SELECT c.library_id, p.state_json FROM study_contents c JOIN study_progress p ON p.content_id = c.id AND p.library_id = c.library_id WHERE c.tool = 'markdown' AND c.language = 'en' AND c.source_hash = ?`,
          args: [sourceHash(old.source)],
        });
        for (const row of rows.rows) {
          const completed = JSON.parse(String(row.state_json)).foundationCompletedAt;
          if (typeof completed !== 'string' || Number.isNaN(Date.parse(completed))) continue;
          const library = String(row.library_id);
          if (!byLibrary.has(library)) byLibrary.set(library, new Map());
          byLibrary.get(library).set(old.id, completed);
        }
      }
      for (const [library, completed] of byLibrary) {
        const collision = await transaction.execute({
          sql: `SELECT id FROM study_contents WHERE library_id = ? AND tool = 'markdown' AND language = 'en' AND source_hash = ?`,
          args: [library, sourceHash(item.source)],
        });
        if (collision.rows.length)
          throw new Error(`Merged lesson already exists for ${library}: ${target.id}.`);
        const id = randomUUID();
        const date = [...completed.values()].sort().at(-1);
        const now = new Date().toISOString();
        const title = String(parsed[0].content || 'Bài học')
          .replace(/\s+/g, ' ')
          .slice(0, 100);
        await transaction.execute({
          sql: `INSERT INTO study_contents (id,library_id,tool,title,language,source,source_hash,parsed_json,item_count,created_at,last_studied_at,study_count) VALUES (?,?,'markdown',?,'en',?,?,?,?,?,?,1)`,
          args: [
            id,
            library,
            title,
            item.source.trim(),
            sourceHash(item.source),
            JSON.stringify(parsed),
            parsed.length,
            now,
            date,
          ],
        });
        const progress = { foundationMergedParts: Object.fromEntries(completed) };
        if (completed.size === sources.length) progress.foundationCompletedAt = date;
        await transaction.execute({
          sql: 'INSERT INTO study_progress (content_id,library_id,state_json,version,updated_at) VALUES (?,?,?,?,?)',
          args: [id, library, JSON.stringify(progress), 1, now],
        });
      }
    }
    const update = await transaction.execute({
      sql: 'UPDATE study_catalog SET payload_json = ?, updated_at = ? WHERE id = ? AND payload_json = ?',
      args: [nextPayload, new Date().toISOString(), 'english-foundation', previousPayload],
    });
    if (update.rowsAffected !== 1) throw new Error('Catalog changed during update.');
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}
