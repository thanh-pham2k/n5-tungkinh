import { NextRequest } from 'next/server';
import { ListQuery } from '../../../../contracts/study-contract';
import { http, owner } from '../../../../modules/study/http';
import { studyService } from '../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  return http(async () => {
    const username = owner(request);
    const query = ListQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    return studyService().listLogs(username, query.tool, query.limit, query.cursor);
  });
}
