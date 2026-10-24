const { test, expect } = require('./fixtures.cjs');
const lesson =
  '# Bài học\n\nMột **ví dụ** tiếng Việt.\n\n```mermaid\nflowchart LR\n  A[Học] --> B[Nhớ]\n```\n\n```quiz\nq1 | single_choice | 1 + 1? | 1 | 2 | 2 | Hai là đúng.\nq2 | single_choice | 2 + 2? | 4 | 5 | 1 | Bốn là đúng.\n```';
async function openMobileEditor(page, text) {
  await page.getByRole('button', { name: 'Nhập Markdown', exact: true }).click();
  await page.locator('#lesson-mobile-source').fill(text);
  await page.getByRole('button', { name: 'Xem preview', exact: true }).click();
}
test('mobile Markdown renders Mermaid and quiz, persists source and supports dark theme', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(page, lesson);
  await expect(page.locator('#lesson-output h1')).toHaveText('Bài học');
  await expect(page.locator('#lesson-output svg')).toBeVisible();
  await page.locator('.lesson-option').nth(1).click();
  await expect(page.locator('.lesson-option.is-correct')).toBeVisible();
  await page.locator('.lesson-deck').getByRole('button', { name: 'Tiếp →', exact: true }).click();
  await page.locator('.lesson-option').first().click();
  await page
    .locator('.lesson-deck')
    .getByRole('button', { name: 'Xem kết quả', exact: true })
    .click();
  await expect(page.locator('.lesson-deck')).toContainText('Đúng 2/2');
  await page.getByRole('button', { name: 'Công cụ Markdown', exact: true }).click();
  await page.getByLabel('Dark mode').check();
  await expect(page.locator('body')).toHaveClass('dark');
  await page.reload();
  await expect(page.locator('#lesson-output h1')).toHaveText('Bài học');
  await expect(page.locator('.lesson-option input:checked')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('mobile editor Cancel preserves prior content and code remains locally scrollable', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(page, '# Giữ bài này\n\n```text\n' + 'x'.repeat(250) + '\n```');
  await page.getByRole('button', { name: 'Nhập Markdown', exact: true }).click();
  await page.locator('#lesson-mobile-source').fill('# Không áp dụng');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.locator('#lesson-output h1')).toHaveText('Giữ bài này');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('desktop live editor, divider keyboard, file open and print layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await page.locator('#lesson-source').fill('# Live preview\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  await expect(page.locator('#lesson-output h1')).toHaveText('Live preview');
  await page.locator('#preview-divider').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#preview-divider')).toHaveAttribute('aria-valuenow', '52');
  await page.locator('#lesson-file').setInputFiles({
    name: 'example.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Mở file thành công'),
  });
  await expect(page.locator('#lesson-output h1')).toHaveText('Mở file thành công');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.preview-toolbar')).toBeHidden();
  await expect(page.locator('#lesson-output h1')).toBeVisible();
});
