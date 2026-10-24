import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const directory = 'test-results/preview';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const data = (
  await (await page.request.get('http://127.0.0.1:4173/api/v1/study-catalog/ielts')).json()
).data;
await page.route('https://api.soundoftext.com/**', (route) =>
  route.fulfill({ status: 503, body: 'Audio paused for screenshots' }),
);
await page.goto('http://127.0.0.1:4173');
async function navigate(name) {
  const exit = page.getByRole('button', { name: '× Thoát Focus', exact: true });
  if (await exit.isVisible()) await exit.click();
  const menu = page.getByRole('button', { name: 'Đổi công cụ học' });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('dialog').getByRole('button', { name, exact: false }).click();
  } else await page.locator('.sidebar').getByRole('button', { name, exact: false }).click();
}
async function load(text) {
  await page.getByRole('button', { name: '＋ Nhập CSV', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nội dung CSV' }).fill(text);
  await page.getByRole('button', { name: 'Nạp dữ liệu', exact: true }).click();
}
async function screenshot(name) {
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
}
await load(data['instant-vocab'][0].csv.split('\n').slice(0, 4).join('\n'));
await screenshot('instant-mobile');
await navigate('Vocab Review');
await load(data['topic-vocab'][0].csv);
await page.getByText('Tùy chọn', { exact: false }).first().click();
await page.getByLabel('Tự phát audio').uncheck();
await page.getByText('Tùy chọn', { exact: false }).first().click();
await screenshot('flashcard-front-mobile');
await page.getByRole('button', { name: 'Xem đáp án', exact: true }).click();
await screenshot('flashcard-answer-mobile');
await navigate('Word Order');
await load(data.writing[0].csv);
await page.locator('.word-pool button').first().click();
await screenshot('word-order-mobile');
await navigate('Typing Review');
await page.getByRole('button', { name: '⛶ Focus', exact: true }).click();
await screenshot('typing-mobile');
await navigate('Sentence Structures');
await screenshot('structures-mobile');
await navigate('Speaking Questions');
await page.getByLabel('Phần thi').selectOption('2');
await screenshot('speaking-mobile');
await navigate('Multiple Choice');
await screenshot('multiple-choice-mobile');
await page.setViewportSize({ width: 1280, height: 900 });
await navigate('Instant Vocab');
await screenshot('instant-desktop');
await page.goto('http://127.0.0.1:4173/markdown/');
await page.locator('#markdown-loading').waitFor({ state: 'hidden' });
await page.getByRole('button', { name: 'Công cụ Markdown', exact: true }).click();
await page.getByRole('button', { name: 'Bài mẫu', exact: true }).click();
await page.locator('#lesson-output svg').waitFor();
await screenshot('markdown-desktop');
await browser.close();
console.log(`Screenshots saved to ${directory}`);
