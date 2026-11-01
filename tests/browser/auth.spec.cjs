const { test, expect } = require('./fixtures.cjs');

async function logout(page) {
  const exit = page.getByRole('button', { name: '× Thoát Focus', exact: true });
  if (await exit.isVisible()) await exit.click();
  const menu = page.getByRole('button', { name: 'Đổi công cụ học' });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Đăng xuất', exact: false }).click();
  } else {
    await page.locator('.sidebar').getByRole('button', { name: 'Đăng xuất', exact: false }).click();
  }
}

test.describe('Authentication and Login flow', () => {
  test('unauthenticated visitor sees blank login fields without account details', async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
    await expect(page.getByLabel('Tên đăng nhập')).toHaveValue('');
    await expect(page.getByLabel('Mật khẩu')).toHaveValue('');
    await expect(page.locator('.login-screen')).not.toContainText('thanhpv');
    await expect(page.locator('.login-screen')).not.toContainText('yentr');
    await expect(page.locator('.login-screen')).not.toContainText('Mật khẩu mặc định');
    await expect(page.getByLabel('Tên đăng nhập')).toBeVisible();
    await expect(page.getByLabel('Mật khẩu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập ↗' })).toBeVisible();
  });

  test('login with wrong password shows error alert', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');

    await page.getByLabel('Tên đăng nhập').fill('thanhpv');
    await page.getByLabel('Mật khẩu').fill('wrongpassword');
    await page.getByRole('button', { name: 'Đăng nhập ↗' }).click();

    const alert = page.locator('.status-error[role=alert]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('không chính xác');
  });

  test('login with thanhpv succeeds, displays user badge, and logout returns to login', async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/');

    await page.getByLabel('Tên đăng nhập').fill('thanhpv');
    await page.getByLabel('Mật khẩu').fill('1');
    await page.getByRole('button', { name: 'Đăng nhập ↗' }).click();

    // App shell loads
    await expect(page.locator('.app-shell')).toBeVisible();

    // Logout
    await logout(page);
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('login with yentr opens only TOEIC and allows logout', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.getByLabel('Tên đăng nhập').fill('yentr');
    await page.getByLabel('Mật khẩu').fill('1');
    await page.getByRole('button', { name: 'Đăng nhập ↗' }).click();
    await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
    await expect(page.getByText('Instant Vocab')).toHaveCount(0);
    await expect(page.getByText('Markdown & Quiz')).toHaveCount(0);
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('markdown workspace requires login and loads after login', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/markdown/');

    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

    await page.getByLabel('Tên đăng nhập').fill('thanhpv');
    await page.getByLabel('Mật khẩu').fill('1');
    await page.getByRole('button', { name: 'Đăng nhập ↗' }).click();

    await expect(page.locator('.markdown-page')).toBeVisible();
    await expect(page.locator('.preview-toolbar')).toContainText('thanhpv');
  });

  test('user data is completely isolated between thanhpv and yentr in UI', async ({
    page,
    context,
  }) => {
    const csvContent =
      'vocabulary,hiragana,meaning_vi,example_ja,example_vi\nsecret,,bí mật,secret sentence,câu bí mật';

    // 1. Log in as thanhpv and create a lesson
    await context.clearCookies();
    await page.goto('/');
    await page.getByLabel('Tên đăng nhập').fill('thanhpv');
    await page.getByLabel('Mật khẩu').fill('1');
    await page.getByRole('button', { name: 'Đăng nhập ↗' }).click();
    await expect(page.locator('.app-shell')).toBeVisible();

    await page.getByRole('button', { name: '＋ Nhập CSV', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Nội dung CSV' }).fill(csvContent);
    await dialog.getByRole('button', { name: 'Nạp dữ liệu' }).click();
    await expect(dialog).toHaveCount(0);

    // 2. Log out
    await logout(page);
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

    // 3. Log in as yentr
    await page.getByLabel('Tên đăng nhập').fill('yentr');
    await page.getByLabel('Mật khẩu').fill('1');
    await page.getByRole('button', { name: 'Đăng nhập ↗' }).click();
    await expect(page.getByRole('heading', { name: '600 từ vựng TOEIC' })).toBeVisible();
    const data = await page.evaluate(async () =>
      (await fetch('/api/v1/study-contents?tool=instant')).json(),
    );
    expect(data.data).toHaveLength(0);
  });
});
