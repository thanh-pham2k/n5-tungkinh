const { test, expect } = require('./fixtures.cjs');
const { createClient } = require('@libsql/client');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

test('thanhpv sees Visual Samples tab from DB config, previews all 6 DSL types, interacts and filters', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.locator('.app-shell')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Đổi công cụ học' });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog')
      .getByRole('link', { name: /Visual Samples/ })
      .click();
  } else {
    await page
      .locator('.sidebar')
      .getByRole('link', { name: /Visual Samples/ })
      .click();
  }

  await expect(page).toHaveURL(/\/visual-samples/);
  await expect(page.getByRole('heading', { name: /Visual Samples/ })).toBeVisible();

  await expect(page.locator('.visual-grid-block').first()).toBeVisible();
  await expect(page.locator('.visual-flow-block').first()).toBeVisible();
  await expect(page.locator('.visual-compare-block').first()).toBeVisible();
  await expect(page.locator('.visual-metrics-block').first()).toBeVisible();
  await expect(page.locator('.visual-timeline-block').first()).toBeVisible();
  await expect(page.locator('.visual-sim-block').first()).toBeVisible();
  await expect(page.locator('.visual-callout-block').first()).toBeVisible();
  await expect(page.locator('.visual-checklist-block').first()).toBeVisible();
  await expect(page.locator('.visual-tabs-block').first()).toBeVisible();
  await expect(page.locator('.visual-decision-block').first()).toBeVisible();

  const checklist = page.locator('.visual-checklist-block').first();
  await expect(checklist.getByRole('status')).toContainText('1/4 đã hoàn thành');
  await checklist.getByRole('checkbox').nth(1).check();
  await expect(checklist.getByRole('status')).toContainText('2/4 đã hoàn thành');

  const tabsBlock = page.locator('.visual-tabs-block').first();
  await tabsBlock.getByRole('tab', { name: 'Xử lý lỗi (DLQ)' }).click();
  await expect(tabsBlock.getByRole('tabpanel')).toContainText('maxReceiveCount');

  const bufferSim = page.getByRole('region', { name: 'Queue Buffer & Worker Scaling Simulator' });
  const bufferStatus = bufferSim.locator('.visual-sim-status');
  await expect(bufferStatus).toContainText('Queue đang tích tụ');
  await bufferSim.getByRole('button', { name: 'Auto-scaled (200 / 40 × 6)' }).click();
  await expect(bufferStatus).toContainText('Hệ thống ổn định');

  await page
    .getByRole('group', { name: 'Lọc loại visual block' })
    .getByRole('button', { name: 'visual-metrics' })
    .click();
  await expect(page.locator('.visual-sample-card')).toHaveCount(1);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole('group', { name: 'Lọc loại visual block' })
    .getByRole('button', { name: 'Tất cả' })
    .click();
  await expect(page.locator('.visual-sample-card')).toHaveCount(11);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('thanhpv sees Base Prompt tab in sidebar/menu, opens /base-prompt/, copies, edits, adds and deletes on Turso', async ({
  page,
  context,
}) => {
  const db = createClient({
    url: pathToFileURL(resolve('.migration-artifacts/browser-test.db')).href,
  });
  const stored = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['visual-samples'],
  });
  const originalJson = String(stored.rows[0].payload_json);
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
    const menu = page.getByRole('button', { name: 'Đổi công cụ học' });
    if (await menu.isVisible()) {
      await menu.click();
      await page
        .getByRole('dialog')
        .getByRole('link', { name: /Base Prompt/ })
        .click();
    } else {
      await page
        .locator('.sidebar')
        .getByRole('link', { name: /Base Prompt/ })
        .click();
    }

    await expect(page).toHaveURL(/\/base-prompt/);
    await expect(page.getByRole('heading', { name: /Base Prompt/ })).toBeVisible();
    await expect(page.locator('.visual-prompt-item')).toHaveCount(1);

    const pre = page.locator('.visual-prompt-pre').first();
    await expect(pre).toBeHidden();

    const trigger = page.locator('.visual-prompt-trigger').first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(pre).toBeVisible();
    await expect(pre).toContainText('Problem-driven Mini Textbook');

    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    const copiedText = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedText).toContain('Problem-driven Mini Textbook');
    expect(copiedText).toContain('visual-grid');

    await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    await page.getByLabel('Tiêu đề', { exact: true }).fill('AWS SAA — Updated Title');
    await page.getByRole('button', { name: 'Cập nhật lên Turso', exact: true }).click();
    await expect(page.locator('.visual-prompt-title').first()).toHaveText(
      'AWS SAA — Updated Title',
    );
    await page.reload();
    await expect(page.locator('.visual-prompt-title').first()).toHaveText(
      'AWS SAA — Updated Title',
    );

    await page.getByRole('button', { name: '＋ Thêm prompt', exact: true }).click();
    await page.getByLabel('Danh mục / Badge', { exact: true }).fill('IELTS');
    await page.getByLabel('Tiêu đề', { exact: true }).fill('IELTS Writing Task 2');
    await page.getByLabel('Mô tả ngắn', { exact: true }).fill('Prompt luyện viết');
    await page.getByLabel('Nội dung prompt', { exact: true }).fill('Viết bài mẫu band 8.0.');
    await page.getByRole('button', { name: 'Lưu lên Turso', exact: true }).click();
    await expect(page.locator('.visual-prompt-item')).toHaveCount(2);
    await page.reload();
    await expect(page.locator('.visual-prompt-item')).toHaveCount(2);

    await page.locator('.visual-prompt-trigger').first().click();
    await page.getByRole('button', { name: 'Xóa', exact: true }).click();
    await page.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
    await expect(page.locator('.visual-prompt-item')).toHaveCount(1);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  } finally {
    await db.execute({
      sql: 'UPDATE study_catalog SET payload_json = ? WHERE id = ?',
      args: [originalJson, 'visual-samples'],
    });
    db.close();
  }
});

