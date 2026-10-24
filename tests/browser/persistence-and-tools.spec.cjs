const { test, expect } = require('@playwright/test');
async function navigate(page, name) {
  const exit = page.getByRole('button', { name: '× Thoát Focus', exact: true });
  if (await exit.isVisible()) await exit.click();
  await page.getByRole('button', { name: 'Đổi công cụ học' }).click();
  await page.getByRole('dialog').getByRole('button', { name, exact: false }).click();
}
test('flashcards preserve hide-reading, shuffle, previous and restart actions', async ({
  page,
}) => {
  await page.route('https://api.soundoftext.com/**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable in UI test' }),
  );
  await page.goto('/');
  await navigate(page, 'Vocab Review');
  await page.getByRole('button', { name: '＋ Nhập CSV', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Nội dung CSV' })
    .fill(
      'vocabulary,hiragana,meaning_vi,example_ja,example_vi\n本,ほん,sách,これは本です。,Đây là sách.\n猫,ねこ,mèo,猫です。,Là mèo.',
    );
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  await page.getByText('Tùy chọn', { exact: false }).first().click();
  await page.getByLabel('Tự phát audio').uncheck();
  await page.getByLabel('Hiện Hiragana').uncheck();
  await expect(page.locator('.flashcard').first()).not.toContainText('ほん');
  await page.getByRole('button', { name: 'Xáo thẻ', exact: true }).click();
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem đáp án', exact: true }).click();
  await page.getByRole('button', { name: 'Thẻ tiếp →', exact: true }).click();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← Trước', exact: true }).click();
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Học lại từ đầu', exact: true }).click();
  await expect(page.locator('.flashcard').first()).toContainText('本');
});
const hotCsv =
  'group_id,group_title,lesson,question_no,question_jp,meaning_vi,option_a,option_b,option_c,option_d\npersist,Ôn nhanh,Bài 1,1,本です。,Là sách.,本,猫,犬,鳥\npersist,Ôn nhanh,Bài 1,2,猫です。,Là mèo.,本,猫,犬,鳥';
async function loadHot(page) {
  await navigate(page, 'Hot Review');
  await page.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
  await page.locator('#hot-review-input').fill(hotCsv);
  await page.getByRole('button', { name: 'Tạo bài', exact: true }).click();
}
test('Hot Later survives reload; pagination, confirmation and copy use actual answers', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await loadHot(page);
  await page.getByRole('button', { name: 'Add to Review Later', exact: true }).click();
  await page.reload();
  await loadHot(page);
  await expect(
    page.getByRole('button', { name: 'Remove from Review Later', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.quiz-option input').first().check();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.getByRole('button', { name: 'Copy prompt + bài làm', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Tôi chọn: A. 本');
  await page.getByLabel('Số câu Hot Review mỗi trang').fill('2');
  await page.getByLabel('Số câu Hot Review mỗi trang').press('Tab');
  await expect(page.locator('.quiz-question')).toHaveCount(2);
  await page.getByText('Dữ liệu & tùy chọn ôn tập', { exact: true }).click();
  await page.getByRole('button', { name: 'Review Later', exact: true }).click();
  await expect(page.locator('.quiz-question')).toHaveCount(1);
});
test('Markdown sync scroll, copy, print action and sanitization remain functional', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  const source = Array.from(
    { length: 160 },
    (_, i) => `## Mục ${i}\n\nĐoạn học số ${i}. Nội dung giúp kiểm tra cuộn tài liệu.`,
  ).join('\n\n');
  await page.locator('#lesson-source').fill(source);
  await expect(page.locator('#lesson-output h2')).toHaveCount(160);
  await page.locator('#lesson-source').evaluate((el) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.6;
  });
  await expect
    .poll(() =>
      page
        .locator('#lesson-preview-scroll')
        .evaluate((el) => el.scrollTop / (el.scrollHeight - el.clientHeight)),
    )
    .toBeGreaterThan(0.55);
  await page.getByRole('button', { name: 'Công cụ Markdown', exact: true }).click();
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n')),
    )
    .toBe(source);
  await page.getByLabel('Sync scroll').uncheck();
  const previous = await page.locator('#lesson-preview-scroll').evaluate((el) => el.scrollTop);
  await page.locator('#lesson-source').evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.locator('#lesson-preview-scroll')).toHaveJSProperty('scrollTop', previous);
  await page.evaluate(() => {
    window.printCalled = false;
    window.print = () => {
      window.printCalled = true;
    };
  });
  await page.getByRole('button', { name: 'Xuất PDF', exact: true }).click();
  expect(await page.evaluate(() => window.printCalled)).toBe(true);
  await page.locator('#lesson-source').fill('# Safe\n\n<img src="x" onerror="window.unsafe=true">');
  await expect(page.locator('#lesson-output h1')).toHaveText('Safe');
  expect(await page.evaluate(() => window.unsafe)).toBeUndefined();
});
