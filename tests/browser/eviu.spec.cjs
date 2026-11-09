const { test, expect, makeAuthToken } = require('./fixtures.cjs');

for (const width of [390, 1280]) {
  test(`EVIU opens lessons, quizzes, flipcards and remembers reviews at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/eviu/');
    await page.getByText('Phase 1 — Học từ vựng & đời sống', { exact: true }).click();
    const module = page.locator('.foundation-module').first();
    await module.locator('summary').click();
    const rows = module.locator('.foundation-lesson');
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText('Unit 1');
    await expect(rows.last()).toContainText('Unit 17');
    await rows.first().click();
    const dialog = page.locator('.course-reading');
    await expect(dialog.locator('#lesson-output h1')).toContainText('Unit 1');
    await dialog.locator('.lesson-option').first().click();
    await expect(dialog.locator('.lesson-option.is-correct')).toBeVisible();
    const card = dialog.locator('.flipcard-face');
    await expect(card).toBeVisible();
    await card.click();
    await expect(card).toContainText('Giải thích');
    const complete = dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true });
    await complete.click();
    await expect(complete).toBeDisabled();
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
    await rows.last().click();
    await expect(complete).toBeEnabled();
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
    await expect(rows.last()).toContainText('Unit 1');
    await page.reload();
    await page.getByText('Phase 1 — Học từ vựng & đời sống', { exact: true }).click();
    await module.locator('summary').click();
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
  await expect(page.locator('.foundation-lesson')).toHaveCount(41);
  for (const phase of await page.locator('.foundation-phase > summary').all()) await phase.click();
  for (const module of await page.locator('.foundation-module > summary').all())
    await module.click();
  await expect(page.locator('.foundation-phase')).toHaveCount(3);
  const modules = page.locator('.foundation-module');
  await expect(modules).toHaveCount(9);
  for (let i = 0; i < 9; i++)
    await expect(modules.nth(i).locator('.foundation-lesson')).toHaveCount(i === 8 ? 1 : 5);
  const rows = page.locator('.foundation-lesson');
  await expect(rows).toHaveCount(41);
  const expected = [
    1, 2, 3, 16, 17, 18, 19, 20, 24, 25, 21, 23, 28, 29, 26, 65, 66, 35, 36, 37, 74, 38, 39, 40, 75,
    76, 53, 55, 95, 98, 81, 82, 83, 84, 79, 80, 86, 89, 90, 91, 77,
  ];
  await expect(rows.locator('strong')).toHaveText(expected.map((unit) => `Unit ${unit}`));
  for (let i = 0; i < 41; i++) {
    await rows.nth(i).click();
    const dialog = page.locator('.course-reading');
    await expect(dialog.locator('#lesson-output h1').first()).toBeVisible();
    await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
    await expect(dialog.locator('.flipcard-face').first()).toBeVisible();
    await expect(dialog.locator('.lesson-error')).toHaveCount(0);
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
  }
});

test('expanded flipcard closes without closing the EVIU lesson', async ({ page }) => {
  await page.goto('/eviu/');
  await page.getByText('Phase 1 — Học từ vựng & đời sống', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.locator('.foundation-lesson').first().click();
  const lesson = page.locator('.course-reading');
  const expand = lesson.getByRole('button', { name: 'Mở rộng flipcard' });
  await expand.click();
  const fullscreen = page.getByRole('dialog', { name: 'Luyện tập flipcard' });
  await expect(fullscreen).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fullscreen).toHaveCount(0);
  await expect(lesson).toBeVisible();
  await expect(expand).toBeFocused();
});
