const { test, expect, makeAuthToken } = require('./fixtures.cjs');

test('TOEIC is limited to yentr and completion persists', async ({ page, context }) => {
  await page.goto('/toeic-600/');
  await expect(page.getByText('Bạn không có quyền xem mục này.')).toBeVisible();
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'kotoba-auth-token',
      value: makeAuthToken('yentr'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/v1/study-contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'markdown',
        language: 'en',
        source: '# Contracts — Hợp đồng\n\nLesson.',
        requestId: crypto.randomUUID(),
      }),
    });
    return result.status;
  });
  expect(response).toBe(201);
  await page.goto('/toeic-600/');
  await page.getByRole('button', { name: /Nhóm 1\s+Contracts/ }).click();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Đã hoàn thành' })).toBeVisible();
});

test('yentr home shows only TOEIC on desktop', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'kotoba-auth-token',
      value: makeAuthToken('yentr'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  await expect(page.getByText('Instant Vocab')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
});

test('Contracts vocabulary buttons request English audio for each word', async ({
  page,
  context,
}) => {
  const { readFileSync } = require('node:fs');
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'kotoba-auth-token',
      value: makeAuthToken('yentr'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  const requests = [];
  await page.route('https://api.soundoftext.com/sounds', (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  const source = readFileSync('docs/toeic-600/01.md', 'utf8');
  const status = await page.evaluate(async (source) => {
    const response = await fetch('/api/v1/study-contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'markdown',
        language: 'en',
        source,
        requestId: crypto.randomUUID(),
      }),
    });
    return response.status;
  }, source);
  expect(status).toBe(201);
  await page.reload();
  await page.getByRole('button', { name: /Nhóm 1\s+Contracts/ }).click();
  const dialog = page.locator('.course-reading');
  await expect(dialog.locator('.vocabulary-audio-button')).toHaveCount(12);
  await dialog.getByRole('button', { name: 'Nghe: abide by' }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toEqual({ engine: 'Google', data: { text: 'abide by', voice: 'en-US' } });
  await expect(dialog.getByText(/Dịch vụ audio không phản hồi/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Nghe: specific' }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].data.text).toBe('specific');
});

test('TOEIC lists new lessons and moves completed lessons to the end', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'kotoba-auth-token',
      value: makeAuthToken('yentr'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  for (const name of ['01', '02']) {
    const source = require('node:fs').readFileSync(`docs/toeic-600/${name}.md`, 'utf8');
    const status = await page.evaluate(
      async (source) =>
        (
          await fetch('/api/v1/study-contents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool: 'markdown',
              language: 'en',
              source,
              requestId: crypto.randomUUID(),
            }),
          })
        ).status,
      source,
    );
    expect(status).toBe(201);
  }
  await page.reload();
  const lessons = page.locator('.foundation-lesson');
  await expect(lessons).toHaveCount(50);
  await expect(page.locator('details.foundation-phase')).toHaveCount(10);
  await expect(lessons.nth(2)).toBeDisabled();
  await expect(lessons.nth(0)).toContainText('Nhóm 1');
  await lessons.nth(0).click();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  await page
    .locator('.course-reading')
    .getByRole('button', { name: '← Danh sách bài học' })
    .click();
  await expect(lessons.nth(0)).toContainText('Nhóm 2');
  await page.reload();
  await expect(lessons.nth(0)).toContainText('Nhóm 2');
});

test('new Turso content activates the matching lesson and rotates only within its part', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'kotoba-auth-token',
      value: makeAuthToken('yentr'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
  await page.getByText('Part 3 · Nhóm 11–15').click();
  const part2 = page.locator('details.foundation-phase').nth(2);
  await expect(part2.getByRole('button', { name: /Nhóm 11/ })).toBeDisabled();
  for (const name of ['01', '11', '12']) {
    const source = require('node:fs').readFileSync(`docs/toeic-600/${name}.md`, 'utf8');
    const status = await page.evaluate(
      async (source) =>
        (
          await fetch('/api/v1/study-contents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool: 'markdown',
              language: 'en',
              source,
              requestId: crypto.randomUUID(),
            }),
          })
        ).status,
      source,
    );
    expect(status).toBe(201);
  }
  await page.reload();
  await page.getByText('Part 3 · Nhóm 11–15').click();
  const part2Lessons = part2.locator('.foundation-lesson');
  await expect(part2Lessons.nth(0)).toContainText('Nhóm 11');
  await expect(part2Lessons.nth(0)).toBeEnabled();
  await part2Lessons.nth(0).click();
  await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bỏ đánh dấu hoàn thành' })).toBeVisible();
  await page
    .locator('.course-reading')
    .getByRole('button', { name: '← Danh sách bài học' })
    .click();
  await expect(part2Lessons.nth(0)).toContainText('Nhóm 12');
  await expect(
    page.locator('details.foundation-phase').first().locator('.foundation-lesson').first(),
  ).toContainText('Nhóm 1');
});
