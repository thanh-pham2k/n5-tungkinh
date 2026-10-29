import { NextRequest } from 'next/server';
import { z } from 'zod';
import { http, owner } from '../../../../../modules/study/http';
import { studyService } from '../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  return http(async () => {
    const username = owner(request);
    return {
      data: await studyService().get(
        username,
        z.uuid().parse((await context.params).contentId),
        username,
      ),
    };
  });
}
