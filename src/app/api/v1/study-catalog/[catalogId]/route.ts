import { CatalogKey } from '../../../../../contracts/study-contract';
import { http } from '../../../../../modules/study/http';
import { studyService } from '../../../../../modules/study/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ catalogId: string }> }) {
  return http(async () => ({
    data: await studyService().catalog(CatalogKey.parse((await context.params).catalogId)),
  }));
}
