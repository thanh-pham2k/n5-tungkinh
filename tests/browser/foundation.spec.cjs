const { test, expect } = require('./fixtures.cjs');

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`Foundation opens interactive lesson in a modal at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/foundation/');
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    const button = page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ });
    await button.click();
    const dialog = page.getByRole('dialog', {
      name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#lesson-output h1')).toHaveText(
      'Lesson 1 — Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ',
    );
    await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
    await dialog.locator('.lesson-option').filter({ hasText: 'My teacher smiles.' }).click();
    await expect(dialog.locator('.lesson-option.is-correct')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('completed lessons rotate behind uncompleted lessons and persist across reload', async ({
  page,
}) => {
  const { createClient } = require('@libsql/client');
  const { resolve } = require('node:path');
  const { pathToFileURL } = require('node:url');
  const db = createClient({
    url: pathToFileURL(resolve('.migration-artifacts/browser-test.db')).href,
  });
  const original = await db.execute(
    "SELECT payload_json FROM study_catalog WHERE id = 'english-foundation'",
  );
  const lessons = [1, 2].map((n) => ({
    id: `lesson-${n}`,
    label: `Lesson ${n}`,
    title: `Test ${n}`,
    source: `# Lesson ${n} — Test ${n}\n\n\`\`\`quiz-deck\nq${n} | single_choice | Choose | Yes | No | 1 | Yes.\n\`\`\``,
  }));
  await db.execute({
    sql: 'UPDATE study_catalog SET payload_json = ? WHERE id = ?',
    args: [JSON.stringify(lessons), 'english-foundation'],
  });
  try {
    await page.goto('/foundation/');
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    const cards = page.locator('.foundation-lesson');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Lesson 1');
    await cards.nth(0).click();
    const dialog = page.getByRole('dialog', { name: 'Test 1' });
    await dialog.locator('.lesson-option').filter({ hasText: 'Yes' }).click();
    await dialog.getByRole('button', { name: 'Xem kết quả' }).click();
    await expect(cards.nth(0).getByRole('img', { name: 'Chưa hoàn thành' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(cards.nth(0)).toContainText('Lesson 2');
    await expect(cards.nth(1)).toContainText('Lesson 1');
    await page.reload();
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    await expect(cards.nth(0)).toContainText('Lesson 2');
    await expect(cards.nth(1).getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
    await cards.nth(0).click();
    const second = page.getByRole('dialog', { name: 'Test 2' });
    await second.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
    await expect(second.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
    await second.getByRole('button', { name: 'Đóng' }).click();
    await expect(cards.nth(0)).toContainText('Lesson 1');
    await expect(cards.nth(1)).toContainText('Lesson 2');
    await cards.nth(1).click();
    await page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' }).click();
    await expect(
      page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
    ).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
    await expect(cards.nth(0)).toContainText('Lesson 2');
    await expect(cards.nth(0).getByRole('img', { name: 'Chưa hoàn thành' })).toBeVisible();
    await page.reload();
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    await expect(cards.nth(0).getByRole('img', { name: 'Chưa hoàn thành' })).toBeVisible();
  } finally {
    await db.execute({
      sql: 'UPDATE study_catalog SET payload_json = ? WHERE id = ?',
      args: [original.rows[0].payload_json, 'english-foundation'],
    });
    db.close();
  }
});

test('completion remains unchanged if saving fails', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' });
  const button = dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true });
  await expect(button).toBeEnabled();
  await page.route('**/api/v1/study-contents/*/progress', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { message: 'Không lưu được tiến độ.' },
        meta: { requestId: 'test' },
      }),
    }),
  );
  await button.click();
  await expect(dialog.getByRole('alert').first()).toContainText('Không lưu được tiến độ.');
  await expect(button).toBeEnabled();
  await expect(
    page.locator('.foundation-lesson').first().getByRole('img', { name: 'Chưa hoàn thành' }),
  ).toBeVisible();
});

