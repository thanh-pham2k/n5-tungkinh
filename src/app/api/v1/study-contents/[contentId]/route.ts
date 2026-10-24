import { NextRequest } from 'next/server';
import { z } from 'zod';
import { http, owner, SHARED_LIBRARY } from '../../../../../modules/study/http';
import { studyService } from '../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  return http(async () => ({
    data: await studyService().get(
      SHARED_LIBRARY,
      z.uuid().parse((await context.params).contentId),
      owner(request),
    ),
  }));
}
