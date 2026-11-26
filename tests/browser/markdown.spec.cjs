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
test('mobile editor Cancel preserves prior content and reading focus copies Markdown', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  const source = '# Giữ bài này\n\n```text\n' + 'x'.repeat(250) + '\n```';
  await openMobileEditor(page, source);
  await page.getByRole('button', { name: 'Nhập Markdown', exact: true }).click();
  await page.locator('#lesson-mobile-source').fill('# Không áp dụng');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.locator('#lesson-output h1')).toHaveText('Giữ bài này');
  await page.getByRole('button', { name: 'Đọc tập trung' }).click();
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  await expect(page.locator('.focus-actions').getByRole('status')).toContainText(
    'Đã copy Markdown.',
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);
  await page.getByRole('button', { name: 'Thoát chế độ đọc tập trung' }).click();
  await expect(page.getByRole('button', { name: 'Nhập Markdown', exact: true })).toBeVisible();
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
test('incorrect answers in markdown quiz show red state on option, feedback, dot and review', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '# Wrong\n\n```quiz\na | single_choice | Pick | Yes | No | 1 | Yes.\nb | typing | Type | She runs. | Correct.\n```',
  );
  const deck = page.locator('.lesson-deck');
  const wrongOption = deck.locator('.lesson-option').filter({ hasText: 'No' });
  await wrongOption.click();
  await expect(wrongOption).toHaveClass(/is-incorrect/);
  await expect(deck.locator('.lesson-feedback')).toHaveClass(/is-incorrect/);
  await expect(deck.locator('.lesson-dots button').first()).toHaveText('1 ✕');
  await expect(deck.locator('.lesson-dots button').first()).toHaveClass(/is-incorrect/);
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await expect(deck.locator('.lesson-dots button').first()).toHaveClass(/is-incorrect/);
  await deck.getByLabel('Câu trả lời').fill('Wrong answer');
  await deck.getByLabel('Câu trả lời').press('Enter');
  await expect(deck.locator('.lesson-feedback')).toHaveClass(/is-incorrect/);
  await deck.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(deck.getByRole('button', { name: /1\. Sai/ })).toHaveClass(/is-incorrect/);
  await expect(deck.getByRole('button', { name: /2\. Sai/ })).toHaveClass(/is-incorrect/);
});
test('work English course opens a lesson and navigates between days', async ({ page }) => {
  await page.goto('/markdown/?course=1');
  await expect(page.getByRole('heading', { name: 'Ngày 1: Giới thiệu bản thân' })).toBeVisible();
  await expect(page.locator('.lesson-deck h3')).toContainText('1 / 10');
  await expect(page.locator('.lesson-dots button')).toHaveCount(10);
  await page.getByRole('button', { name: 'Thoát chế độ đọc tập trung' }).click();
  await page.getByRole('link', { name: /Ngày 2: Mô tả công việc/ }).click();
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
test('course starts fresh on reload without writing answer progress', async ({ page }) => {
  const progressWrites = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/progress'))
      progressWrites.push(request.url());
  });
  await page.goto('/markdown/?course=1');
  const deck = page.locator('.lesson-deck');
  await expect(page.getByRole('heading', { name: 'Ngày 1: Giới thiệu bản thân' })).toBeVisible();
  for (const token of ['I', 'am', 'a developer.']) {
    await deck.getByRole('button', { name: token, exact: true }).click();
  }
  await deck.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(deck).toContainText('Chính xác!');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await deck.getByLabel('Câu trả lời').fill('I am a developer');
  await deck.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(deck).toContainText('Chính xác!');
  expect(progressWrites).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ngày 1: Giới thiệu bản thân' })).toBeVisible();
  await expect(deck.locator('.lesson-dots button').first()).toHaveText('1');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await expect(deck.getByLabel('Câu trả lời')).toHaveValue('');
  await expect(deck.locator('.lesson-feedback')).toBeHidden();
});
test('completed course day rotates menu, survives reload, and wraps after day 30', async ({
  page,
}) => {
  const lessons = require('../../database/seed/work-english-30.json');
  const { parse } = require('../../src/services/lesson-parser.cjs');
  async function complete(day) {
    await page.goto(`/markdown/?course=${day}`);
    await expect(page.getByRole('heading', { name: new RegExp(`Ngày ${day}:`) })).toBeVisible();
    if (day === 30)
      await expect
        .poll(() =>
          page
            .locator('select[aria-label="Chọn ngày học"]')
            .evaluate((select) => select.options[0].value),
        )
        .toBe('2');
    const deck = page.locator('.lesson-deck');
    const quizzes = parse(lessons[day - 1].source).find((b) => b.type === 'deck').quizzes;
    for (let i = 0; i < quizzes.length; i++) {
      const q = quizzes[i];
      if (q.type === 'word_order') {
        for (const token of q.tokens)
          await deck
            .locator('.lesson-order-tokens')
            .nth(1)
            .getByRole('button', { name: token, exact: true })
            .first()
            .click();
      } else await deck.getByLabel('Câu trả lời').fill(q.answer);
      await deck.getByRole('button', { name: 'Kiểm tra' }).click();
      await deck
        .getByRole('button', { name: i === quizzes.length - 1 ? 'Xem kết quả' : 'Tiếp →' })
        .click();
    }
  }
  await page.goto('/markdown/?course=1');
  await expect(page.getByRole('heading', { name: 'Ngày 1: Giới thiệu bản thân' })).toBeVisible();
  await page.locator('.lesson-deck').getByRole('button', { name: 'Câu 10', exact: true }).click();
  await page.locator('.lesson-deck').getByRole('button', { name: 'Xem kết quả' }).click();
  await expect
    .poll(() =>
      page
        .locator('select[aria-label="Chọn ngày học"]')
        .evaluate((select) => select.options[0].value),
    )
    .toBe('1');
  await expect(page.locator('select[aria-label="Chọn ngày học"] option[value="1"]')).toContainText(
    'Chưa có thời gian ôn',
  );
  await complete(1);
  await expect(page.locator('select[aria-label="Chọn ngày học"] option[value="1"]')).toContainText(
    'Vừa ôn xong',
  );
  await expect
    .poll(() =>
      page
        .locator('select[aria-label="Chọn ngày học"]')
        .evaluate((select) => select.options[0].value),
    )
    .toBe('2');
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator('select[aria-label="Chọn ngày học"]')
        .evaluate((select) => select.options[0].value),
    )
    .toBe('2');
  await expect(page.locator('select[aria-label="Chọn ngày học"] option[value="1"]')).toContainText(
    'Vừa ôn xong',
  );
  await complete(30);
  await expect(page.locator('select[aria-label="Chọn ngày học"] option[value="30"]')).toContainText(
    'Vừa ôn xong',
  );
  await expect
    .poll(() =>
      page
        .locator('select[aria-label="Chọn ngày học"]')
        .evaluate((select) => select.options[0].value),
    )
    .toBe('1');
});

