import { NextRequest } from 'next/server';
import { CreateLesson, ListQuery, MAX_SOURCE_BYTES } from '../../../../contracts/study-contract';
import { http, owner, readBody, SHARED_LIBRARY } from '../../../../modules/study/http';
import { studyService } from '../../../../modules/study/service';
import { StudyError } from '../../../../modules/study/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return http(async () => {
    const query = ListQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    return studyService().list(SHARED_LIBRARY, query.tool, query.limit, query.cursor);
  });
}
export async function POST(request: NextRequest) {
  return http(async () => {
    const ownerId = owner(request);
    const input = CreateLesson.parse(await readBody(request));
    if (Buffer.byteLength(input.source) > MAX_SOURCE_BYTES)
      throw new StudyError(413, 'payload_too_large', 'Nội dung tối đa 1 MB.');
    return { data: await studyService().create(SHARED_LIBRARY, input, ownerId), status: 201 };
  });
}
