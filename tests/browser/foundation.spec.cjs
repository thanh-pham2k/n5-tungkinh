const { test, expect } = require('./fixtures.cjs');

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`Foundation opens interactive lesson in the page at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/foundation/');
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    await page.locator('.foundation-module').first().locator('summary').click();
    const button = page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ });
    await button.click();
    const dialog = page.locator('.course-reading');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#lesson-output h1')).toHaveText(
      'Lesson 1 — Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ',
    );
    await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
    await dialog.locator('.lesson-option').filter({ hasText: 'My teacher smiles.' }).click();
    await expect(dialog.locator('.lesson-option.is-correct')).toBeVisible();
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(button).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('completed lessons move behind older reviews and persist across reload', async ({ page }) => {
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
    await page.locator('.foundation-module').first().locator('summary').click();
    const cards = page.locator('.foundation-lesson');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Lesson 1');
    await cards.nth(0).click();
    const dialog = page.locator('.course-reading');
    await dialog.locator('.lesson-option').filter({ hasText: 'Yes' }).click();
    await dialog.getByRole('button', { name: 'Xem kết quả' }).click();
    await expect(cards.nth(0).locator('[aria-label="Chưa hoàn thành"]')).toBeAttached();
    await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
    ).toBeDisabled();
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
    await expect(cards.nth(0)).toContainText('Lesson 2');
    await expect(cards.nth(1)).toContainText('Lesson 1');
    await expect(
      page.locator('.foundation-phase').first().locator(':scope > summary'),
    ).toContainText('Bài gần nhất');
    await expect(page.locator('.foundation-module').first().locator('summary')).toContainText(
      'Bài gần nhất',
    );
    await expect(cards.nth(1)).toHaveClass(/is-latest/);
    await page.reload();
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    await page.locator('.foundation-module').first().locator('summary').click();
    await expect(cards.nth(0)).toContainText('Lesson 2');
    await expect(cards.nth(1).getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
    await expect(cards.nth(1)).toHaveClass(/is-latest/);
    await cards.nth(0).click();
    const second = page.locator('.course-reading');
    await second.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
    await expect(
      second.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
    ).toBeDisabled();
    await second.getByRole('button', { name: '← Danh sách bài học' }).click();
    await expect(cards.nth(0)).toContainText('Lesson 1');
    await expect(cards.nth(1)).toContainText('Lesson 2');
    const previousTime = await cards.nth(0).locator('time').getAttribute('datetime');
    await cards.nth(0).click();
    await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
    await page
      .locator('.course-reading')
      .getByRole('button', { name: '← Danh sách bài học' })
      .click();
    await expect(cards.nth(1)).toContainText('Lesson 1');
    const updatedTime = await cards.nth(1).locator('time').getAttribute('datetime');
    expect(Date.parse(updatedTime)).toBeGreaterThan(Date.parse(previousTime));
    await page.reload();
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    await page.locator('.foundation-module').first().locator('summary').click();
    await expect(cards.nth(1).locator('time')).toHaveAttribute('datetime', updatedTime);
    await expect(cards.nth(1)).toContainText('Đã làm 2 lần');
    await expect(cards.nth(0)).toContainText('Đã làm 1 lần');
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
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.locator('.course-reading');
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
  await expect(button).toBeDisabled();
  await expect(
    page.locator('.foundation-lesson').first().locator('[aria-label="Chưa hoàn thành"]'),
  ).toBeAttached();
});

test('Apply audio requests Sound of Text and reports service errors', async ({ page }) => {
  let requestBody;
  await page.route('https://api.soundoftext.com/sounds', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.locator('.course-reading');
  const expectedText =
    'My name is Anna. I work at home. My brother studies English every evening. My mother likes music. We watch movies together on weekends.';
  await dialog.getByRole('button', { name: `Nghe: ${expectedText}` }).click();
  await expect(dialog.getByRole('alert').first()).toContainText('503');
  expect(requestBody).toEqual({
    engine: 'Google',
    data: { text: expectedText, voice: 'en-US' },
  });
});

test('Module 1 lists all lessons and opens the checkpoint', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  const cards = page.locator('.foundation-lesson');
  await expect(cards).toHaveCount(32);
  await expect(cards.nth(1)).toContainText('Lesson 2');
  await cards.nth(1).click();
  let dialog = page.locator('.course-reading');
  await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Nghe: Hi, I am Anna/ })).toBeVisible();
  await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
  await cards.nth(2).click();
  dialog = page.locator('.course-reading');
  await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Nghe: Hi, I am David/ })).toBeVisible();
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
  await page.locator('.foundation-module').first().locator('summary').click();
  const card = page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ });
  await card.click();
  let dialog = page.locator('.course-reading');
  let deck = dialog.locator('.lesson-deck').first();
  await deck.locator('.lesson-option').filter({ hasText: 'My teacher smiles.' }).click();
  await expect(deck.locator('input:checked')).toHaveCount(1);
  await expect.poll(() => writes.length).toBe(0);
  await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
  ).toBeDisabled();
  expect(writes.length).toBeGreaterThan(0);
  for (const write of writes) expect(write.progress).not.toHaveProperty('markdownAnswers');
  await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
  await card.click();
  dialog = page.locator('.course-reading');
  deck = dialog.locator('.lesson-deck').first();
  await expect(deck.locator('.lesson-option')).toHaveCount(4);
  await expect(deck.locator('input:checked')).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await card.click();
  await expect(page.locator('.lesson-deck').first().locator('.lesson-option')).toHaveCount(4);
  await expect(page.locator('.lesson-deck').first().locator('input:checked')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
  ).toBeEnabled();
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
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const deck = page.locator('.lesson-deck').first();
  await expect(deck.locator('.lesson-option')).toHaveCount(4);
  await expect(deck.locator('input:checked')).toHaveCount(0);
  await expect(deck.locator('.lesson-feedback')).toBeHidden();
});

test('real Foundation lesson completion displays its time and moves last', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  const cards = page.locator('.foundation-lesson');
  await expect(cards).toHaveCount(32);
  await expect(cards.first()).toContainText('Lesson 1');
  await cards.first().click();
  const dialog = page.locator('.course-reading');
  await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
  await expect(cards.nth(2)).toContainText('Lesson 1');
  await expect(cards.nth(2).locator('time')).toHaveText('Vừa ôn xong');
  await expect(cards.nth(2).locator('time')).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}T/);
  await page.reload();
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await expect(cards).toHaveCount(32);
  await expect(cards.nth(2)).toContainText('Lesson 1');
  await expect(cards.nth(2).locator('time')).toHaveText('Vừa ôn xong');
  await expect(cards.nth(2)).toContainText('Đã làm 1 lần');
});

test('A/D works after checking a Word Order answer in Foundation', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const deck = page.locator('.course-reading').locator('.lesson-deck').last();
  await deck.getByRole('button', { name: 'Câu 9', exact: true }).click();
  const field = deck.locator('fieldset');
  for (const word of ['My friend', 'reads', 'books', 'every evening'])
    await field.getByRole('button', { name: word, exact: true }).click();
  await field.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(deck).toContainText('Chính xác!');
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('10 / 14');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('9 / 14');
});

test('A/D works after checking a typing answer with Enter or button', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const deck = page.locator('.course-reading').locator('.lesson-deck').last();
  await deck.getByRole('button', { name: 'Câu 12', exact: true }).click();
  const input = deck.getByRole('textbox', { name: 'Câu trả lời' });
  await input.fill('My sister likes music.');
  await input.press('Enter');
  await expect(deck).toContainText('Chính xác!');
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('13 / 14');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('12 / 14');
  await input.fill('I work every day.');
  await expect(input).toHaveValue('I work every day.');
  await expect(deck.locator('h3')).toContainText('12 / 14');
  await deck.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('13 / 14');
});

test('clicking quiz background activates A/D without disturbing typing focus', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 2.*Câu với be/ }).click();
  const dialog = page.locator('.course-reading');
  const deck = dialog.locator('.lesson-deck').last();
  await deck.getByRole('button', { name: 'Câu 5', exact: true }).click();
  await dialog
    .getByRole('heading', { name: 'Câu với be: danh từ và tính từ', exact: true })
    .click();
  await deck.locator('h3').click();
  await expect(deck.locator('h3')).toBeFocused();
  await page.keyboard.press('d');
  await expect(deck.locator('h3')).toContainText('6 / 16');
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('5 / 16');
  await deck.getByRole('button', { name: 'Câu 14', exact: true }).click();
  const input = deck.getByRole('textbox', { name: 'Câu trả lời' });
  await input.click();
  await input.pressSequentially('I am busy.');
  await expect(input).toHaveValue('I am busy.');
  await expect(deck.locator('h3')).toContainText('14 / 16');
});

test('last typing answer returns focus to quiz after Enter and A navigates back', async ({
  page,
}) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 2.*Câu với be/ }).click();
  const dialog = page.locator('.course-reading');
  const deck = dialog.locator('.lesson-deck').last();
  await deck.getByRole('button', { name: 'Câu 16', exact: true }).click();
  const input = deck.getByRole('textbox', { name: 'Câu trả lời' });
  await input.fill('We are tired.');
  await input.press('Enter');
  await expect(deck).toContainText('Chính xác!');
  await expect(deck.locator('h3')).toBeFocused();
  await page.keyboard.press('a');
  await expect(deck.locator('h3')).toContainText('15 / 16');
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
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.locator('.course-reading');
  await dialog.getByRole('button', { name: /^Nghe: My name is Anna/ }).click();
  await expect(dialog.getByText('Đang tạo audio…')).toHaveCount(0);
  await expect(dialog.getByText('♫ Đang phát')).toHaveCount(0);
  release();
  await expect(dialog.getByRole('alert').first()).toContainText('503');
});

test('Module 2 lessons open and completion stays within its module', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  const sections = page.locator('.foundation-module');
  await expect(sections).toHaveCount(24);
  const first = sections.nth(0).locator('.foundation-lesson');
  const second = sections.nth(1).locator('.foundation-lesson');
  await sections.nth(1).locator('summary').click();
  await expect(second).toHaveCount(4);
  await second.first().click();
  const dialog = page.locator('.course-reading');
  await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Nghe: My family lives/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
  await expect(second.last()).toContainText('Lesson 1');
  await expect(first.first()).toContainText('Lesson 1');
  await page.reload();
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await sections.nth(1).locator('summary').click();
  await expect(second.last()).toContainText('Lesson 1');
  await expect(second.last().getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
});

test('Phase 1 and Phase 2 show all ten modules and open lessons', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByText('Phase 2 — Talk About Life', { exact: true }).click();
  const modules = page.locator('.foundation-module');
  await expect(modules).toHaveCount(24);
  await expect(modules.nth(2)).toContainText('Be');
  await expect(modules.nth(3)).toContainText('Present Simple');
  await expect(modules.nth(4)).toContainText('Questions');
  await expect(modules.nth(9)).toContainText('Modal Basics');
  for (const index of [2, 3, 4, 9]) {
    await modules.nth(index).locator('summary').click();
    await modules.nth(index).locator('.foundation-lesson').first().click();
    const dialog = page.locator('.course-reading');
    await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
  }
});

test('phase checkpoints include integrated reading listening speaking and writing self-assessment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByText('Phase 2 — Talk About Life', { exact: true }).click();
  for (const [moduleName, checkpointName] of [
    ['Present Simple', 'Present Simple'],
    ['Modal Basics', 'Modal Basics'],
  ]) {
    const section = page
      .locator('.foundation-module')
      .filter({ has: page.getByText(moduleName, { exact: true }) });
    await section.locator('summary').click();
    await section
      .getByRole('button', { name: new RegExp(`Mini Checkpoint.*${checkpointName}`) })
      .click();
    const dialog = page.locator('.course-reading');
    await expect(dialog.locator('.lesson-deck h3').first()).toContainText('1 / 15');
    await expect(
      dialog.getByRole('heading', { name: /Tiêu chí tự đánh giá Phase/ }).first(),
    ).toBeAttached();
    for (const skill of ['Đọc:', 'Nghe:', 'Viết:', 'Nói:'])
      await expect(dialog.getByText(skill, { exact: true })).toBeAttached();
    await expect(dialog.getByRole('button', { name: /^Nghe:/ }).last()).toBeAttached();
    const transcript = dialog.locator('details').filter({ hasText: 'Mở đoạn văn' });
    await expect(transcript).not.toHaveAttribute('open', '');
    await transcript.locator('summary').click();
    await expect(transcript).toHaveAttribute('open', '');
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
  }
});

test('all consolidated lessons and checkpoints open with a quiz on mobile', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByText('Phase 2 — Talk About Life', { exact: true }).click();
  const modules = page.locator('.foundation-module');
  await expect(modules).toHaveCount(24);
  let opened = 0;
  for (let module = 0; module < 10; module++) {
    if (module !== 0) await modules.nth(module).locator('summary').click();
    const cards = modules.nth(module).locator('.foundation-lesson');
    const count = module === 1 || module === 7 ? 4 : 3;
    await expect(cards).toHaveCount(count);
    for (let index = 0; index < count; index++) {
      await cards.nth(index).click();
      const dialog = page.locator('.course-reading');
      await expect(dialog.locator('.lesson-deck').first()).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }),
      ).toBeVisible();
      await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
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
  const firstToggle = first.locator(':scope > summary');
  const secondToggle = second.locator(':scope > summary');
  await expect(first).not.toHaveAttribute('open', '');
  await expect(second).not.toHaveAttribute('open', '');
  await expect(first.locator('.foundation-lesson').first()).toBeHidden();
  await firstToggle.focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('open', '');
  await expect(first.locator('.foundation-lesson').first()).toBeHidden();
  await first.locator('.foundation-module').first().locator('summary').click();
  await expect(first.locator('.foundation-lesson').first()).toBeVisible();
  await secondToggle.click();
  await expect(second).toHaveAttribute('open', '');
  await expect(first).toHaveAttribute('open', '');
  await firstToggle.click();
  await expect(first).not.toHaveAttribute('open', '');
  await expect(second.locator('.foundation-lesson').first()).toBeHidden();
  await second.locator('.foundation-module').first().locator('summary').click();
  await expect(second.locator('.foundation-lesson').first()).toBeVisible();
});

test('Lesson 1 presents practice after each concept and a separate final review', async ({
  page,
}) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.locator('.course-reading');
  const decks = dialog.locator('.lesson-deck');
  await expect(decks).toHaveCount(6);
  for (const [index, size] of [9, 9, 11, 8, 5, 14].entries())
    await expect(decks.nth(index).locator('h3')).toContainText(`1 / ${size}`);
  await decks.nth(0).locator('.lesson-option').filter({ hasText: 'My teacher smiles.' }).click();
  await expect(decks.nth(0).locator('input:checked')).toHaveCount(1);
  await expect(decks.nth(1).locator('input:checked')).toHaveCount(0);
  await decks.nth(3).locator('h3').click();
  await page.keyboard.press('d');
  await expect(decks.nth(3).locator('h3')).toContainText('2 / 8');
  await expect(decks.nth(0).locator('h3')).toContainText('1 / 9');
});

test('expanded quiz closes back to the lesson without losing the answer', async ({ page }) => {
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const lesson = page.locator('.course-reading');
  const deck = lesson.locator('.lesson-deck').first();
  await deck.getByRole('button', { name: 'Mở rộng luyện tập' }).click();
  const expanded = page.getByRole('dialog', { name: 'Luyện tập Mini Quiz 1' });
  await expanded.locator('.lesson-option input').first().check();
  await page.keyboard.press('Escape');
  await expect(expanded).toHaveCount(0);
  await expect(lesson).toBeVisible();
  await expect(deck.locator('input:checked')).toHaveCount(1);
});

for (const width of [390, 1280]) {
  test(`selected lesson text can be spoken at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    let requestBody;
    await page.route('https://api.soundoftext.com/sounds', async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({ status: 503, body: 'Unavailable' });
    });
    await page.goto('/foundation/');
    await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
    await page.locator('.foundation-module').first().locator('summary').click();
    await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
    const dialog = page.locator('.course-reading');
    const text = dialog.locator('#lesson-output h1');
    await text.scrollIntoViewIfNeeded();
    await text.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    const button = dialog.getByRole('button', { name: 'Nghe đoạn đã chọn' });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await button.click();
    await expect(dialog.getByRole('alert').first()).toContainText('503');
    expect(requestBody.data.text).toBe('Lesson 1 — Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ');
    expect(requestBody.data.voice).toBe('en-US');
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await expect(button).toHaveCount(0);
    const replay = dialog.getByRole('button', { name: /Nghe lại: Lesson 1/ });
    await expect(replay).toBeVisible();
    requestBody = null;
    await replay.click();
    await expect
      .poll(() => requestBody?.data.text)
      .toBe('Lesson 1 — Câu hoàn chỉnh: chủ ngữ, động từ và tân ngữ');
    await dialog.getByRole('button', { name: '← Danh sách bài học' }).click();
    await expect(replay).toHaveCount(0);
  });
}

