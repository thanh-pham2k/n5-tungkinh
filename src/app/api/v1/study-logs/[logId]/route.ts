import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assertWriteOrigin, http, owner } from '../../../../../modules/study/http';
import { studyService } from '../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ logId: string }> }) {
  return http(async () => {
    const username = owner(request);
    return {
      data: await studyService().replayLog(
        username,
        z.uuid().parse((await context.params).logId),
        username,
      ),
    };
  });
}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ logId: string }> },
) {
  return http(async () => {
    assertWriteOrigin(request);
    const username = owner(request);
    return {
      data: await studyService().removeLog(username, z.uuid().parse((await context.params).logId)),
    };
  });
}
