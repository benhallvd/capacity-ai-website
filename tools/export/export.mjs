/* ==========================================================================
   Exports every template on the brand page at its real pixel size.

     cd tools/export && npm install && node export.mjs [name ...]

   Serves the repo root itself, so nothing else needs to be running. Output
   lands in tools/export/out/<brand>/ as a PNG for every template.
   ========================================================================== */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(import.meta.dirname, 'out');
/* Every page with data-export pieces. All of them write to out/platform. */
const PAGES = [['platform', 'design-system.html'], ['platform', 'design-system/templates.html'], ['platform', 'design-system/outreach.html']];
const only = process.argv.slice(2);

/* Chrome occasionally stalls a capture under load; give it longer, once more. */
async function shot(page, opts) {
  try { return await page.screenshot({ timeout: 90000, ...opts }); }
  catch { return await page.screenshot({ timeout: 90000, ...opts }); }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const host = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });

for (const [brand, file] of PAGES.filter(([b]) => !process.env.BRAND || process.env.BRAND === b)) {
const base = host + file;
const dir0 = join(OUT, brand);
await mkdir(dir0, { recursive: true });

/* The list comes from the page itself, so a new template only needs a
   data-export name and size. */
const scout = await browser.newPage();
await scout.goto(base, { timeout: 120000 });
const all = await scout.$$eval('[data-export]', (els) => els.map((el) => ({
  name: el.dataset.export, size: el.dataset.exportSize, rect: el.getBoundingClientRect().width,
})));
await scout.close();

for (const t of all.filter((t) => !only.length || only.includes(t.name))) {
  /* Resumable: a run that stopped part way picks up where it left off. */
  if (!only.length && !process.env.FORCE && existsSync(join(dir0, `${t.name}.png`))) continue;
  /* The template is laid out at half its pixel size and captured at 2x, so
     the cqw type lands exactly where it does on the page. Emails keep the
     width they have on the page. */
  let cssW, cssH;
  if (t.size === '2x') { cssW = 600; cssH = null; }
  else { const [w, h] = t.size.split('x').map(Number); cssW = w / 2; cssH = h / 2; }

  const page = await browser.newPage({ viewport: { width: cssW, height: cssH || 800 }, deviceScaleFactor: 2 });
  await page.goto(base, { timeout: 120000 });
  await page.evaluate(({ name, cssW, cssH }) => {
    const el = document.querySelector(`[data-export="${name}"]`);
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelectorAll('.reveal').forEach((r) => r.classList.add('in'));
    const s = document.createElement('style');
    s.textContent = `
      body > *:not(svg) { visibility: hidden !important; }
      [data-export="${name}"], [data-export="${name}"] * { visibility: visible !important; }
      [data-export="${name}"] {
        position: fixed !important; left: 0 !important; top: 0 !important; z-index: 2147483647 !important;
        width: ${cssW}px !important; ${cssH ? `height: ${cssH}px !important; aspect-ratio: auto !important;` : ''}
        margin: 0 !important; border: 0 !important; border-radius: 0 !important; flex: none !important;
      }
      html, body { overflow: hidden !important; background: transparent !important; }
      *, *::before, *::after { transition: none !important; }
      .reveal { opacity: 1 !important; transform: none !important; }
      [data-export] .mail-bar, [data-export] .mail-body { display: none !important; }
      [data-export] .efoot { margin-top: 0 !important; border-top: 0 !important; }`;
    document.head.appendChild(s);
  }, { name: t.name, cssW, cssH });
  await page.evaluate(() => document.fonts.ready);
  const box = await page.$eval(`[data-export="${t.name}"]`, (el) => {
    const r = el.getBoundingClientRect();
    return { x: 0, y: 0, width: r.width, height: r.height };
  });
  if (!cssH) await page.setViewportSize({ width: cssW, height: Math.ceil(box.height) });

  await page.waitForTimeout(600); /* photographs are redrawn as dots on load */
  await shot(page, { path: join(dir0, `${t.name}.png`), clip: box });
  console.log(`${brand}/${t.name}.png`);
  await page.close();
}

}

await browser.close();
server.close();