test('course list displays review times and opens a focused lesson', async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/markdown/?course=list');
    await expect(
      page.getByRole('heading', { name: 'Tiếng Anh công việc · 30 ngày' }),
    ).toBeVisible();
    const list = page.locator('.course-list');
    await expect(list.locator('li')).toHaveCount(30);
    await expect(list.getByRole('link', { name: /Ngày 1: Giới thiệu bản thân/ })).toContainText(
      'Chưa có thời gian ôn',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await list.getByRole('link', { name: /Ngày 1: Giới thiệu bản thân/ }).click();
    await expect(page.getByRole('heading', { name: 'Ngày 1: Giới thiệu bản thân' })).toBeVisible();
    await expect(page.locator('.markdown-page')).toHaveClass(/reading-focus/);
    await expect(page.locator('.source-pane')).toBeHidden();
    await page.getByRole('button', { name: 'Thoát chế độ đọc tập trung' }).click();
    await expect(
      page.getByRole('heading', { name: 'Tiếng Anh công việc · 30 ngày' }),
    ).toBeVisible();
  }
});

test('quiz A/D shortcuts navigate only inside the deck and never interrupt typing', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '# Shortcuts\n\n```quiz\na | single_choice | Pick | Yes | No | 1 | Yes.\nb | word_order | Order | She / runs | She runs. | Correct.\nc | typing | Type | A dog. | Correct.\n```',
  );
  const deck = page.locator('.lesson-deck');
  await deck.getByRole('button', { name: 'Câu 1', exact: true }).focus();
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('1 / 3');
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('2 / 3');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('1 / 3');
  await deck.getByRole('button', { name: 'Câu 3', exact: true }).click();
  const input = deck.getByRole('textbox', { name: 'Câu trả lời' });
  await input.fill('');
  await input.pressSequentially('A dog');
  await expect(input).toHaveValue('A dog');
  await expect(deck.locator('h3')).toContainText('3 / 3');
  await deck.getByRole('button', { name: 'Câu 3', exact: true }).focus();
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('3 / 3');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('2 / 3');
});

