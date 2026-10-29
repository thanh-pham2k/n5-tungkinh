import { NextRequest } from 'next/server';
import { z } from 'zod';
import { SaveProgress } from '../../../../../../contracts/study-contract';
import { http, owner, readBody } from '../../../../../../modules/study/http';
import { studyService } from '../../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  return http(async () => {
    const username = owner(request);
    const id = z.uuid().parse((await context.params).contentId);
    const input = SaveProgress.parse(await readBody(request, 256000));
    return {
      data: await studyService().progress(username, username, id, input.version, input.progress),
    };
  });
}
