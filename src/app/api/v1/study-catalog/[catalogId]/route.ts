import { CatalogKey } from '../../../../../contracts/study-contract';
import { owner, http } from '../../../../../modules/study/http';
import { StudyError } from '../../../../../modules/study/errors';
import { NextRequest } from 'next/server';
import { studyService } from '../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ catalogId: string }> },
) {
  return http(async () => {
    const id = CatalogKey.parse((await context.params).catalogId);
    if (id === 'eviu' && owner(request) !== 'thanhpv')
      throw new StudyError(403, 'forbidden', 'Bạn không có quyền xem mục này.');
    return { data: await studyService().catalog(id) };
  });
}
