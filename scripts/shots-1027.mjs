// Screenshots of the 2026-10-27 weekly rework on sample data: wins, numbers, Find a customer, typed focus, Second look.
//   node scripts/shots-1027.mjs <out dir>
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] || 'shots';
const PORT = 5546;
delete process.env.VITE_DATA_SOURCE;
const server = await createServer({ root: ROOT, logLevel: 'silent', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true });
  await page.goto('http://127.0.0.1:' + PORT + '/#/weekly');
  await page.getByText(/WINS LAST WEEK/).waitFor({ timeout: 30000 });
  await shot('1-wins');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(300); await shot('2-numbers');
  await page.getByRole('button', { name: 'Find a customer' }).click();
  await page.getByLabel('Customer name').fill('sample');
  await page.waitForTimeout(200); await shot('3-find');
  await page.keyboard.press('Escape');
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(150); }
  await page.getByLabel('This week’s focus, in your words').fill('get noor and ken to a first order and book two visits with clinics going quiet');
  await page.getByRole('button', { name: 'Write it up' }).click();
  await page.getByLabel('Focus line').waitFor();
  await shot('4-focus');
  await page.goto('http://127.0.0.1:' + PORT + '/#/second-look');
  await page.getByText(/picks that differed/).waitFor({ timeout: 30000 });
  await shot('5-second-look');
} finally { await browser.close(); await server.close(); }
