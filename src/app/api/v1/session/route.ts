import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../modules/study/http';
import { AUTH_COOKIE, verifyUserToken } from '../../../../modules/auth/auth';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const user = verifyUserToken(token);
  const response = NextResponse.json(
    {
      data: {
        ready: true,
        authenticated: !!user,
        user: user ? { username: user.username, name: user.name } : null,
      },
      meta: { requestId },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } },
  );
  if (!z.uuid().safeParse(request.cookies.get(SESSION_COOKIE)?.value).success)
    response.cookies.set(SESSION_COOKIE, randomUUID(), {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  return response;
}
