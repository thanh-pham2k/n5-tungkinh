const { test, expect } = require('./fixtures.cjs');
const errors = new WeakMap();
async function navigate(page, name) {
  const exit = page.getByRole('button', { name: '× Thoát Focus', exact: true });
  if (await exit.isVisible()) await exit.click();
  const menu = page.getByRole('button', { name: 'Đổi công cụ học' });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('dialog').getByRole('button', { name, exact: false }).click();
  } else await page.locator('.sidebar').getByRole('button', { name, exact: false }).click();
}
async function importCsv(page, text, openName = '＋ Nhập CSV') {
  await page.getByRole('button', { name: openName, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Nội dung CSV' }).fill(text);
  await dialog.getByRole('button', { name: 'Nạp dữ liệu' }).click();
  await expect(dialog).not.toBeVisible();
}
const header = 'vocabulary,hiragana,meaning_vi,example_ja,example_vi';
const csv = `${header}\nHello,,Xin chào,Hello world.,Xin chào thế giới.\ncat,,mèo,This is a cat.,Đây là mèo.`;
const wordCsv = `${header},word_order\nHello,,Xin chào,Hello world.,Xin chào thế giới.,Hello|world\ncat,,mèo,This is a cat.,Đây là mèo.,This|is|a|cat`;
test.beforeEach(async ({ page }) => {
  const list = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
  await page.route('https://api.soundoftext.com/**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable in deterministic UI test' }),
  );
  await page.goto('/');
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
test('Instant imports, handles audio failure and keeps imported data across tool switches', async ({
  page,
}) => {
  await importCsv(page, csv);
  await expect(page.locator('.vocab-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Phát Hello', exact: true }).click();
  await expect(page.locator('.status-error[role=alert]:visible')).toContainText('503');
  await navigate(page, 'Speaking Questions');
  await navigate(page, 'Instant Vocab');
  await expect(page.locator('.vocab-item')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('IELTS picker filters, random selection and real vocabulary import', async ({ page }) => {
  await page.getByRole('button', { name: '▤ Chọn bài IELTS', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox').first()).toBeVisible();
  await dialog.getByText('Chọn nhanh', { exact: false }).click();
  await dialog.getByRole('spinbutton', { name: 'Số mục' }).fill('3');
  await dialog.getByRole('button', { name: 'Chọn ngẫu nhiên', exact: true }).click();
  await expect(dialog.locator('input:checked')).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Bắt đầu →' }).click();
  await expect(page.locator('.vocab-item')).toHaveCount(3);
});
test('flashcard front/back, Later, zoom and reset', async ({ page }) => {
  await navigate(page, 'Vocab Review');
  await importCsv(page, csv);
  await expect(page.locator('.flashcard').first()).not.toContainText('Xin chào');
  await page.getByRole('button', { name: 'Xem đáp án', exact: true }).click();
  await expect(page.locator('.flash-answer').first()).toContainText('Xin chào');
  await page.getByRole('button', { name: '☆ Later', exact: true }).click();
  await page.getByText('Tùy chọn', { exact: false }).first().click();
  await page.getByRole('button', { name: 'Later · 1', exact: true }).click();
  await expect(page.getByText('Ôn thẻ Later', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Hello');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
});
test('Word Order checks actual token order and switches primary action', async ({ page }) => {
  await navigate(page, 'Word Order');
  await importCsv(page, wordCsv);
  await page.locator('.word-pool').getByRole('button', { name: 'world', exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.locator('.status-error[role=alert]:visible')).toContainText('Chưa chính xác');
  await page.locator('.answer-slots').getByRole('button').click();
  await page.locator('.word-pool').getByRole('button', { name: 'Hello', exact: true }).click();
  await page.locator('.word-pool').getByRole('button', { name: 'world', exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(
    page.getByText('✓ Chính xác! Bạn đã hoàn thành câu.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Câu tiếp →', exact: true }).click();
  await expect(page.getByText('Đây là mèo.', { exact: true })).toBeVisible();
});
test('Typing uses shared sentence deck and handles focused keyboard input', async ({ page }) => {
  await navigate(page, 'Word Order');
  await importCsv(page, wordCsv);
  await navigate(page, 'Typing Review');
  const input = page.getByRole('textbox', { name: 'Câu trả lời của bạn' });
  await input.fill('HELLO, WORLD!');
  await input.press('Enter');
  await expect(
    page.getByText('✓ Chính xác! Bạn đã hoàn thành câu.', { exact: true }),
  ).toBeVisible();
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await input.fill('wrong');
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.locator('.status-error[role=alert]:visible')).toContainText('Chưa chính xác');
});
test('Structures opens five real exercises and Speaking filters Parts', async ({ page }) => {
  await navigate(page, 'Sentence Structures');
  await page.getByRole('button', { name: 'Luyện 5 câu →' }).first().click();
  await expect(page.getByRole('heading', { name: 'Word Order', exact: true })).toBeVisible();
  await expect(page.getByText('1 / 5', { exact: true })).toBeVisible();
  await navigate(page, 'Speaking Questions');
  await page.getByLabel('Phần thi').selectOption('2');
  await expect(page.locator('.speaking-card')).toHaveCount(1);
  await expect(page.getByText('You should say:', { exact: true })).toBeVisible();
});
test('Writing imports actual contract, records answers and reveals sample', async ({ page }) => {
  await navigate(page, 'Writing Review');
  await importCsv(
    page,
    'context,prompt,input,sample_answer\nAt work,Reply to an email,Can we meet?,Yes we can meet tomorrow.',
    '＋ Nhập đề CSV',
  );
  await page.getByRole('textbox', { name: 'Câu trả lời của bạn' }).fill('Yes we can.');
  await page.getByRole('button', { name: 'Ghi nhận bài viết' }).click();
  await expect(page.getByText('Đã lưu câu trả lời trên Turso.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Xem bài mẫu', exact: true }).click();
  await expect(page.locator('.answer-sample')).toContainText('Yes we can meet tomorrow.');
});
test('Multiple Choice grades wrong answers, reveals context/examples, paginates and retries', async ({
  page,
}) => {
  await navigate(page, 'Multiple Choice');
  await page.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Nội dung Multiple Choice' });
  await input.fill(
    'question|option_1|option_2|option_3|option_4|correct_answer|explanation|context|example|example_meaning\n学生の読み方は？|がくせい|がっこう|せんせい|かいしゃ|1|学生 đọc là がくせい。|Chọn cách đọc đúng.|私は学生です。|Tôi là học sinh.\n猫です。|本|猫|犬|鳥|2|猫 là mèo。|||',
  );
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  await expect(page.locator('.mc-context')).toContainText('Chọn cách đọc đúng.');
  await expect(page.locator('.mc-feedback')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kiểm tra câu 1', exact: true })).toBeDisabled();
  await page.locator('.mc-option input').nth(1).check();
  await page.getByRole('button', { name: 'Kiểm tra câu 1', exact: true }).click();
  await expect(page.locator('.mc-feedback')).toContainText('Chưa đúng. Đáp án đúng: 1.');
  await expect(page.locator('.mc-feedback')).toContainText('Tôi là học sinh.');
  await expect(page.locator('.mc-option input').first()).toBeDisabled();
  await page.getByRole('button', { name: 'Tiếp →', exact: true }).click();
  await page.locator('.mc-option input').nth(1).check();
  await page.getByRole('button', { name: 'Kiểm tra câu 2', exact: true }).click();
  await expect(page.locator('.mc-progress')).toContainText('Đúng 1 · Sai 1');
  await page.getByText('Tùy chọn ôn tập', { exact: false }).click();
  await page.getByRole('button', { name: 'Làm lại câu sai (1)', exact: true }).click();
  await expect(page.locator('.mc-question-text')).toContainText('学生');
  await expect(page.locator('.mc-feedback')).toHaveCount(0);
  await page.locator('.mc-option input').first().check();
  await page.getByRole('button', { name: 'Kiểm tra câu 1', exact: true }).click();
  await expect(page.locator('.mc-feedback')).toContainText('Chính xác!');
  await expect(page.locator('.mc-progress')).toContainText('Đúng 2 · Sai 0');
});

for (const width of [360, 430, 1280])
  test(`all tool shells fit ${width}px with correct headings`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const name of [
      'Instant Vocab',
      'Vocab Review',
      'Word Order',
      'Typing Review',
      'Sentence Structures',
      'Speaking Questions',
      'Writing Review',
      'Multiple Choice',
    ]) {
      await navigate(page, name);
      await expect(page.locator('h1')).toContainText(name);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        name,
      ).toBe(true);
    }
  });
