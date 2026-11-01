const { test, expect } = require('./fixtures.cjs');

for (const width of [390, 1280]) {
  test(`English Skills shows empty sections at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/english-skills/');
    for (const name of ['Reading', 'Listening', 'Speaking', 'Writing']) {
      await page.getByRole('button', { name }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      await expect(
        page.getByText(name === 'Reading' ? 'Chưa có chủ đề đọc.' : 'Chưa có bài học.'),
      ).toBeVisible();
      await page.getByRole('button', { name: '← English Skills' }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