test('selected audio can loop and stop using cached speech', async ({ page }) => {
  let requests = 0;
  await page.addInitScript(() => {
    window.audioPlays = 0;
    window.playedUrls = [];
    HTMLMediaElement.prototype.play = function () {
      window.audioPlays++;
      window.playedUrls.push(this.src);
      setTimeout(() => this.dispatchEvent(new Event('ended')), 30);
      return Promise.resolve();
    };
  });
  await page.route('https://api.soundoftext.com/sounds', (route) => {
    requests++;
    return route.fulfill({ json: { id: `loop-fixture-${requests}` } });
  });
  await page.route(/https:\/\/api\.soundoftext\.com\/sounds\/loop-fixture-\d+$/, (route) => {
    const id = route.request().url().split('/').pop();
    return route.fulfill({ json: { status: 'Done', location: `https://example.com/${id}.mp3` } });
  });
  await page.goto('/foundation/');
  await page.getByText('Phase 1 — Build Sentences', { exact: true }).click();
  await page.locator('.foundation-module').first().locator('summary').click();
  await page.getByRole('button', { name: /Lesson 1.*Câu hoàn chỉnh/ }).click();
  const dialog = page.locator('.course-reading');
  await dialog.locator('#lesson-output h1').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await dialog.getByRole('button', { name: 'Nghe đoạn đã chọn' }).click();
  const list = dialog.getByRole('region', { name: 'Instant Vocab trong bài' });
  await expect(list.locator('li')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.audioPlays)).toBeGreaterThan(0);
  const loop = list.getByRole('button', { name: '▶ Phát lặp' });
  await expect(loop).toBeEnabled();
  const second = dialog.locator('#lesson-output h2').first();
  await second.scrollIntoViewIfNeeded();
  await second.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await dialog.getByRole('button', { name: 'Nghe đoạn đã chọn' }).click();
  await expect(list.locator('li')).toHaveCount(2);
  await expect(loop).toBeEnabled();
  await page.evaluate(() => {
    window.playedUrls = [];
  });
  await loop.click();
  await expect.poll(() => page.evaluate(() => window.playedUrls.length)).toBeGreaterThanOrEqual(7);
  await list.getByRole('button', { name: '■ Dừng' }).click();
  await expect(loop).toBeEnabled();
  const played = await page.evaluate(() => window.playedUrls.slice(0, 7));
  expect(played).toEqual([
    ...Array(3).fill('https://example.com/loop-fixture-1.mp3'),
    ...Array(3).fill('https://example.com/loop-fixture-2.mp3'),
    'https://example.com/loop-fixture-1.mp3',
  ]);
  const stoppedAt = await page.evaluate(() => window.audioPlays);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.audioPlays)).toBe(stoppedAt);
  expect(requests).toBe(2);
});
