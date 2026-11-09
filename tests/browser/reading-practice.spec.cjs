const { test, expect, makeAuthToken } = require('./fixtures.cjs');

for (const width of [390, 1280]) {
  test(`Reading Practice opens passages and review quizzes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/reading-practice/');
    await expect(page.getByRole('heading', { name: 'Reading Practice' })).toBeVisible();
    await expect(page.locator('.foundation-lesson')).toHaveCount(60);
    await page.locator('.foundation-phase').first().locator('summary').click();
    const rows = page.locator('.foundation-phase').first().locator('.foundation-lesson');
    await rows.first().click();
    const reading = page.locator('.course-reading');
    await expect(reading.locator('#lesson-output h1')).toContainText('Lesson 01');
    await expect(reading.locator('.lesson-deck')).toHaveCount(1);
    await reading.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
    await expect(
      reading.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
    ).toBeDisabled();
    await reading.getByRole('button', { name: 'Đóng bài học' }).click();
    await expect(rows.first().getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
    await rows.last().click();
    await expect(reading.locator('.lesson-deck')).toHaveCount(3);
    await expect(reading.locator('#lesson-output h2')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('Reading Practice and its catalog are restricted to thanhpv', async ({ page, context }) => {
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
  await page.goto('/reading-practice/');
  await expect(page.getByText('Bạn không có quyền xem mục này.')).toBeVisible();
  expect((await page.request.get('/api/v1/study-catalog/reading-practice')).status()).toBe(403);
  await page.goto('/');
  await page.getByRole('button', { name: 'Đổi công cụ học' }).click();
  await expect(page.getByRole('dialog').getByText('Reading Practice')).toHaveCount(0);
});
