const { test, expect } = require('./fixtures.cjs');
const AxeBuilder = require('@axe-core/playwright').default;
test('mobile shell, picker and settings satisfy automated WCAG AA checks', async ({ page }) => {
  await page.goto('/');
  const markdownLink = page.locator('.sidebar nav a.nav-item');
  await expect(markdownLink).toHaveAttribute('href', '/markdown/');
  await expect(markdownLink).toHaveAttribute('target', '_blank');
  await expect(markdownLink).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('button', { name: 'Đổi công cụ học' }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Audio Looper', exact: false }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: '▤ Chọn bài IELTS', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cài đặt audio', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
test('Markdown empty workspace has accessible controls and landmarks', async ({ page }) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
