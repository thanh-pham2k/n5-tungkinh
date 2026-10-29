import { Lesson, Page, StudyLogSummary } from '../contracts/study-contract';
import { z } from 'zod';
const base = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/v1`;
let session;
export function resetSession() {
  session = undefined;
}
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
export const createLesson = async (input) =>
  Lesson.parse(
    (await studyRequest('/study-contents', { method: 'POST', body: JSON.stringify(input) })).data,
  );
export const readCatalog = async (key) => (await studyRequest(`/study-catalog/${key}`)).data;
export const listStudyLogs = async (tool, cursor) => {
  const payload = await studyRequest(
    `/study-logs?${new URLSearchParams({ tool, ...(cursor ? { cursor } : {}) })}`,
  );
  return {
    data: z.array(StudyLogSummary).parse(payload.data),
    page: Page.parse(payload.meta.page),
  };
};
export const readStudyLog = async (id) =>
  Lesson.parse((await studyRequest(`/study-logs/${id}`)).data);
export const removeStudyLog = async (id) => studyRequest(`/study-logs/${id}`, { method: 'DELETE' });

export async function loginUser(username, password) {
  await ensureSession();
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Đăng nhập không thành công.');
  }
  return payload.data.user;
}

export async function logoutUser() {
  await ensureSession();
  const response = await fetch(`${base}/auth/logout`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  resetSession();
  if (!response.ok) {
    throw new Error('Đăng xuất không thành công.');
  }
}

export async function getCurrentUser() {
  try {
    await ensureSession();
    const response = await fetch(`${base}/auth/me`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.data?.user || null;
  } catch {
    return null;
  }
}
