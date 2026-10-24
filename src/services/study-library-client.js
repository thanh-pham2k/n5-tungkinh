import { Lesson, LessonSummary, Page } from '../contracts/study-contract';
import { z } from 'zod';
const base = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/v1`;
let session;
async function ensureSession() {
  if (!session)
    session = fetch(`${base}/session`, { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Không mở được phiên học.');
      })
      .catch((error) => {
        session = undefined;
        throw error;
      });
  return session;
}
export async function studyRequest(path, options = {}) {
  let response;
  try {
    await ensureSession();
    response = await fetch(`${base}${path}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error('Không kết nối được Turso. Nội dung chưa được lưu; hãy thử lại.');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.error?.message || 'Không tải hoặc lưu được nội dung. Hãy thử lại.');
  if (!payload || !('data' in payload) || !payload.meta?.requestId)
    throw new Error('Phản hồi thư viện không hợp lệ.');
  return payload;
}
export const listLessons = async (tool, cursor) => {
  const payload = await studyRequest(
    `/study-contents?${new URLSearchParams({ tool, ...(cursor ? { cursor } : {}) })}`,
  );
  return { data: z.array(LessonSummary).parse(payload.data), page: Page.parse(payload.meta.page) };
};
export const readLesson = async (id) =>
  Lesson.parse((await studyRequest(`/study-contents/${id}`)).data);
export const removeLesson = async (id) =>
  studyRequest(`/study-contents/${id}`, { method: 'DELETE' });
export const createLesson = async (input) =>
  Lesson.parse(
    (await studyRequest('/study-contents', { method: 'POST', body: JSON.stringify(input) })).data,
  );
export const readCatalog = async (key) => (await studyRequest(`/study-catalog/${key}`)).data;
