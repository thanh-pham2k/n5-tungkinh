const { test, expect, makeAuthToken } = require('./fixtures.cjs');

test('French course is limited to yentr and completion persists', async ({ page, context }) => {
  await page.goto('/french/');
  await expect(page.getByText('Bạn không có quyền xem mục này.')).toBeVisible();

  await context.clearCookies();
  await context.addCookies([
    {
      name: 'kotoba-auth-token',
      value: makeAuthToken('yentr'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);

  await page.goto('/french/');
  await expect(page.getByRole('heading', { name: 'Tiếng Pháp A1–A2' })).toBeVisible();
  await expect(page.getByText('Phần 1: Đặt câu hỏi, Động từ & Mạo từ')).toBeVisible();

  // Open Lesson 1
  await page.getByRole('button', { name: /Chủ đề 1 — Cách đặt câu hỏi/ }).click();
  await expect(
    page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
});

test('Navigation between TOEIC and French works for yentr', async ({ page, context }) => {
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'kotoba-auth-token',
      value: makeAuthToken('yentr'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);

  await page.goto('/toeic-600/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  const frenchLink = page.getByRole('link', { name: /Tiếng Pháp/ });
  await expect(frenchLink).toBeVisible();
  await frenchLink.click();

  await expect(page).toHaveURL(/\/french\/?/);
  await expect(page.getByRole('heading', { name: 'Tiếng Pháp A1–A2' })).toBeVisible();

  const toeicLink = page.getByRole('link', { name: /600 từ vựng TOEIC/ });
  await expect(toeicLink).toBeVisible();
  await toeicLink.click();

  await expect(page).toHaveURL(/\/toeic-600\/?/);
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
});