test('Apply audio requests Sound of Text and reports service errors', async ({ page }) => {
  let requestBody;
  await page.route('https://api.soundoftext.com/sounds', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' });
  await dialog.getByRole('button', { name: 'Nghe: My brother studies every day.' }).click();
  await expect(dialog.getByRole('alert').first()).toContainText('503');
  expect(requestBody).toEqual({
    engine: 'Google',
    data: { text: 'My brother studies every day.', voice: 'en-US' },
  });
});

test('Module 1 lists all lessons and opens the checkpoint', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  const cards = page.locator('.foundation-lesson');
  await expect(cards).toHaveCount(32);
  await expect(cards.nth(1)).toContainText('Lesson 2');
  await cards.nth(1).click();
  let dialog = page.getByRole('dialog', { name: 'Câu với be: danh từ và tính từ', exact: true });
  await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Nghe: I am a teacher/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await cards.nth(2).click();
  dialog = page.getByRole('dialog', { name: 'Basic Sentence Structure', exact: true });
  await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Nghe: I am a student/ })).toBeVisible();
});

test('Foundation quiz starts fresh on reopen while manual completion persists', async ({
  page,
}) => {
  const writes = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/progress'))
      writes.push(request.postDataJSON());
  });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  const card = page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ });
  await card.click();
  let dialog = page.getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' });
  let deck = dialog.locator('.lesson-deck').first();
  await deck.locator('.lesson-option').filter({ hasText: 'My teacher smiles.' }).click();
  await expect(deck.locator('input:checked')).toHaveCount(1);
  await expect.poll(() => writes.length).toBe(0);
  await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  expect(writes.length).toBeGreaterThan(0);
  for (const write of writes) expect(write.progress).not.toHaveProperty('markdownAnswers');
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await card.click();
  dialog = page.getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' });
  deck = dialog.locator('.lesson-deck').first();
  await expect(deck.locator('.lesson-option')).toHaveCount(4);
  await expect(deck.locator('input:checked')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  await page.reload();
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await card.click();
  await expect(page.locator('.lesson-deck').first().locator('.lesson-option')).toHaveCount(4);
  await expect(page.locator('.lesson-deck').first().locator('input:checked')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
});

test('Foundation ignores answers saved before this change', async ({ page }) => {
  await page.route('**/api/v1/study-contents', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    data.data.progress.markdownAnswers = { 'l1-mcq-01': 2 };
    await route.fulfill({ response, json: data });
  });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const deck = page.locator('.lesson-deck').first();
  await expect(deck.locator('.lesson-option')).toHaveCount(4);
  await expect(deck.locator('input:checked')).toHaveCount(0);
  await expect(deck.locator('.lesson-feedback')).toHaveCount(0);
});

test('real Foundation lesson completion displays its time and moves last after reload', async ({
  page,
}) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  const cards = page.locator('.foundation-lesson');
  await expect(cards).toHaveCount(32);
  await expect(cards.first()).toContainText('Lesson 1');
  await cards.first().click();
  const dialog = page.getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' });
  await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(cards.nth(2)).toContainText('Lesson 1');
  await expect(cards.nth(2).locator('time')).toHaveText('Vừa ôn xong');
  await expect(cards.nth(2).locator('time')).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}T/);
  await page.reload();
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await expect(cards).toHaveCount(32);
  await expect(cards.nth(2)).toContainText('Lesson 1');
  await expect(cards.nth(2).locator('time')).toHaveText('Vừa ôn xong');
  await cards.nth(2).click();
  await dialog.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' }).click();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(cards.first()).toContainText('Lesson 1');
  await expect(cards.first().locator('time')).toHaveCount(0);
});

test('A/D works after checking a Word Order answer in Foundation', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const deck = page
    .getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' })
    .locator('.lesson-deck')
    .last();
  await deck.getByRole('button', { name: 'Câu 5', exact: true }).click();
  const field = deck.locator('fieldset');
  for (const word of ['My friend', 'reads', 'books'])
    await field.getByRole('button', { name: word, exact: true }).click();
  await field.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(deck).toContainText('Chính xác!');
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('6 / 8');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('5 / 8');
});