test('typing displays authored shuffled words as blocks without instruction text', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '```quiz-deck\na | typing | Use all the shuffled words to write one sentence:&#xA0; runs / The dog | The dog runs. | Đúng.\nb | typing | Gõ câu từ các từ đã xáo: happy / is / She | She is happy. | Đúng.\n```',
  );
  const deck = page.locator('.lesson-deck');
  const hints = deck.getByLabel('Cụm từ gợi ý');
  await expect(hints.locator('span')).toHaveCount(2);
  expect((await hints.locator('span').allTextContents()).sort()).toEqual(
    ['The dog', 'runs'].sort(),
  );
  await expect(deck).not.toContainText('Use all the shuffled words');
  await deck.getByLabel('Câu trả lời').fill('The dog runs.');
  await deck.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(deck).toContainText('Chính xác!');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await expect(hints.locator('span')).toHaveCount(3);
  await expect(deck).not.toContainText('Gõ câu từ các từ đã xáo:');
  await deck.getByLabel('Câu trả lời').fill('She is happy.');
  await deck.getByRole('button', { name: 'Kiểm tra' }).click();
  await deck.getByRole('button', { name: 'Xem kết quả' }).click();
  await expect(deck).not.toContainText('Gõ câu từ các từ đã xáo:');
});

test('expanded quiz keeps its answers and focus without jumping when an answer is chosen', async ({
  page,
}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/markdown/');
    await expect(page.locator('#markdown-loading')).toBeHidden();
    if (width < 600) await openMobileEditor(page, lesson);
    else await page.locator('#lesson-source').fill(lesson);
    await page.waitForTimeout(600); // Let the editor's debounced preview settle.
    const deck = page.locator('.lesson-deck').first();
    await expect(deck).toBeVisible();
    await deck.getByRole('button', { name: 'Mở rộng luyện tập' }).click();
    const dialog = page.getByRole('dialog', { name: 'Luyện tập Mini Quiz 1' });
    await expect(dialog).toBeVisible();
    const question = dialog.locator('.lesson-deck h3');
    await expect(question).toContainText('1 /');
    const selected = dialog.locator('.lesson-option input').first();
    const before = await selected.evaluate((el) => el.getBoundingClientRect().top);
    await selected.click();
    await expect(selected).toBeFocused();
    expect(
      Math.abs((await selected.evaluate((el) => el.getBoundingClientRect().top)) - before),
    ).toBeLessThan(2);
    await page.keyboard.press('d');
    await expect(question).toContainText('2 /');
    await page.keyboard.press('a');
    await expect(question).toContainText('1 /');
    await expect(dialog.locator('.lesson-option input:checked')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Đóng luyện tập' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(deck.locator('input:checked')).toHaveCount(1);
  }
});

test('mobile expanded quiz navigation stays at the bottom while content scrolls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  const longText = 'Một câu hỏi dài giúp kiểm tra bố cục. '.repeat(45);
  await openMobileEditor(
    page,
    `# Bài học\n\n\`\`\`quiz\nq1 | single_choice | ${longText} | A | B | 1 | Giải thích.\nq2 | typing | Gõ câu | I work. | Giải thích.\n\`\`\``,
  );
  await page.locator('.lesson-deck').getByRole('button', { name: 'Mở rộng luyện tập' }).click();
  const dialog = page.getByRole('dialog', { name: 'Luyện tập Mini Quiz 1' });
  const bounds = await dialog.boundingBox();
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 390, height: 650 });
  const nav = dialog.locator('.lesson-deck-nav');
  const before = await nav.boundingBox();
  expect(before.y + before.height).toBeGreaterThan(600);
  await dialog.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const after = await nav.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  await nav.getByRole('button', { name: 'Tiếp →' }).click();
  const input = dialog.getByRole('textbox', { name: 'Câu trả lời' });
  await input.focus();
  await expect(nav).toHaveCSS('position', 'static');
});

test('flipcards reveal and navigate with keyboard on mobile and desktop', async ({ page }) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(page, '```flipcard\n猫 | Con mèo\n**apple** | quả táo\n```');
  const deck = page.getByRole('region', { name: 'Bộ flipcard' });
  const card = deck.locator('.flipcard-face');
  await expect(card).toContainText('猫');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toContainText('Con mèo');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await expect(card).toContainText('apple');
  await page.keyboard.press('Tab');
  await card.focus();
  await page.keyboard.press('Space');
  await expect(card).toContainText('quả táo');
  await deck.getByRole('button', { name: '← Trước' }).click();
  await expect(card).toContainText('猫');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('structured flipcard shows labeled context, example and optional synonyms', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '```flipcard\napple | quả táo | An apple. | fruit\nhappy | vui vẻ | She is happy. |\n```',
  );
  const deck = page.getByRole('region', { name: 'Bộ flipcard' });
  const card = deck.locator('.flipcard-face');
  await card.click();
  await expect(card).toContainText('Giải thích / ngữ cảnh: quả táo');
  await expect(card).toContainText('Ví dụ: An apple.');
  await expect(card).toContainText('Từ đồng nghĩa: fruit');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await card.click();
  await expect(card).toContainText('Ví dụ: She is happy.');
  await expect(card).not.toContainText('Từ đồng nghĩa:');
});

