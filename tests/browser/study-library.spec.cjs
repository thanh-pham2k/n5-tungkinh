const { test, expect } = require('./fixtures.cjs');
async function navigate(page, name) {
  const exit = page.getByRole('button', { name: '× Thoát Focus', exact: true });
  if (await exit.isVisible()) await exit.click();
  await page.getByRole('button', { name: 'Đổi công cụ học' }).click();
  await page.getByRole('dialog').getByRole('button', { name, exact: false }).click();
}
const vocab =
  'vocabulary,hiragana,meaning_vi,example_ja,example_vi\nshared,,dùng chung,Shared lesson.,Bài dùng chung.';
test('legacy Markdown draft moves to database before local copy is removed', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'markdown-lesson-v1',
      JSON.stringify({ source: '# Legacy lesson\n\nNội dung cũ.' }),
    ),
  );
  await page.goto('/markdown/');
  await expect(page.locator('#lesson-output h1')).toHaveText('Legacy lesson');
  expect(await page.evaluate(() => localStorage.getItem('markdown-lesson-v1'))).toBeNull();
  const { data } = await (await page.request.get('/api/v1/study-contents?tool=markdown')).json();
  expect(data).toHaveLength(1);
});
test('all import tools create DB records and reopen saved content after reload', async ({
  page,
}) => {
  await page.goto('/');
  const cases = [
    ['Instant Vocab', 'instant', '＋ Nhập CSV', 'Nội dung CSV', vocab],
    ['Vocab Review', 'cards', '＋ Nhập CSV', 'Nội dung CSV', vocab],
    [
      'Word Order',
      'order',
      '＋ Nhập CSV',
      'Nội dung CSV',
      vocab.replace('example_vi\n', 'example_vi,word_order\n') + ' ,Shared|lesson',
    ],
    [
      'Typing Review',
      'typing',
      '＋ Nhập CSV',
      'Nội dung CSV',
      vocab.replace('example_vi\n', 'example_vi,word_order\n') + ' ,Shared|lesson',
    ],
    [
      'Writing Review',
      'writing',
      '＋ Nhập đề CSV',
      'Nội dung CSV',
      'context,prompt,input,sample_answer\nWork,Shared writing,Reply,Sample answer',
    ],
    [
      'Multiple Choice',
      'multiple-choice',
      'Nhập dữ liệu',
      'Nội dung Multiple Choice',
      'question|option_1|option_2|option_3|option_4|correct_answer\nShared question?|A|B|C|D|1',
    ],
  ];
  for (const [name, tool, button, label, source] of cases) {
    await navigate(page, name);
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.getByRole('textbox', { name: label, exact: true }).fill(source);
    await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const response = await (await page.request.get(`/api/v1/study-contents?tool=${tool}`)).json();
    expect(response.data).toHaveLength(1);
    expect(response.data[0].studyCount).toBe(1);
    await page.reload();
    await navigate(page, name);
    await page.getByRole('button', { name: '▤ Bài đã lưu', exact: true }).click();
    await page.locator('.saved-lessons-list button').first().click();
    await expect(page.locator('.empty-state:visible')).toHaveCount(0);
  }
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key !== 'app-audio-volume'),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});
test('different visitor can open the shared lesson but cannot see another visitor progress', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.request.get('/api/v1/session');
  const result = await page.request.post('/api/v1/study-contents', {
    headers: { Origin: 'http://127.0.0.1:4173' },
    data: { tool: 'instant', source: vocab, language: 'en', requestId: crypto.randomUUID() },
  });
  expect(result.status()).toBe(201);
  const { data: lesson } = await result.json();
  expect(
    (
      await page.request.put(`/api/v1/study-contents/${lesson.id}/progress`, {
        headers: { Origin: 'http://127.0.0.1:4173' },
        data: { version: 0, progress: { privateAnswer: 'mine' } },
      })
    ).status(),
  ).toBe(200);
  const other = await browser.newContext();
  try {
    await other.request.get('http://127.0.0.1:4173/api/v1/session');
    const shared = await (
      await other.request.get(`http://127.0.0.1:4173/api/v1/study-contents/${lesson.id}`)
    ).json();
    expect(shared.data.source).toBe(vocab);
    expect(shared.data.progress).toEqual({});
    const forbidden = await other.request.post('http://127.0.0.1:4173/api/v1/study-contents', {
      headers: { Origin: 'https://example.com' },
      data: { tool: 'instant', source: vocab, language: 'en', requestId: crypto.randomUUID() },
    });
    expect(forbidden.status()).toBe(403);
  } finally {
    await other.close();
  }
});
test('saved lesson deletion requires confirmation and removes it for every visitor', async ({
  page,
}) => {
  await page.goto('/');
  await page.request.get('/api/v1/session');
  const title = `Bài cần xóa ${crypto.randomUUID()}`;
  const source = vocab.replace('shared', title);
  const result = await page.request.post('/api/v1/study-contents', {
    headers: { Origin: 'http://127.0.0.1:4173' },
    data: { tool: 'instant', source, language: 'en', requestId: crypto.randomUUID() },
  });
  expect(result.status()).toBe(201);
  const { data: lesson } = await result.json();
  await page.getByRole('button', { name: '▤ Bài đã lưu', exact: true }).click();
  const row = page.locator('.saved-lesson').filter({ hasText: title });
  const saved = row.locator('.saved-lesson-actions > button').first();
  await expect(saved).toBeVisible();
  await page.getByRole('button', { name: `Xóa ${title} khỏi thư viện chung` }).click();
  const confirm = page.getByRole('group', { name: `Xác nhận xóa ${title}` });
  await expect(confirm).toContainText('Mọi người sẽ mất bài này và tiến độ liên quan.');
  await confirm.getByRole('button', { name: 'Hủy' }).click();
  await expect(saved).toBeVisible();
  await page.getByRole('button', { name: `Xóa ${title} khỏi thư viện chung` }).click();
  await page
    .getByRole('group', { name: `Xác nhận xóa ${title}` })
    .getByRole('button', { name: 'Xóa vĩnh viễn' })
    .click();
  await expect(row).toHaveCount(0);
  expect((await page.request.get(`/api/v1/study-contents/${lesson.id}`)).status()).toBe(404);
  expect(
    (
      await page.request.delete(`/api/v1/study-contents/${lesson.id}`, {
        headers: { Origin: 'http://127.0.0.1:4173' },
      })
    ).status(),
  ).toBe(404);
});
test('delete rejects missing sessions and cross-origin requests', async ({ page, browser }) => {
  await page.goto('/');
  await page.request.get('/api/v1/session');
  const created = await page.request.post('/api/v1/study-contents', {
    headers: { Origin: 'http://127.0.0.1:4173' },
    data: { tool: 'instant', source: vocab, language: 'en', requestId: crypto.randomUUID() },
  });
  const { data: lesson } = await created.json();
  const noSession = await browser.newContext();
  try {
    await noSession.request.get('http://127.0.0.1:4173/api/v1/session');
    const forbidden = await noSession.request.delete(
      `http://127.0.0.1:4173/api/v1/study-contents/${lesson.id}`,
      { headers: { Origin: 'https://example.com' } },
    );
    expect(forbidden.status()).toBe(403);
  } finally {
    await noSession.close();
  }
  const unauthenticated = await browser.newContext();
  try {
    const denied = await unauthenticated.request.delete(
      `http://127.0.0.1:4173/api/v1/study-contents/${lesson.id}`,
      { headers: { Origin: 'http://127.0.0.1:4173' } },
    );
    expect(denied.status()).toBe(401);
  } finally {
    await unauthenticated.close();
  }
  expect((await page.request.get(`/api/v1/study-contents/${lesson.id}`)).status()).toBe(200);
});
test('failed save keeps import dialog and does not claim success or create a record', async ({
  page,
}) => {
  await page.goto('/');
  await page.route(/\/api\/v1\/study-contents\/?(?:\?|$)/, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          json: {
            error: { code: 'service_unavailable', message: 'DB đang lỗi, chưa lưu.' },
            meta: { requestId: 'test' },
          },
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: '＋ Nhập CSV', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nội dung CSV' }).fill(vocab);
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('chưa lưu');
  expect(
    (await (await page.request.get('/api/v1/study-contents?tool=instant')).json()).data,
  ).toEqual([]);
});
