import { CatalogKey, SaveBasePrompts } from '../../../../../contracts/study-contract';
import { owner, http, readBody } from '../../../../../modules/study/http';
import { StudyError } from '../../../../../modules/study/errors';
import { NextRequest } from 'next/server';
import { studyService } from '../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function assertVisualSamplesAllowed(data: any, currentUser: string) {
  const allowed =
    data &&
    typeof data === 'object' &&
    data.enabled === true &&
    Array.isArray(data.allowedUsers) &&
    data.allowedUsers.includes(currentUser);
  if (!allowed) throw new StudyError(403, 'forbidden', 'Bạn không có quyền xem mục này.');
}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ catalogId: string }> },
) {
  return http(async () => {
    const id = CatalogKey.parse((await context.params).catalogId);
    if (['eviu', 'reading-practice'].includes(id) && owner(request) !== 'thanhpv')
      throw new StudyError(403, 'forbidden', 'Bạn không có quyền xem mục này.');
    if (['french', 'french-taxi'].includes(id) && owner(request) !== 'yentr')
      throw new StudyError(403, 'forbidden', 'Bạn không có quyền xem mục này.');
    const data = await studyService().catalog(id);
    if (id === 'visual-samples') assertVisualSamplesAllowed(data, owner(request));
    return { data };
  });
}
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ catalogId: string }> },
) {
  return http(async () => {
    const id = CatalogKey.parse((await context.params).catalogId);
    if (id !== 'visual-samples')
      throw new StudyError(403, 'forbidden', 'Không hỗ trợ cập nhật danh mục này.');
    const currentUser = owner(request);
    const input = SaveBasePrompts.parse(await readBody(request));
    const existing = await studyService().catalog(id);
    assertVisualSamplesAllowed(existing, currentUser);
    const ids = new Set<string>();
    for (const item of input.basePrompts) {
      if (ids.has(item.id))
        throw new StudyError(422, 'validation_error', `ID prompt bị trùng: ${item.id}.`);
      ids.add(item.id);
    }
    const next = { ...existing, basePrompts: input.basePrompts };
    return { data: await studyService().updateCatalog(id, next) };
  });
}