test('yentr does not see Visual Samples and is blocked from /visual-samples/', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập').fill('yentr');
  await page.getByLabel('Mật khẩu').fill('1');
  await page.getByRole('button', { name: 'Đăng nhập ↗' }).click();

  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  await expect(page.getByText('Visual Samples')).toHaveCount(0);
  await expect(page.getByText('Base Prompt')).toHaveCount(0);

  await page.goto('/visual-samples/');
  await expect(page.locator('.status-error[role="alert"]')).toContainText(
    'Bạn không có quyền xem mục này.',
  );

  await page.goto('/base-prompt/');
  await expect(page.locator('.status-error[role="alert"]')).toContainText(
    'Bạn không có quyền xem mục này.',
  );

  const putStatus = await page.evaluate(async () => {
    const res = await fetch('/api/v1/study-catalog/visual-samples', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basePrompts: [] }),
    });
    return res.status;
  });
  expect(putStatus).toBe(403);
});

test('disabling visual-samples in DB hides tab and blocks /visual-samples/ even for thanhpv', async ({
  page,
}) => {
  const db = createClient({
    url: pathToFileURL(resolve('.migration-artifacts/browser-test.db')).href,
  });
  const stored = await db.execute({
    sql: 'SELECT payload_json FROM study_catalog WHERE id = ?',
    args: ['visual-samples'],
  });
  const originalJson = String(stored.rows[0].payload_json);
  try {
    const disabled = { ...JSON.parse(originalJson), enabled: false };
    await db.execute({
      sql: 'UPDATE study_catalog SET payload_json = ? WHERE id = ?',
      args: [JSON.stringify(disabled), 'visual-samples'],
    });

    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.getByText('Visual Samples')).toHaveCount(0);
    await expect(page.getByText('Base Prompt')).toHaveCount(0);

    await page.goto('/visual-samples/');
    await expect(page.locator('.status-error[role="alert"]')).toContainText(
      'Bạn không có quyền xem mục này.',
    );

    await page.goto('/base-prompt/');
    await expect(page.locator('.status-error[role="alert"]')).toContainText(
      'Bạn không có quyền xem mục này.',
    );
  } finally {
    await db.execute({
      sql: 'UPDATE study_catalog SET payload_json = ? WHERE id = ?',
      args: [originalJson, 'visual-samples'],
    });
    db.close();
  }
});
