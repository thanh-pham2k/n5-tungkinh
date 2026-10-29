import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { StudyError } from '../study/errors';

export interface UserAccount {
  username: string;
  name: string;
}

export const USERS: Record<string, { username: string; password: string; name: string }> = {
  thanhpv: {
    username: 'thanhpv',
    password: '1',
    name: 'thanhpv',
  },
  yentr: {
    username: 'yentr',
    password: '1',
    name: 'yentr',
  },
};

export const AUTH_COOKIE = 'kotoba-auth-token';
const AUTH_SECRET = process.env.APP_AUTH_SECRET || 'kotoba-lab-auth-signing-key-2026-fixed';

export function signUser(username: string): string {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${username}:${expiresAt}`;
  const hmac = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}:${hmac}`;
}

export function verifyUserToken(token: string | undefined): UserAccount | null {
  if (!token) return null;
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [username, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!username || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  const expectedPayload = `${username}:${expiresAtStr}`;
  const expectedHmac = createHmac('sha256', AUTH_SECRET).update(expectedPayload).digest('hex');
  if (signature.length !== expectedHmac.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) return null;
  const account = USERS[username];
  if (!account) return null;
  return { username: account.username, name: account.name };
}

export function authenticate(request: NextRequest): UserAccount {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const user = verifyUserToken(token);
  if (!user) {
    throw new StudyError(401, 'unauthenticated', 'Bạn cần đăng nhập để tiếp tục.');
  }
  return user;
}

export function setAuthCookie(response: NextResponse, username: string, isHttps: boolean): void {
  response.cookies.set(AUTH_COOKIE, signUser(username), {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
