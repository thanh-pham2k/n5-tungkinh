const { test, expect, makeAuthToken } = require('./fixtures.cjs');

test('French Taxi course is limited to yentr and completion persists', async ({
  page,
  context,
}) => {
  await page.goto('/french-taxi/');
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

  await page.goto('/french-taxi/');
  await expect(page.getByRole('heading', { name: 'Le Nouveau Taxi 1 · 24 bài' })).toBeVisible();
  await expect(page.getByText('Unité 1 : Un air de famille')).toBeVisible();
  await expect(page.getByText('Unité 6 : Temps libre')).toBeVisible();

  // Open Leçon 1
  await page.getByRole('button', { name: /Leçon 1\s+Leçon 1 : Je me présente/ }).click();
  await expect(
    page.getByRole('button', { name: '← Danh sách bài học', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();

  // Return to lesson list
  await page.getByRole('button', { name: '← Danh sách bài học', exact: true }).click();
  await expect(page.getByText('Unité 1 : Un air de famille')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
});

test('Navigation between TOEIC, French, and French Taxi works for yentr', async ({
  page,
  context,
}) => {
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

  const menu = page.getByRole('button', { name: 'Đổi công cụ học' });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog')
      .getByRole('link', { name: /Le Nouveau Taxi 1/ })
      .click();
  } else {
    await page
      .locator('.sidebar')
      .getByRole('link', { name: /Le Nouveau Taxi 1/ })
      .click();
  }

  await expect(page).toHaveURL(/\/french-taxi\/?/);
  await expect(page.getByRole('heading', { name: 'Le Nouveau Taxi 1 · 24 bài' })).toBeVisible();
});
