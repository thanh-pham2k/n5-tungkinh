import { createHash } from 'node:crypto';
import { preserveFoundationProgress } from './foundation-progress-migration.mjs';

// The catalog compare and progress guard share a write transaction so a concurrent
// lesson import or completion cannot be silently disconnected from its old source.
export async function publishFoundation(
  db,
  payload,
  expectedPrevious,
  preserveIds = [],
  options = {},
) {
  const permitted = new Set(preserveIds);
  const tx = await db.transaction('write');
  try {
    const result = await tx.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: ['english-foundation'],
    });
    const current = result.rows[0] ? String(result.rows[0].payload_json) : null;
    if (current === payload) {
      await tx.commit();
      return;
    }
    if (current !== null) {
      if (!expectedPrevious || current !== expectedPrevious)
        throw new Error('Existing course does not match the reviewed snapshot.');
      const oldCatalog = JSON.parse(current);
      const newCatalog = JSON.parse(payload);
      if (!Array.isArray(oldCatalog) || !Array.isArray(newCatalog))
        throw new Error('Existing catalog must be reviewed and converted before updating.');
      for (const old of oldCatalog) {
        const replacement = newCatalog.find((item) => item.id === old.id);
        if (!replacement) throw new Error(`Refusing to remove existing lesson ${old.id}.`);
        if (replacement.source.trim() === old.source.trim()) continue;
        const hash = createHash('sha256').update(old.source.trim()).digest('hex');
        const progress = await tx.execute({
          sql: 'SELECT COUNT(*) AS total FROM study_progress p JOIN study_contents c ON c.id = p.content_id WHERE c.tool = ? AND c.source_hash = ?',
          args: ['markdown', hash],
        });
        if (Number(progress.rows[0].total) > 0) {
          if (!permitted.has(old.id))
            throw new Error(`Existing lesson ${old.id} has progress; refusing to disconnect it.`);
          if (oldCatalog.filter((item) => item.source.trim() === old.source.trim()).length !== 1)
            throw new Error(
              `Existing lesson ${old.id} shares its source with another catalog item.`,
            );
          await preserveFoundationProgress(tx, old.source, replacement.source, options);
        }
      }
      const updated = await tx.execute({
        sql: 'UPDATE study_catalog SET payload_json = ?, updated_at = ? WHERE id = ? AND payload_json = ?',
        args: [payload, new Date().toISOString(), 'english-foundation', current],
      });
      if (updated.rowsAffected !== 1) throw new Error('Course changed during update.');
    } else {
      await tx.execute({
        sql: 'INSERT INTO study_catalog (id, payload_json, updated_at) VALUES (?, ?, ?)',
        args: ['english-foundation', payload, new Date().toISOString()],
      });
    }
    const verified = await tx.execute({
      sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
      args: ['english-foundation'],
    });
    if (verified.rows[0]?.payload_json !== payload) throw new Error('Course verification failed.');
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
