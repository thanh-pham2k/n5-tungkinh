import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '../../../../../modules/auth/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = authenticate(request);
    return NextResponse.json(
      {
        data: { user },
        meta: { requestId },
      },
      { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: {
          code: 'unauthenticated',
          message: 'Bạn chưa đăng nhập.',
        },
        meta: { requestId },
      },
      { status: 401, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
    );
  }
}
