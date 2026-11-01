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
    const button = page.getByRole('button', { name: /Lesson 1.*The Complete Sentence/ });
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'The Complete Sentence' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#lesson-output h1')).toHaveText(
      'Lesson 1 — The Complete Sentence',
    );
    await expect(dialog.locator('.lesson-deck')).toBeVisible();
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
  await page.getByRole('button', { name: /Lesson 1.*The Complete Sentence/ }).click();
  const dialog = page.getByRole('dialog', { name: 'The Complete Sentence' });
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
  await page.getByRole('button', { name: /Lesson 1.*The Complete Sentence/ }).click();
  const dialog = page.getByRole('dialog', { name: 'The Complete Sentence' });
  await dialog.getByRole('button', { name: 'Nghe: My brother studies every day.' }).click();
  await expect(dialog.getByRole('alert').first()).toContainText('503');
  expect(requestBody).toEqual({
    engine: 'Google',
    data: { text: 'My brother studies every day.', voice: 'en-US' },
  });
});

test('Module 1 lists all lessons and opens the checkpoint', async ({ page }) => {
  await page.goto('/foundation/');
  const cards = page.locator('.foundation-lesson');
  await expect(cards).toHaveCount(6);
  await expect(cards.nth(1)).toContainText('Lesson 2');
  await cards.nth(1).click();
  let dialog = page.getByRole('dialog', { name: 'Subject + Verb', exact: true });
  await expect(dialog.locator('.lesson-deck')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Nghe: She works every day/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await cards.nth(5).click();
  dialog = page.getByRole('dialog', { name: 'Basic Sentence Structure', exact: true });
  await expect(dialog.locator('.lesson-deck')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Nghe: I am a student/ })).toBeVisible();
});
