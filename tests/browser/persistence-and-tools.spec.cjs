const { test, expect } = require('./fixtures.cjs');
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
const choiceText =
  'question|option_1|option_2|option_3|option_4|correct_answer\n本です。|本|猫|犬|鳥|1\n猫です。|本|猫|犬|鳥|2';
async function loadChoices(page) {
  await navigate(page, 'Multiple Choice');
  await page.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nội dung Multiple Choice' }).fill(choiceText);
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
}

test('Multiple Choice Later survives reload; pagination and copied results use checked answers', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await loadChoices(page);
  await page.getByRole('button', { name: 'Đánh dấu ôn sau', exact: true }).click();
  await expect
    .poll(async () =>
      (await page.request.get('/api/v1/study-contents?tool=multiple-choice'))
        .json()
        .then(
          async ({ data }) =>
            (await (await page.request.get(`/api/v1/study-contents/${data[0].id}`)).json()).data
              .progress.later?.length,
        ),
    )
    .toBe(1);
  await page.reload();
  await navigate(page, 'Multiple Choice');
  await page.getByRole('button', { name: '▤ Bài đã lưu', exact: true }).click();
  await page.locator('.saved-lessons-list button').filter({ hasText: '本です。' }).click();
  await expect(page.getByRole('button', { name: 'Bỏ ôn sau', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => localStorage.getItem('quiz_review_later_ids'))).toBeNull();
  await page.locator('.mc-option input').first().check();
  await page.getByRole('button', { name: 'Kiểm tra câu 1', exact: true }).click();
  await page.getByText('Tùy chọn ôn tập', { exact: false }).click();
  await page.getByRole('button', { name: 'Sao chép kết quả', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Tôi chọn: 1. 本');
  await page.getByLabel('Số câu mỗi trang', { exact: true }).fill('2');
  await expect(page.locator('.mc-question')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ôn sau (1)', exact: true }).click();
  await expect(page.locator('.mc-question')).toHaveCount(1);
  await page.getByRole('button', { name: 'Bỏ ôn sau', exact: true }).click();
  await expect(
    page.getByText('Chưa có câu nào trong danh sách ôn sau.', { exact: false }),
  ).toBeVisible();
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
