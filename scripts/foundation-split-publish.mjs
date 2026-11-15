import parser from '../src/services/lesson-parser.cjs';

// Replaces the catalog only after an exact snapshot check.
// Old contents, records, and progress in Turso remain untouched.
export async function publishSplitFoundation(db, previousPayload, nextPayload, splitEntries) {
  const before = JSON.parse(previousPayload);
  const after = JSON.parse(nextPayload);
  if (!Array.isArray(before) || !Array.isArray(after) || !Array.isArray(splitEntries)) {
    throw new Error('Invalid catalog or split mapping.');
  }
  const oldIds = new Set(
    before
      .filter((item) => (item.phase === 1 || item.phase === 2) && !item.id.includes('checkpoint'))
      .map((item) => item.id),
  );
  const covered = new Set(splitEntries.map((item) => item.splitFrom));
  if (oldIds.size !== covered.size || [...oldIds].some((id) => !covered.has(id))) {
    throw new Error('Split entries must cover every previous Phase 1-2 non-checkpoint lesson.');
  }
  if (new Set(after.map((item) => item.id)).size !== after.length) {
    throw new Error('New catalog IDs must be unique.');
  }
  const preserved = before.filter(
    (item) => item.id.includes('checkpoint') || (item.phase !== 1 && item.phase !== 2),
  );
  if (
    preserved.some(
      (item) => !after.some((entry) => entry.id === item.id && entry.source === item.source),
    )
  ) {
    throw new Error('Checkpoints and Phase 3-4 content must remain unchanged.');
  }
  for (const item of after) {
    const parsed = parser.parse(item.source.trim());
    if (!parsed.length || parsed.some((block) => block.type === 'error')) {
      throw new Error(`Invalid lesson ${item.id}.`);
    }
  }

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
    if (catalog.rows[0]?.payload_json !== previousPayload) {
      throw new Error('Catalog changed since review.');
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