test('A/D works after checking a typing answer with Enter or button', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const deck = page
    .getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' })
    .locator('.lesson-deck')
    .last();
  await deck.getByRole('button', { name: 'Câu 7', exact: true }).click();
  const input = deck.getByRole('textbox', { name: 'Câu trả lời' });
  await input.fill('Anna drinks tea');
  await input.press('Enter');
  await expect(deck).toContainText('Chính xác!');
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('8 / 8');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('7 / 8');
  await input.fill('a dog');
  await expect(input).toHaveValue('a dog');
  await expect(deck.locator('h3')).toContainText('7 / 8');
  await deck.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('8 / 8');
});

test('clicking quiz background activates A/D without disturbing typing focus', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 2.*Câu với be/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Câu với be: danh từ và tính từ' });
  const deck = dialog.locator('.lesson-deck').first();
  await deck.getByRole('button', { name: 'Câu 5', exact: true }).click();
  await dialog
    .getByRole('heading', { name: 'Câu với be: danh từ và tính từ', exact: true })
    .click();
  await deck.locator('h3').click();
  await expect(deck.locator('h3')).toBeFocused();
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('6 / 10');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('5 / 10');
  await deck.getByRole('button', { name: 'Câu 9', exact: true }).click();
  const input = deck.getByRole('textbox', { name: 'Câu trả lời' });
  await input.click();
  await input.pressSequentially('a dog');
  await expect(input).toHaveValue('a dog');
  await expect(deck.locator('h3')).toContainText('9 / 10');
});

test('last typing answer returns focus to quiz after Enter and A navigates back', async ({
  page,
}) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 2.*Câu với be/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Câu với be: danh từ và tính từ' });
  const deck = dialog.locator('.lesson-deck').first();
  await deck.getByRole('button', { name: 'Câu 10', exact: true }).click();
  const input = deck.getByRole('textbox', { name: 'Câu trả lời' });
  await input.fill('Tom is tired');
  await input.press('Enter');
  await expect(deck).toContainText('Chính xác!');
  await expect(deck.locator('h3')).toBeFocused();
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('9 / 10');
});

test('audio does not show loading or playing messages', async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('https://api.soundoftext.com/sounds', async (route) => {
    await pending;
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' });
  await dialog.getByRole('button', { name: 'Nghe: My brother studies every day.' }).click();
  await expect(dialog.getByText('Đang tạo audio…')).toHaveCount(0);
  await expect(dialog.getByText('♫ Đang phát')).toHaveCount(0);
  release();
  await expect(dialog.getByRole('alert').first()).toContainText('503');
});

test('Module 2 lessons open and completion stays within its module', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  const sections = page.locator('.foundation-module');
  await expect(sections).toHaveCount(10);
  const first = sections.nth(0).locator('.foundation-lesson');
  const second = sections.nth(1).locator('.foundation-lesson');
  await expect(second).toHaveCount(4);
  await second.first().click();
  const dialog = page.getByRole('dialog', { name: 'Danh từ và số ít, số nhiều' });
  await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Nghe: She reads a book/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(second.last()).toContainText('Lesson 1');
  await expect(first.first()).toContainText('Lesson 1');
  await page.reload();
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await expect(second.last()).toContainText('Lesson 1');
  await expect(second.last().getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
});

test('Phase 1 and Phase 2 show all ten modules and open lessons', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByText('Phase 2 — Talk About Life', { exact: true }).click();
  const modules = page.locator('.foundation-module');
  await expect(modules).toHaveCount(10);
  await expect(modules.nth(2)).toContainText('Be');
  await expect(modules.nth(3)).toContainText('Present Simple');
  await expect(modules.nth(4)).toContainText('Questions');
  await expect(modules.nth(9)).toContainText('Modal Basics');
  for (const index of [2, 3, 4, 9]) {
    await modules.nth(index).locator('.foundation-lesson').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
  }
});

