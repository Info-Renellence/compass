// Run 4 lane A: Compass screens on the v1 copy of real data (read only: every POST is blocked in the browser).
//   node scripts/run4-realdata-ui.mjs <port> <out dir>     (needs test/run/serve.js on <port>, built with VITE_DATA_SOURCE=api)
import { chromium } from 'playwright';
import path from 'path';
const PORT = process.argv[2] || 5703, OUT = process.argv[3] || 'shots';
const browser = await chromium.launch();
const problems = [];
try {
  for (const [w, h] of [[1440, 900], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('console', (m) => { if (m.type() === 'error') problems.push(w + ' console: ' + m.text().slice(0, 160)); });
    page.on('pageerror', (e) => problems.push(w + ' pageerror: ' + String(e).slice(0, 160)));
    await page.route('**/*', (r) => { const rq = r.request(); const u = new URL(rq.url());
      if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return r.abort();
      if (rq.method() === 'POST') { problems.push('BLOCKED POST ' + u.pathname); return r.abort(); } return r.continue(); });
    for (const view of ['weekly', 'monthly', 'second-look']) {
      await page.goto('http://127.0.0.1:' + PORT + '/#/' + view);
      await page.waitForTimeout(4000);
      const txt = await page.evaluate(() => document.body.innerText);
      if (/NaN|undefined|\[object Object\]|Invalid Date/.test(txt)) problems.push(w + ' ' + view + ': bad text in page');
      const sw = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (sw) problems.push(w + ' ' + view + ': sideways scroll');
      await page.screenshot({ path: path.join(OUT, w + '-' + view + '.png'), fullPage: false });
      console.log(w, view, 'text length', txt.length, 'first line:', txt.split('\n').slice(0, 3).join(' | ').slice(0, 100));
    }
  }
} finally { await browser.close(); }
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no problems');
