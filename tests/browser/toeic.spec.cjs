const { test, expect, makeAuthToken } = require('./fixtures.cjs');

test('TOEIC is limited to yentr and completion persists', async ({ page, context }) => {
  await page.goto('/toeic-600/');
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
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/v1/study-contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'markdown',
        language: 'en',
        source: '# Contracts — Hợp đồng\n\nLesson.',
        requestId: crypto.randomUUID(),
      }),
    });
    return result.status;
  });
  expect(response).toBe(201);
  await page.goto('/toeic-600/');
  await page.getByRole('button', { name: /Nhóm 1/ }).click();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
});

test('yentr home shows only TOEIC on desktop', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  await expect(page.getByText('Instant Vocab')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
});
