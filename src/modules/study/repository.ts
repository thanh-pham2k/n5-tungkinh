import { randomUUID, createHash } from 'node:crypto';
import type { Client, Row } from '@libsql/client';
import type { CreateLessonInput } from '../../contracts/study-contract';
import { StudyError } from './errors';
const SUMMARY_COLUMNS =
  'id, tool, title, language, item_count, created_at, last_studied_at, study_count';
function summary(row: Row) {
  return {
    id: String(row.id),
    tool: String(row.tool),
    title: String(row.title),
    language: String(row.language),
    itemCount: Number(row.item_count),
    createdAt: String(row.created_at),
    lastStudiedAt: String(row.last_studied_at),
    studyCount: Number(row.study_count),
  };
}
function logSummary(row: Row) {
  return {
    id: String(row.log_id),
    contentId: String(row.content_id),
    tool: String(row.tool),
    title: String(row.title),
    language: String(row.language),
    itemCount: Number(row.item_count),
    createdAt: String(row.log_created_at),
  };
}
export function studyRepository(db: Client) {
  return {
    async listLogs(libraryId: string, tool: string, limit: number, cursor?: string) {
      let last: string | null = null,
        id: string | null = null;
      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
          if (
            decoded.libraryId !== libraryId ||
            decoded.tool !== tool ||
            typeof decoded.last !== 'string' ||
            typeof decoded.id !== 'string'
          )
            throw new Error();
          last = decoded.last;
          id = decoded.id;
        } catch {
          throw new StudyError(400, 'invalid_cursor', 'Phân trang không hợp lệ.');
        }
      }
      const result = await db.execute({
        sql: `SELECT r.id AS log_id, r.created_at AS log_created_at, c.id AS content_id, c.tool, c.title, c.language, c.item_count FROM study_records r JOIN study_contents c ON c.id = r.content_id AND c.library_id = r.library_id WHERE r.library_id = ? AND c.tool = ? AND (? IS NULL OR r.created_at < ? OR (r.created_at = ? AND r.id < ?)) ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
        args: [libraryId, tool, last, last, last, id, limit + 1],
      });
      const data = result.rows.slice(0, limit).map(logSummary);
      const hasMore = result.rows.length > limit;
      const tail = data.at(-1);
      return {
        data,
        page: {
          limit,
          hasMore,
          nextCursor:
            hasMore && tail
              ? Buffer.from(
                  JSON.stringify({ libraryId, tool, last: tail.createdAt, id: tail.id }),
                ).toString('base64url')
              : null,
        },
      };
    },
    async getLog(libraryId: string, logId: string, ownerId: string) {
      const result = await db.execute({
        sql: `SELECT c.*, p.state_json, p.version FROM study_records r JOIN study_contents c ON c.id = r.content_id AND c.library_id = r.library_id LEFT JOIN study_progress p ON p.content_id = c.id AND p.library_id = ? WHERE r.id = ? AND r.library_id = ?`,
        args: [ownerId, logId, libraryId],
      });
      const row = result.rows[0];
      if (!row) throw new StudyError(404, 'not_found', 'Không tìm thấy mục log.');
      return {
        ...summary(row),
        source: String(row.source),
        parsed: JSON.parse(String(row.parsed_json)),
        progress: JSON.parse(String(row.state_json || '{}')),
        version: Number(row.version || 0),
      };
    },
    async removeLog(libraryId: string, logId: string) {
      const result = await db.execute({
        sql: 'DELETE FROM study_records WHERE id = ? AND library_id = ?',
        args: [logId, libraryId],
      });
      if (result.rowsAffected === 0)
        throw new StudyError(404, 'not_found', 'Không tìm thấy mục log.');
      return { id: logId, deleted: true };
    },
    async list(libraryId: string, tool: string, limit: number, cursor?: string) {
      let last: string | null = null,
        id: string | null = null;
      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
          if (
            decoded.libraryId !== libraryId ||
            decoded.tool !== tool ||
            typeof decoded.last !== 'string' ||
            typeof decoded.id !== 'string'
          )
            throw new Error();
          last = decoded.last;
          id = decoded.id;
        } catch {
          throw new StudyError(400, 'invalid_cursor', 'Phân trang không hợp lệ.');
        }
      }
      const result = await db.execute({
        sql: `SELECT ${SUMMARY_COLUMNS} FROM study_contents WHERE library_id = ? AND tool = ? AND (? IS NULL OR last_studied_at < ? OR (last_studied_at = ? AND id < ?)) ORDER BY last_studied_at DESC, id DESC LIMIT ?`,
        args: [libraryId, tool, last, last, last, id, limit + 1],
      });
      const data = result.rows.slice(0, limit).map(summary);
      const hasMore = result.rows.length > limit;
      const tail = data.at(-1);
      return {
        data,
        page: {
          limit,
          hasMore,
          nextCursor:
            hasMore && tail
              ? Buffer.from(
                  JSON.stringify({ libraryId, tool, last: tail.lastStudiedAt, id: tail.id }),
                ).toString('base64url')
              : null,
        },
      };
    },
    async get(libraryId: string, id: string, ownerId: string) {
      const result = await db.execute({
        sql: 'SELECT c.*, p.state_json, p.version FROM study_contents c LEFT JOIN study_progress p ON p.content_id = c.id AND p.library_id = ? WHERE c.id = ? AND c.library_id = ?',
        args: [ownerId, id, libraryId],
      });
      const row = result.rows[0];
      if (!row) throw new StudyError(404, 'not_found', 'Không tìm thấy bài đã lưu.');
      return {
        ...summary(row),
        source: String(row.source),
        parsed: JSON.parse(String(row.parsed_json)),
        progress: JSON.parse(String(row.state_json || '{}')),
        version: Number(row.version || 0),
      };
    },
    async create(
      libraryId: string,
      input: CreateLessonInput,
      parsed: unknown,
      itemCount: number,
      title: string,
    ) {
      const hash = createHash('sha256').update(input.source).digest('hex');
      const tx = await db.transaction('write');
      try {
        const old = await tx.execute({
          sql: 'SELECT c.id, c.source_hash, c.tool, c.language FROM study_records r JOIN study_contents c ON c.id = r.content_id WHERE r.library_id = ? AND r.request_id = ?',
          args: [libraryId, input.requestId],
        });
        if (old.rows[0]) {
          const row = old.rows[0];
          if (
            row.source_hash !== hash ||
            row.tool !== input.tool ||
            row.language !== input.language
          )
            throw new StudyError(409, 'conflict', 'Mã lần nhập đã dùng cho nội dung khác.');
          await tx.commit();
          return String(row.id);
        }
        const found = await tx.execute({
          sql: 'SELECT id FROM study_contents WHERE library_id = ? AND tool = ? AND language = ? AND source_hash = ?',
          args: [libraryId, input.tool, input.language, hash],
        });
        const id = found.rows[0] ? String(found.rows[0].id) : randomUUID();
        const now = new Date().toISOString();
        await tx.execute({
          sql: `INSERT INTO study_contents (id, library_id, tool, title, language, source, source_hash, parsed_json, item_count, created_at, last_studied_at, study_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT (library_id, tool, language, source_hash) DO UPDATE SET last_studied_at = excluded.last_studied_at, study_count = study_count + 1`,
          args: [
            id,
            libraryId,
            input.tool,
            title,
            input.language,
            input.source,
            hash,
            JSON.stringify(parsed),
            itemCount,
            now,
            now,
          ],
        });
        await tx.execute({
          sql: 'INSERT INTO study_records (id, library_id, content_id, request_id, created_at) VALUES (?, ?, ?, ?, ?)',
          args: [randomUUID(), libraryId, id, input.requestId, now],
        });
        await tx.commit();
        return id;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    },
    async progress(
      libraryId: string,
      ownerId: string,
      id: string,
      version: number,
      progress: Record<string, unknown>,
    ) {
      const exists = await db.execute({
        sql: 'SELECT id FROM study_contents WHERE id = ? AND library_id = ?',
        args: [id, libraryId],
      });
      if (!exists.rows[0]) throw new StudyError(404, 'not_found', 'Không tìm thấy bài đã lưu.');
      const result =
        version === 0
          ? await db.execute({
              sql: 'INSERT INTO study_progress (content_id, library_id, state_json, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (content_id, library_id) DO UPDATE SET state_json = excluded.state_json, version = version + 1, updated_at = excluded.updated_at WHERE study_progress.version = 0 RETURNING version',
              args: [id, ownerId, JSON.stringify(progress), new Date().toISOString()],
            })
          : await db.execute({
              sql: 'UPDATE study_progress SET state_json = ?, version = version + 1, updated_at = ? WHERE content_id = ? AND library_id = ? AND version = ? RETURNING version',
              args: [JSON.stringify(progress), new Date().toISOString(), id, ownerId, version],
            });
      if (!result.rows[0])
        throw new StudyError(
          409,
          'conflict',
          'Bài học đã thay đổi ở phiên khác. Hãy mở lại bài trước khi lưu tiếp.',
        );
      return { version: Number(result.rows[0].version), progress };
    },
    async catalog(id: string) {
      const result = await db.execute({
        sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
        args: [id],
      });
      if (!result.rows[0])
        throw new StudyError(503, 'service_unavailable', 'Thư viện chưa được nhập vào Turso.');
      return JSON.parse(String(result.rows[0].payload_json));
    },
  };
}
