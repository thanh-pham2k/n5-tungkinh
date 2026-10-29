import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '../../../../../modules/auth/auth';
import { assertWriteOrigin } from '../../../../../modules/study/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    assertWriteOrigin(request);
    const response = NextResponse.json(
      {
        data: { success: true },
        meta: { requestId },
      },
      { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
    );
    clearAuthCookie(response);
    return response;
  } catch (error: any) {
    const isForbidden = error?.status === 403;
    return NextResponse.json(
      {
        error: {
          code: isForbidden ? 'forbidden' : 'service_unavailable',
          message: isForbidden
            ? 'Chỉ nhận thao tác từ website hiện tại.'
            : 'Đăng xuất tạm thời gián đoạn.',
        },
        meta: { requestId },
      },
      {
        status: isForbidden ? 403 : 500,
        headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
      },
    );
  }
}
