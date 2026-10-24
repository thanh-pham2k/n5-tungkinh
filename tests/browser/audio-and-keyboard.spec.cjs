const { test, expect } = require('./fixtures.cjs');
function wav() {
  const buffer = Buffer.alloc(8044);
  buffer.write('RIFF');
  buffer.writeUInt32LE(8036, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(8000, 40);
  return buffer;
}
async function navigate(page, name) {
  const exit = page.getByRole('button', { name: '× Thoát Focus', exact: true });
  if (await exit.isVisible()) await exit.click();
  await page.getByRole('button', { name: 'Đổi công cụ học' }).click();
  await page.getByRole('dialog').getByRole('button', { name, exact: false }).click();
}
test('speech playback sequences real browser media, applies volume/rate and Stop aborts loop', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.played = [];
    const native = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.played.push({ rate: this.playbackRate, volume: this.volume });
      return native.call(this);
    };
  });
  await page.route('https://api.soundoftext.com/sounds', (route) =>
    route.fulfill({ json: { id: 'fixture' } }),
  );
  await page.route('https://api.soundoftext.com/sounds/fixture', (route) =>
    route.fulfill({
      json: { status: 'Done', location: `data:audio/wav;base64,${wav().toString('base64')}` },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '＋ Nhập CSV', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Nội dung CSV' })
    .fill('vocabulary,hiragana,meaning_vi,example_ja,example_vi\nHello,,Xin chào,Hello.,Xin chào.');
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Cài đặt audio' }).click();
  await page.getByLabel('Tốc độ phát (×)').fill('1.5');
  await page.getByLabel('Âm lượng').fill('50');
  await page.getByRole('button', { name: 'Xong ✓' }).click();
  await page.getByRole('button', { name: '▶ Phát tất cả', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.played.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.played[0])).toEqual({ rate: 1.5, volume: 0.5 });
  await page.getByRole('button', { name: '■ Dừng', exact: true }).click();
  await expect(page.getByRole('button', { name: '■ Dừng', exact: true })).toBeDisabled();
});
test('focused typing stays usable with reduced mobile viewport and Escape exits Focus', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Typing Review');
  await page.getByRole('button', { name: '＋ Nhập CSV', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Nội dung CSV' })
    .fill(
      'vocabulary,hiragana,meaning_vi,example_ja,example_vi,word_order\nHello,,Xin chào,Hello world.,Xin chào thế giới.,Hello|world',
    );
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Câu trả lời của bạn' });
  await input.fill('Hello world.');
  await page.setViewportSize({ width: 390, height: 420 });
  await input.scrollIntoViewIfNeeded();
  await input.focus();
  expect(
    await page.locator('.study-actions:visible').evaluate((e) => getComputedStyle(e).position),
  ).toBe('static');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await input.press('Enter');
  await expect(
    page.getByText('✓ Chính xác! Bạn đã hoàn thành câu.', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '⛶ Focus', exact: true })).toBeVisible();
});
