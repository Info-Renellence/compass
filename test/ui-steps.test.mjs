// Run 3 (2026-10-23): each step of a 1-on-1, and the done screen, opens at the top of the page. Before, a step opened at
// the scroll position of the one before (Next sits at the bottom), so the step title and the step tabs were under the
// sticky top bar. Sample data (no database), Vite dev server on a local port, Playwright's Chromium.
//   node --test test/ui-steps.test.mjs        (COMPASS_UI_PORT to change the port, default 5544)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.COMPASS_UI_PORT || 5544);

test('every weekly and monthly step, and the done screens, open at the top', async () => {
  delete process.env.VITE_DATA_SOURCE;   // sample data: nothing is saved
  const server = await createServer({ root: ROOT, logLevel: 'silent', server: { port: PORT, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    // A short window, so every step is taller than it and Next needs a scroll.
    const page = await browser.newPage({ viewport: { width: 1400, height: 500 } });
    const next = (name) => page.getByRole('button', { name: name || 'Next', exact: true });
    const atTop = async (what) => {
      await page.waitForTimeout(150);
      const y = await page.evaluate(() => window.scrollY);
      assert.equal(y, 0, what + ' opened scrolled down by ' + y + ' px');
    };
    const walk = async (view, steps, saveName, doneText) => {
      await page.goto('http://127.0.0.1:' + PORT + '/#/' + view);
      await next().waitFor({ timeout: 30000 });
      for (let s = 1; s <= steps; s++) {
        if (view === 'weekly' && s === steps) await page.locator('.goals [role=radio]').first().click();
        const b = s === steps ? page.getByRole('button', { name: saveName }) : next();
        await b.scrollIntoViewIfNeeded();
        assert.ok(await page.evaluate(() => window.scrollY) > 0, view + ' step ' + s + ' needs a scroll to reach the button (test setup)');
        await b.click();
        if (s < steps) await atTop(view + ' step ' + (s + 1));
      }
      await page.getByText(doneText).first().waitFor({ timeout: 10000 });
      await atTop(view + ' done screen');
    };
    await walk('weekly', 6, 'Save the week', /week is set/);
    await walk('monthly', 4, /^Save /, /is set/);
  } finally {
    await browser.close();
    await server.close();
  }
});