test('phase checkpoints include integrated reading listening speaking and writing self-assessment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByText('Phase 2 — Talk About Life', { exact: true }).click();
  for (const [moduleName, checkpointName] of [
    ['Present Simple', 'Present Simple'],
    ['Modal Basics', 'Modal Basics'],
  ]) {
    const section = page
      .locator('.foundation-module')
      .filter({ has: page.getByRole('heading', { name: moduleName, exact: true }) });
    await section
      .getByRole('button', { name: new RegExp(`Mini Checkpoint.*${checkpointName}`) })
      .click();
    const dialog = page.getByRole('dialog', { name: checkpointName });
    await expect(dialog.locator('.lesson-deck h3')).toContainText('1 / 30');
    await expect(
      dialog.getByRole('heading', { name: /Tiêu chí tự đánh giá Phase/ }),
    ).toBeAttached();
    for (const skill of ['Đọc:', 'Nghe:', 'Viết:', 'Nói:'])
      await expect(dialog.getByText(skill, { exact: true })).toBeAttached();
    await expect(dialog.getByRole('button', { name: /^Nghe:/ }).last()).toBeAttached();
    const transcript = dialog.locator('details').filter({ hasText: 'Mở đoạn văn' });
    await expect(transcript).not.toHaveAttribute('open', '');
    await transcript.locator('summary').click();
    await expect(transcript).toHaveAttribute('open', '');
    await dialog.getByRole('button', { name: 'Đóng' }).click();
  }
});

test('all consolidated lessons and checkpoints open with a quiz on mobile', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByText('Phase 2 — Talk About Life', { exact: true }).click();
  const modules = page.locator('.foundation-module');
  await expect(modules).toHaveCount(10);
  let opened = 0;
  for (let module = 0; module < 10; module++) {
    const cards = modules.nth(module).locator('.foundation-lesson');
    const count = module === 1 || module === 7 ? 4 : 3;
    await expect(cards).toHaveCount(count);
    for (let index = 0; index < count; index++) {
      await cards.nth(index).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
      ).toBeVisible();
      await dialog.getByRole('button', { name: 'Đóng' }).click();
      opened++;
    }
  }
  expect(opened).toBe(32);
});

test('phase blocks start collapsed and open independently with keyboard and mouse', async ({
  page,
}) => {
  await page.goto('/foundation/');
  const first = page.locator('.foundation-phase').nth(0);
  const second = page.locator('.foundation-phase').nth(1);
  const firstToggle = first.locator('summary');
  const secondToggle = second.locator('summary');
  await expect(first).not.toHaveAttribute('open', '');
  await expect(second).not.toHaveAttribute('open', '');
  await expect(first.locator('.foundation-lesson').first()).toBeHidden();
  await firstToggle.focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
  await expect(first.locator('.foundation-lesson').first()).toBeVisible();
  await secondToggle.click();
  await expect(second).toHaveAttribute('open', '');
  await expect(first).toHaveAttribute('open', '');
  await firstToggle.click();
  await expect(first).not.toHaveAttribute('open', '');
  await expect(second.locator('.foundation-lesson').first()).toBeVisible();
});

test('Lesson 1 presents practice after each concept and a separate final review', async ({
  page,
}) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ' });
  const decks = dialog.locator('.lesson-deck');
  await expect(decks).toHaveCount(4);
  for (const [index, size] of [5, 5, 5, 8].entries())
    await expect(decks.nth(index).locator('h3')).toContainText(`1 / ${size}`);
  await decks.nth(0).locator('.lesson-option').filter({ hasText: 'My teacher smiles.' }).click();
  await expect(decks.nth(0).locator('input:checked')).toHaveCount(1);
  await expect(decks.nth(1).locator('input:checked')).toHaveCount(0);
  await decks.nth(3).locator('h3').click();
  await page.keyboard.press('d');
  await expect(decks.nth(3).locator('h3')).toContainText('2 / 8');
  await expect(decks.nth(0).locator('h3')).toContainText('1 / 5');
});
