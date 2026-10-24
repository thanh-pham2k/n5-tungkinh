import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertWriteOrigin, http, owner, SHARED_LIBRARY } from '../../../../../modules/study/http';
import { studyService } from '../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ logId: string }> }) {
  return http(async () => ({
    data: await studyService().replayLog(
      SHARED_LIBRARY,
      z.uuid().parse((await context.params).logId),
      owner(request),
    ),
  }));
}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ logId: string }> },
) {
  return http(async () => {
    owner(request);
    assertWriteOrigin(request);
    return {
      data: await studyService().removeLog(
        SHARED_LIBRARY,
        z.uuid().parse((await context.params).logId),
      ),
    };
  });
}