for (const width of [390, 1280]) {
  test(`expanded flipcards preserve state and keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/markdown/');
    await expect(page.locator('#markdown-loading')).toBeHidden();
    await openMobileEditor(page, '```flipcard\n猫 | Con mèo\n**apple** | quả táo\n```');
    const deck = page.getByRole('region', { name: 'Bộ flipcard' });
    const expand = deck.getByRole('button', { name: 'Mở rộng flipcard' });
    await expand.click();
    const dialog = page.getByRole('dialog', { name: 'Luyện tập flipcard' });
    const card = dialog.locator('.flipcard-face');
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card).toContainText('Con mèo');
    await dialog.getByRole('button', { name: 'Tiếp →' }).click();
    await card.click();
    await expect(card).toContainText('quả táo');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(expand).toBeFocused();
    await expect(deck.locator('.flipcard-face')).toContainText('quả táo');
    await expect(deck).toContainText('Thẻ 2 / 2');
    await expand.click();
    await page
      .getByRole('dialog', { name: 'Luyện tập flipcard' })
      .getByRole('button', { name: 'Đóng flipcard' })
      .click();
    await expect(expand).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('flipcards show multiple authored parts of speech and hide missing values', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '- **routine** /ruːˈtiːn/ (N, V): thói quen.\n\n```flipcard\nroutine | thói quen | A routine. | habit\nhappy | vui | She is happy. | glad | Adj\nunknown | chưa rõ | Example. |\n```',
  );
  const deck = page.getByRole('region', { name: 'Bộ flipcard' });
  const card = deck.locator('.flipcard-face');
  await card.click();
  await expect(card).toContainText('Từ loại: N, V');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await card.click();
  await expect(card).toContainText('Từ loại: Adj');
  await deck.getByRole('button', { name: 'Tiếp →' }).click();
  await card.click();
  await expect(card).not.toContainText('Từ loại:');
  await expect(card).not.toContainText('()');
});

for (const expanded of [false, true]) {
  test(`flipcards navigate freely with A/D and flip with Space (${expanded ? 'expanded' : 'inline'})`, async ({
    page,
  }) => {
    await page.goto('/markdown/');
    await expect(page.locator('#markdown-loading')).toBeHidden();
    await openMobileEditor(page, '```flipcard\n猫 | Con mèo\n犬 | Con chó\n```');
    const deck = page.getByRole('region', { name: 'Bộ flipcard' });
    if (expanded) await deck.getByRole('button', { name: 'Mở rộng flipcard' }).click();
    const card = deck.locator('.flipcard-face');
    const next = deck.getByRole('button', { name: 'Tiếp →' });
    await expect(next).toBeEnabled();
    await card.focus();
    await page.keyboard.press('d');
    await expect(card).toContainText('犬');
    await expect(card).toBeFocused();
    await expect(next).toBeDisabled();
    await page.keyboard.press('Space');
    await expect(card).toContainText('Con chó');
    await page.keyboard.press('Space');
    await expect(card).toContainText('犬');
    await page.keyboard.press('a');
    await expect(card).toContainText('猫');
    await expect(next).toBeEnabled();
    await next.click();
    await expect(card).toContainText('犬');
    await expect(card).toBeFocused();
  });
}

test('Escape closes expanded quiz modal without exiting focus mode', async ({ page }) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(
    page,
    '```quiz\nq1 | single_choice | 1 + 1? | 1 | 2 | 2 | Hai là đúng.\n```',
  );
  await page.locator('#lesson-focus').click();
  await expect(page.locator('#lesson-focus')).toBeHidden();

  const deck = page.locator('.lesson-deck');
  await deck.getByRole('button', { name: 'Mở rộng luyện tập' }).click();
  const dialog = page.getByRole('dialog', { name: 'Luyện tập Mini Quiz 1' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#lesson-focus')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.locator('#lesson-focus')).toBeVisible();
});

test('renders visual-* DSL blocks interactively in /markdown/ on mobile without overflow', async ({
  page,
}) => {
  const fs = require('node:fs');
  const path = require('node:path');
  const demo = fs.readFileSync(path.join(__dirname, '../../input/sqs-visual-demo.md'), 'utf8');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();
  await openMobileEditor(page, demo);

  await expect(page.locator('#lesson-output h1')).toHaveText(
    'M08.1: Messaging Fundamentals — Amazon SQS & DLQ',
  );
  await expect(page.locator('.visual-grid-card')).toHaveCount(5);
  await expect(page.locator('.visual-flow-step').first()).toBeVisible();
  await expect(page.locator('.visual-compare-card')).toHaveCount(2);
  await expect(page.locator('.visual-token.is-reordered')).toHaveCount(1);
  await expect(page.locator('.visual-token.is-duplicate')).toHaveCount(1);
  await expect(page.locator('.visual-timeline-item')).toHaveCount(4);
  await expect(page.locator('.visual-metric-card')).toHaveCount(6);

  const simStatus = page.locator('.visual-sim-status');
  await expect(simStatus).toContainText('Duplicate processing risk');
  await page.getByRole('button', { name: 'Safe (90s / 60s)' }).click();
  await expect(simStatus).toContainText('Safe');

  const vtSlider = page.getByRole('slider', { name: 'Visibility Timeout', exact: true });
  await vtSlider.fill('20');
  await vtSlider.dispatchEvent('input');
  await expect(simStatus).toContainText('Duplicate processing risk');

  await page.getByRole('button', { name: '↻ Chạy lại' }).click();
  await expect(page.locator('.visual-token.is-popping').first()).toBeAttached();

  await page.getByRole('button', { name: 'Công cụ Markdown', exact: true }).click();
  await page.getByLabel('Dark mode').check();
  await expect(page.locator('body')).toHaveClass('dark');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('shows empty drop state and renders immediately when dropping a .md file', async ({
  page,
}) => {
  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();

  const dropEmpty = page.locator('.lesson-drop-empty');
  await expect(dropEmpty).toBeVisible();
  await expect(dropEmpty.getByRole('button', { name: 'Chọn file .md', exact: true })).toBeVisible();

  const mdContent = [
    '# Dropped Lesson',
    '',
    '```visual-grid',
    'title: Quick Grid',
    'columns: 2',
    'unlink | Decoupling | Tách rời service',
    'layers | Buffering | Đệm tải đột biến',
    '```',
  ].join('\n');

  const dataTransfer = await page.evaluateHandle((text) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], 'dropped-lesson.md', { type: 'text/markdown' }));
    return dt;
  }, mdContent);

  await page.locator('.preview-workspace').dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('#lesson-output h1')).toHaveText('Dropped Lesson');
  await expect(page.locator('.visual-grid-card')).toHaveCount(2);
  await expect(page.locator('#lesson-status')).toContainText('dropped-lesson.md');
});

