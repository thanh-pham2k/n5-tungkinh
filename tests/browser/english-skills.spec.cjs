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

test('desktop menu can be hidden and restored for thanhpv', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();
  await page.getByRole('button', { name: 'Ẩn thanh bên' }).click();
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', { name: 'Hiện thanh bên' }).click();
  await expect(sidebar).toBeVisible();
});

test('course pages retain thanhpv tool navigation and open the selected tool', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/foundation/');
  const sidebar = page.locator('.sidebar');
  await expect(sidebar.getByRole('link', { name: /Vocab Review/ })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: /600 từ vựng TOEIC/ })).toHaveCount(0);
  await sidebar.getByRole('link', { name: /Vocab Review/ }).click();
  await expect(page.getByRole('heading', { name: 'Vocab Review' })).toBeVisible();
});
