import { NextRequest } from 'next/server';
import { ListQuery } from '../../../../contracts/study-contract';
import { http, SHARED_LIBRARY } from '../../../../modules/study/http';
import { studyService } from '../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return http(async () => {
    const query = ListQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    return studyService().listLogs(SHARED_LIBRARY, query.tool, query.limit, query.cursor);
  });
}
