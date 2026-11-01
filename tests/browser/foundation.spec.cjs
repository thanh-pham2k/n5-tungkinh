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
    await expect(cards.nth(1)).toContainText('Đã hoàn thành');
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await expect(cards.nth(0)).toContainText('Lesson 2');
    await expect(cards.nth(1)).toContainText('Lesson 1');
    await page.reload();
    await expect(cards.nth(0)).toContainText('Lesson 2');
    await expect(cards.nth(1)).toContainText('Đã hoàn thành');
    await cards.nth(0).click();
    const second = page.getByRole('dialog', { name: 'Test 2' });
    await second.locator('.lesson-option').filter({ hasText: 'Yes' }).click();
    await second.getByRole('button', { name: 'Xem kết quả' }).click();
    await expect(cards.nth(1)).toContainText('Đã hoàn thành');
    await second.getByRole('button', { name: 'Đóng' }).click();
    await expect(cards.nth(0)).toContainText('Lesson 1');
    await expect(cards.nth(1)).toContainText('Lesson 2');
  } finally {
    await db.execute({
      sql: 'UPDATE study_catalog SET payload_json = ? WHERE id = ?',
      args: [original.rows[0].payload_json, 'english-foundation'],
    });
    db.close();
  }
});
