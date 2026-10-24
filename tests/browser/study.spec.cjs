const { test, expect } = require('@playwright/test');
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
  await expect(
    page.getByText('Đã ghi nhận câu trả lời trong phiên học.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xem bài mẫu', exact: true }).click();
  await expect(page.locator('.answer-sample')).toContainText('Yes we can meet tomorrow.');
});
test('Hot Review imports questions, imports answer, marks Later and paginates', async ({
  page,
}) => {
  await navigate(page, 'Hot Review');
  await page.getByRole('button', { name: 'Nhập dữ liệu', exact: true }).click();
  await page
    .locator('#hot-review-input')
    .fill(
      'group_id,group_title,lesson,question_no,question_jp,meaning_vi,option_a,option_b,option_c,option_d\ng,Ôn nhanh,Bài 1,1,私（わたし）は学生です。,Tôi là học sinh.,A1,B1,C1,D1\ng,Ôn nhanh,Bài 1,2,日本語を勉強します。,Tôi học tiếng Nhật.,A2,B2,C2,D2',
    );
  await page.getByRole('button', { name: 'Tạo bài', exact: true }).click();
  await expect(page.locator('.quiz-option')).toHaveCount(4);
  await page.locator('.quiz-option input').first().check();
  await page.locator('.hot-review-star').click();
  await page.getByText('Dữ liệu & tùy chọn ôn tập', { exact: true }).click();
  await page.getByRole('button', { name: 'Nhập answer', exact: true }).click();
  await page
    .locator('#answer-import-input')
    .fill(
      'correct_answer,answer_detail_vi,vocab_kanji,grammar\nA,学生です = là học sinh,学生（がくせい）= học sinh,です là trợ động từ\nB,勉強します = học,勉強（べんきょう）= học,を đánh dấu tân ngữ',
    );
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.locator('.hot-review-answer-panel')).toContainText('học sinh');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.quiz-jp')).toContainText('日本語');
});
test('Audio Looper reads a local file and reports genuinely missing public assets', async ({
  page,
}) => {
  await navigate(page, 'Audio Looper');
  await expect(
    page.getByText('Checkout hiện chưa có file audio public.', { exact: false }),
  ).toBeVisible();
  const wav = Buffer.alloc(16044);
  wav.write('RIFF');
  wav.writeUInt32LE(16036, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(16000, 40);
  await page
    .getByLabel('Audio trên thiết bị')
    .setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: wav });
  await page.getByRole('button', { name: '▶ Phát', exact: true }).click();
  await expect
    .poll(() => page.locator('audio').evaluate((audio) => audio.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Ⅱ Tạm dừng', exact: true }).click();
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
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
      'Hot Review',
      'Audio Looper',
    ]) {
      await navigate(page, name);
      await expect(page.locator('h1')).toContainText(name);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        name,
      ).toBe(true);
    }
  });
