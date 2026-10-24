const { test, expect } = require('./fixtures.cjs');
const AxeBuilder = require('@axe-core/playwright').default;
async function openTool(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đổi công cụ học' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Multiple Choice', exact: false })
    .click();
  await page.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
}
const header = 'question|option_1|option_2|option_3|option_4|correct_answer';
test('invalid imports preserve current progress; quoted text stays inert and controls remain accessible', async ({
  page,
}) => {
  await openTool(page);
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Nhập Multiple Choice');
  await expect(page.getByRole('dialog').locator('code')).toHaveText(
    `${header}|explanation|context|example|example_meaning`,
  );
  await expect(page.getByRole('dialog')).not.toContainText('group_id');
  await expect(page.getByRole('dialog')).not.toContainText('Hot Review');
  const input = page.getByRole('textbox', { name: 'Nội dung Multiple Choice' });
  await input.fill(
    `${header}|explanation|context|example|example_meaning\n"Q | line 1\nline 2"|"<img src=x onerror=alert(1)>"|B|C|D|1|Explain|Context|Example|Nghĩa`,
  );
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  await expect(page.locator('.mc-question-text')).toHaveText('Q | line 1\nline 2');
  await expect(page.locator('.mc-option img')).toHaveCount(0);
  await page.locator('.mc-option input').first().focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Kiểm tra câu 1', exact: true }).click();
  await expect(page.locator('.mc-progress')).toContainText('Đúng 1');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: '× Thoát Focus', exact: true }).click();
  await page.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
  await input.fill(`${header}\nBad|A|B|C|D|7`);
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Dòng 2: correct_answer');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.locator('.mc-progress')).toContainText('Đúng 1');
  await expect(page.locator('.mc-question-text')).toContainText('Q | line 1');
  await page.getByText('Tùy chọn ôn tập', { exact: false }).click();
  await page.getByRole('button', { name: 'Làm lại từ đầu', exact: true }).click();
  await expect(page.locator('.mc-progress')).toContainText('Đã kiểm tra 0/1');
  await expect(page.locator('.mc-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa bộ đang học', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chọn đáp án. Hiểu cách dùng.' })).toBeVisible();
});

test('loaded long questions fit 360px, 430px and desktop without horizontal overflow', async ({
  page,
}) => {
  await openTool(page);
  await page
    .getByRole('textbox', { name: 'Nội dung Multiple Choice' })
    .fill(
      `${header}|context\n${'問'.repeat(120)}|${'longword'.repeat(45)}|B|C|D|1|${'context '.repeat(80)}`,
    );
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  for (const width of [360, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
