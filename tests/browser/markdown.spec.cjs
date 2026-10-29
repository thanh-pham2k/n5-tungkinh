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
  await page.locator('.lesson-option').filter({ hasText: '2' }).click();
  await expect(page.locator('.lesson-option.is-correct')).toBeVisible();
  await page.locator('.lesson-deck').getByRole('button', { name: 'Tiếp →', exact: true }).click();
  await page.locator('.lesson-option').filter({ hasText: '4' }).click();
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
test('mixed exercises grade, persist and retry on mobile', async ({ page }) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '# Mixed\n\n```quiz\na | single_choice | Pick | Yes | No | 1 | Yes.\nb | word_order | Order | She / goes / home | She goes home. | Correct.\nc | typing | Translate | She goes home. | Correct.\n```',
  );
  const deck = page.locator('.lesson-deck');
  await deck.locator('.lesson-option').filter({ hasText: 'Yes' }).click();
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await deck.getByRole('button', { name: 'She', exact: true }).click();
  await deck.getByRole('button', { name: 'goes', exact: true }).click();
  await deck.getByRole('button', { name: 'home', exact: true }).click();
  await deck.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(deck).toContainText('Chính xác!');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await deck.getByLabel('Câu trả lời').fill('she GOES home');
  await deck.getByLabel('Câu trả lời').press('Enter');
  await expect(deck).toContainText('Chính xác!');
  await deck.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(deck).toContainText('Đúng 3/3');
  await deck.getByRole('button', { name: 'Luyện lại bộ này' }).click();
  await expect(deck.locator('input:checked')).toHaveCount(0);
});
test('work English course opens a lesson and navigates between days', async ({ page }) => {
  await page.goto('/markdown/?course=1');
  await expect(page.getByRole('heading', { name: 'Ngày 1: Giới thiệu bản thân' })).toBeVisible();
  await expect(page.locator('.lesson-deck h3')).toContainText('1 / 10');
  await expect(page.locator('.lesson-dots button')).toHaveCount(10);
  await page.getByLabel('Chọn ngày học').selectOption('2');
  await expect(page.getByRole('heading', { name: 'Ngày 2: Mô tả công việc' })).toBeVisible();
  await expect(page.locator('.lesson-deck')).toContainText('Nói: Tôi làm việc với trang web.');
});

test('work English lesson fits desktop and mobile', async ({ page }) => {
  for (const width of [360, 430, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/markdown/?course=15');
    await expect(page.getByRole('heading', { name: 'Ngày 15: Đề xuất giải pháp' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
test('word order shuffles on opening and retry but remains stable while selecting', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await openMobileEditor(
    page,
    '```quiz\nq | word_order | Xếp câu | One / two / three | One two three | Đúng thứ tự.\n```',
  );
  const deck = page.locator('.lesson-deck');
  const choices = deck.locator('.lesson-order-tokens').nth(1);
  await expect(choices.locator('button')).toHaveText(['two', 'three', 'One']);
  await choices.getByRole('button', { name: 'two', exact: true }).click();
  await expect(choices.locator('button')).toHaveText(['three', 'One']);
  await deck.getByRole('button', { name: 'Xem kết quả' }).click();
  await page.evaluate(() => {
    Math.random = () => 0.999;
  });
  await deck.getByRole('button', { name: 'Luyện lại bộ này' }).click();
  await expect(choices.locator('button')).toHaveText(['One', 'two', 'three']);
});
test('choice shuffle preserves original answers across navigation and retry', async ({ page }) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await openMobileEditor(
    page,
    '```quiz\na | single_choice | Pick | Alpha | Beta | Gamma | 2 | Beta đúng.\nb | single_choice | Next | Yes | No | 1 | Yes đúng.\n```',
  );
  const deck = page.locator('.lesson-deck');
  await expect(deck.locator('.lesson-option')).toContainText(['Beta', 'Gamma', 'Alpha']);
  await deck.locator('.lesson-option').filter({ hasText: 'Beta' }).click();
  await expect(deck.locator('.lesson-option.is-correct')).toContainText('Beta');
  await expect(deck.locator('.lesson-option input:checked')).toBeFocused();
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await page.evaluate(() => {
    Math.random = () => 0.999;
  });
  await deck.getByRole('button', { name: '← Trước' }).click();
  await expect(deck.locator('.lesson-option')).toContainText(['Alpha', 'Beta', 'Gamma']);
  await expect(deck.locator('.lesson-option.is-correct')).toContainText('Beta');
  await expect(
    deck.locator('.lesson-option').filter({ hasText: 'Beta' }).locator('input'),
  ).toBeChecked();
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await deck.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(deck).toContainText('Đúng 1/2');
  await deck.getByRole('button', { name: 'Luyện lại bộ này' }).click();
  await expect(deck.locator('.lesson-option input:checked')).toHaveCount(0);
});
test('typing shows the matching word-order chunks without changing old standalone questions', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '```quiz\na | word_order | Giới thiệu | I / am / a developer. | I am a developer. | Dùng am.\nb | typing | Giới thiệu | I am a developer. | Dùng am.\nc | typing | Câu riêng | Hello. | Lời chào.\n```',
  );
  const deck = page.locator('.lesson-deck');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  const hints = deck.getByLabel('Cụm từ gợi ý');
  await expect(hints.locator('span')).toHaveCount(3);
  await expect(hints).toContainText('a developer.');
  await deck.getByLabel('Câu trả lời').fill('I am a developer');
  await deck.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(deck).toContainText('Chính xác!');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await expect(deck.getByLabel('Cụm từ gợi ý')).toHaveCount(0);
});

test('real day-one typing shows its three word-order chunks on mobile and desktop', async ({
  page,
}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/markdown/?course=1');
    await expect(page.getByRole('heading', { name: 'Ngày 1: Giới thiệu bản thân' })).toBeVisible();
    const deck = page.locator('.lesson-deck');
    await deck.getByRole('button', { name: 'Tiếp →' }).click();
    const hints = deck.getByLabel('Cụm từ gợi ý');
    await expect(hints).toBeVisible();
    await expect(hints.locator('span')).toHaveCount(3);
    expect((await hints.locator('span').allTextContents()).sort()).toEqual(
      ['I', 'a developer.', 'am'].sort(),
    );
    await deck.getByLabel('Câu trả lời').fill('I am a developer.');
    await deck.getByRole('button', { name: 'Kiểm tra' }).click();
    await expect(deck).toContainText('Chính xác!');
  }
});
