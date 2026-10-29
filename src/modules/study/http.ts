import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MAX_SOURCE_BYTES } from '../../contracts/study-contract';
import { StudyError } from './errors';
import { authenticate } from '../auth/auth';
export const SHARED_LIBRARY = 'shared';
export const SESSION_COOKIE = 'kotoba-study-session';
export function owner(request: NextRequest) {
  return authenticate(request).username;
}
export function assertWriteOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const protocol =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  let sameOrigin = false;
  try {
    const actual = new URL(origin || '');
    sameOrigin = actual.host === host && actual.protocol === `${protocol}:`;
  } catch {}
  if (!sameOrigin) throw new StudyError(403, 'forbidden', 'Chỉ nhận thao tác từ website hiện tại.');
}
export async function readBody(request: NextRequest, maxBytes = MAX_SOURCE_BYTES + 10000) {
  assertWriteOrigin(request);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new StudyError(415, 'unsupported_media_type', 'Yêu cầu application/json.');
  if (Number(request.headers.get('content-length')) > maxBytes)
    throw new StudyError(413, 'payload_too_large', 'Nội dung quá lớn để lưu.');
  const reader = request.body?.getReader();
  if (!reader) throw new StudyError(400, 'invalid_request', 'Thiếu dữ liệu gửi lên.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new StudyError(413, 'payload_too_large', 'Nội dung quá lớn để lưu.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new StudyError(400, 'invalid_request', 'JSON không hợp lệ.');
  }
}
export function http(action: () => Promise<{ data: unknown; status?: number; page?: unknown }>) {
  const requestId = randomUUID();
  return action()
    .then(({ data, status = 200, page }) =>
      NextResponse.json(
        { data, meta: { requestId, ...(page ? { page } : {}) } },
        { status, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
      ),
    )
    .catch((error) => {
      const known = error instanceof StudyError;
      const validation = error instanceof z.ZodError;
      return NextResponse.json(
        {
          error: {
            code: known ? error.code : validation ? 'validation_error' : 'service_unavailable',
            message: known
              ? error.message
              : validation
                ? 'Dữ liệu gửi lên không đúng định dạng.'
                : 'Turso hiện chưa sẵn sàng. Nội dung chưa được lưu; hãy thử lại.',
          },
          meta: { requestId },
        },
        {
          status: known ? error.status : validation ? 422 : 503,
          headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
        },
      );
    });
}
