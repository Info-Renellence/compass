// Screenshots of every Compass screen in the same state as the handoff's PNGs, for side-by-side checks.
// The handoff PNGs are 1440x900 with a mock window: the app area is 1400x826 at (20, 54). We render the app at exactly
// that size. Usage: npm run build && npx vite preview (port 5184), then `node scripts/shots.mjs [outDir]`.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.COMPASS_URL || 'http://localhost:5184/';
const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 826 }, deviceScaleFactor: 1 });
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const btn = (name, nth = 0) => page.getByRole('button', { name, exact: true }).nth(nth);
const row = (text) => page.locator('.sl', { hasText: text });
let loads = 0;
const open = async (hash) => { await page.goto(BASE + '?load=' + (++loads) + hash); await page.waitForSelector('.banner'); await page.evaluate(() => document.fonts.ready); };
const secondLook = async () => {
  await row('Dr. Noor Sample').getByRole('button', { name: 'Make it a Visit' }).click();
  await row('Omar Sample').getByRole('button', { name: 'Make it a Visit' }).click();
  await row('Dr. Priya Sample').getByRole('button', { name: 'Keep Park' }).click();
  await row('Zoe Sample').getByRole('button', { name: 'Make it a Wait' }).click();
};

// Weekly
await open('#/weekly');
await shot('08-compass-last-week');
await btn('Next').click();
await secondLook();
await shot('09-compass-second-look');
await btn('Next').click();
await shot('10-compass-visits');
await btn('Next').click();
await btn('Throw a curveball').click();
await shot('10b-compass-roleplay');
await btn('Next').click();
await page.locator('.callc', { hasText: 'Leo Sample' }).getByRole('button', { name: 'Make it a visit' }).click();
await shot('11-compass-calls');
await btn('Next').click();
await page.getByRole('radio', { name: /Close sampled clinics/ }).click();
await shot('12-compass-focus');

// Done, in the state of screen 13 (5 visits, 13 calls): same second look, one visit removed, no call moved.
await open('#/weekly');
await btn('Next').click();
await secondLook();
await btn('Next').click();
await page.getByRole('button', { name: 'Remove Dr. Cal Sample' }).click();
for (let i = 0; i < 3; i++) await btn('Next').click();
await page.getByRole('radio', { name: /Close sampled clinics/ }).click();
await btn('Save the week').click();
await shot('13-compass-done');

// Monthly
await open('#/monthly');
await shot('14-monthly-last-month');
await btn('Next').click();
for (const n of ['Dr. Ella Sample', 'Dr. Maya Sample', 'Dr. Ben Sample']) await page.locator('.grow-row', { hasText: n }).getByRole('button').click();
await shot('15-monthly-target-forecast');
await btn('Next').click();
await shot('16-monthly-fifty-check');
await btn('Next').click();
await shot('17-monthly-growth');
await btn('Save November').click();
await shot('18-monthly-done');

await browser.close();
