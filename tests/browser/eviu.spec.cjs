const { test, expect, makeAuthToken } = require('./fixtures.cjs');

for (const width of [390, 1280]) {
  test(`EVIU opens lessons, quizzes, flipcards and remembers reviews at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/eviu/');
    await page.getByText('Phase 1 — EVIU', { exact: true }).click();
    await page.locator('.foundation-module summary').click();
    const rows = page.locator('.foundation-lesson');
    await expect(rows).toHaveCount(41);
    await expect(rows.first()).toContainText('Unit 1');
    await expect(rows.last()).toContainText('Unit 77');
    await rows.first().click();
    const dialog = page.getByRole('dialog', { name: 'Unit 1 — Learning Vocabulary' });
    await expect(dialog.locator('#lesson-output h1')).toContainText('Unit 1');
    await dialog.locator('.lesson-option').first().click();
    await expect(dialog.locator('.lesson-option.is-correct')).toBeVisible();
    const card = dialog.locator('.flipcard-face');
    await expect(card).toBeVisible();
    await card.click();
    await expect(card).toContainText('Giải thích');
    await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(rows.last()).toContainText('Unit 1');
    await page.reload();
    await page.getByText('Phase 1 — EVIU', { exact: true }).click();
    await page.locator('.foundation-module summary').click();
    await expect(rows.last()).toContainText('Unit 1');
    await expect(rows.last()).toContainText('Bài gần nhất');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('EVIU catalog rejects the other account', async ({ page, context }) => {
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
  await page.goto('/eviu/');
  await expect(page.getByText('Bạn không có quyền xem mục này.')).toBeVisible();
  const response = await page.request.get('/api/v1/study-catalog/eviu');
  expect(response.status()).toBe(403);
});

test('all 41 EVIU lessons render quiz and flipcards', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/eviu/');
  await page.getByText('Phase 1 — EVIU', { exact: true }).click();
  await page.locator('.foundation-module summary').click();
  const rows = page.locator('.foundation-lesson');
  await expect(rows).toHaveCount(41);
  for (let i = 0; i < 41; i++) {
    await rows.nth(i).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('#lesson-output h1').first()).toBeVisible();
    await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
    await expect(dialog.locator('.flipcard-face').first()).toBeVisible();
    await expect(dialog.locator('.lesson-error')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Đóng' }).click();
  }
});
