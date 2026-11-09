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

  const menu = page.getByRole('button', { name: 'Đổi công cụ học' });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog')
      .getByRole('link', { name: /Tiếng Pháp/ })
      .click();
  } else {
    await page
      .locator('.sidebar')
      .getByRole('link', { name: /Tiếng Pháp/ })
      .click();
  }

  await expect(page).toHaveURL(/\/french\/?/);
  await expect(page.getByRole('heading', { name: 'Tiếng Pháp A1–A2' })).toBeVisible();

  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog')
      .getByRole('link', { name: /600 từ vựng TOEIC/ })
      .click();
  } else {
    await page
      .locator('.sidebar')
      .getByRole('link', { name: /600 từ vựng TOEIC/ })
      .click();
  }

  await expect(page).toHaveURL(/\/toeic-600\/?/);
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
});

test('yentr desktop view has sidebar with exactly two course tabs', async ({ page, context }) => {
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

  await page.goto('/french/');
  await expect(page.locator('.app-shell')).toBeVisible();
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();

  // Exactly 2 course tabs in the sidebar
  const tabs = sidebar.locator('.nav-item');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toContainText('600 từ vựng TOEIC');
  await expect(tabs.nth(1)).toContainText('Tiếng Pháp A1–A2');
  await expect(tabs.nth(1)).toHaveClass(/is-current/);

  // Does not expose other private courses
  await expect(sidebar.getByText('Instant Vocab')).toHaveCount(0);
  await expect(sidebar.getByText('EVIU')).toHaveCount(0);
  await expect(sidebar.getByText('English Foundation')).toHaveCount(0);
  await expect(sidebar.getByText('Markdown & Quiz')).toHaveCount(0);
});
