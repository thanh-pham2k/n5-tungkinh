import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setAuthCookie, USERS } from '../../../../../modules/auth/auth';
import { assertWriteOrigin } from '../../../../../modules/study/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    assertWriteOrigin(request);
    const body = await request.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_request',
            message: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
          },
          meta: { requestId },
        },
        { status: 400, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
      );
    }
    const { username, password } = parsed.data;
    const account = USERS[username];
    if (!account || account.password !== password) {
      return NextResponse.json(
        {
          error: {
            code: 'unauthenticated',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
          },
          meta: { requestId },
        },
        { status: 401, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
      );
    }

    const response = NextResponse.json(
      {
        data: {
          user: {
            username: account.username,
            name: account.name,
          },
        },
        meta: { requestId },
      },
      { status: 200, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
    );
    setAuthCookie(response, account.username, request.nextUrl.protocol === 'https:');
    return response;
  } catch (error: any) {
    const isForbidden = error?.status === 403;
    return NextResponse.json(
      {
        error: {
          code: isForbidden ? 'forbidden' : 'service_unavailable',
          message: isForbidden
            ? 'Chỉ nhận thao tác từ website hiện tại.'
            : 'Đăng nhập tạm thời gián đoạn. Hãy thử lại.',
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