test('renders themed Mermaid diagrams at readable width without a toolbar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/markdown/');
  await expect(page.locator('#markdown-loading')).toBeHidden();

  const md = [
    '# Mermaid Test',
    '',
    '```mermaid',
    'flowchart LR',
    '  Q[SQS Queue] --> W[Worker]',
    '  W --> D{Already Processed?}',
    '  class Q primary',
    '  class D warning',
    '  D -->|Yes| DEL[DeleteMessage]',
    '  D -->|No| DLQ[Dead Letter Queue]',
    '  DLQ --> X[Custom Node]',
    '  style X fill:#123456,stroke:#654321',
    '```',
  ].join('\n');

  await openMobileEditor(page, md);

  const card = page.locator('.mermaid-card');
  const svg = card.locator('.mermaid-scroll svg');
  await expect(card).toBeVisible();
  await expect(svg).toBeVisible();
  await expect(page.locator('.lesson-error')).toHaveCount(0);

  const initialWidth = await svg.evaluate((el) => el.getBoundingClientRect().width);
  expect(initialWidth).toBeGreaterThan(400);

  const colors = await svg.evaluate((el) => {
    const fills = {};
    el.querySelectorAll('g.node').forEach((node) => {
      const shape = node.querySelector('rect, polygon');
      const label = (node.textContent || '').trim();
      if (shape) fills[label] = shape.style.fill;
    });
    return fills;
  });
  // Default theme colors and author styling.
  expect(colors['Worker']).toMatch(/255,\s*254,\s*249|#fffef9/i);
  expect(colors['SQS Queue']).toContain('color-mix(');
  expect(colors['Already Processed?']).toContain('color-mix(');
  expect(colors['Already Processed?']).not.toBe(colors['SQS Queue']);
  expect(colors['Custom Node']).toMatch(/18,\s*52,\s*86|#123456/i);

  await expect(card.locator('.mermaid-card-head')).toHaveCount(0);

  expect(errors).toEqual([]);
});
