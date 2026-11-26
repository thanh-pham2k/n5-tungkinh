import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { MarkdownThemePreference } from '../../../../contracts/study-contract';
import { StudyError } from '../../../../modules/study/errors';
import { SESSION_COOKIE, http, owner, readBody } from '../../../../modules/study/http';
import { studyService } from '../../../../modules/study/service';
import { defaultMarkdownTheme } from '../../../../services/markdown-themes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function preferenceKey(request: NextRequest) {
  const username = owner(request);
  const session = z.uuid().safeParse(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session.success)
    throw new StudyError(400, 'invalid_request', 'Phiên trình duyệt chưa sẵn sàng.');
  return `markdown-theme:${username}:${session.data}`;
}

export function GET(request: NextRequest) {
  return http(async () => {
    const preference = await studyService().readMarkdownTheme(preferenceKey(request));
    const parsed = MarkdownThemePreference.safeParse(preference);
    return { data: parsed.success ? parsed.data : { theme: defaultMarkdownTheme } };
  });
}

export function PUT(request: NextRequest) {
  return http(async () => {
    const key = preferenceKey(request);
    const preference = MarkdownThemePreference.parse(await readBody(request, 1024));
    await studyService().saveMarkdownTheme(key, preference);
    return { data: preference };
  });
}
