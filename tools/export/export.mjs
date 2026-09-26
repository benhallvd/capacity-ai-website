/* ==========================================================================
   Exports every template on the brand page at its real pixel size.

     cd tools/export && npm install && node export.mjs [name ...]

   Serves the repo root itself, so nothing else needs to be running. Output
   lands in tools/export/out/: a PNG for every template, plus a seamless MP4
   for any template that carries a points object.

   The loop: the page runs on Playwright's fake clock, so every frame is
   stepped exactly 1/30s and nothing depends on how fast the machine is.
   Objects sway on sin(t * 0.45), which repeats every 2pi / 0.45 s, so one
   loop is exactly one sway. The point drift underneath has no common
   period, so the first second of the loop is crossfaded with the second
   just after it ends. The last frame then runs straight into the first.
   ========================================================================== */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(import.meta.dirname, 'out');
const PAGE = 'brand-gnv7ztt1hgki.html';
const FPS = 30;
const LOOP = (2 * Math.PI) / 0.45;
const FADE = FPS; /* frames */
const only = process.argv.slice(2);

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
const base = `http://localhost:${server.address().port}/${PAGE}`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(OUT, { recursive: true });

/* The list comes from the page itself, so a new template only needs a
   data-export name and size. */
const scout = await browser.newPage();
await scout.goto(base);
const all = await scout.$$eval('[data-export]', (els) => els.map((el) => ({
  name: el.dataset.export, size: el.dataset.exportSize, rect: el.getBoundingClientRect().width,
  animated: !!el.querySelector('[data-points]'),
})));
await scout.close();

for (const t of all.filter((t) => !only.length || only.includes(t.name))) {
  /* The template is laid out at half its pixel size and captured at 2x, so
     the cqw type lands exactly where it does on the page. Emails keep the
     width they have on the page. */
  let cssW, cssH;
  if (t.size === '2x') { cssW = 600; cssH = null; }
  else { const [w, h] = t.size.split('x').map(Number); cssW = w / 2; cssH = h / 2; }

  const page = await browser.newPage({ viewport: { width: cssW, height: cssH || 800 }, deviceScaleFactor: 2 });
  if (t.animated) await page.clock.install();
  await page.goto(base);
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

  if (!t.animated) {
    await page.waitForTimeout(600); /* photographs are redrawn as dots on load */
    await page.screenshot({ path: join(OUT, `${t.name}.png`), clip: box });
    console.log(`${t.name}.png`);
    await page.close();
    continue;
  }

  /* Let the object assemble and settle before the loop starts. */
  await page.clock.runFor(5000);
  const dir = join(OUT, `.frames-${t.name}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const N = Math.round(LOOP * FPS);
  for (let i = 0; i < N + FADE; i++) {
    await page.clock.runFor(1000 / FPS);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(5, '0')}.png`), clip: box });
    if (i === 0) await page.screenshot({ path: join(OUT, `${t.name}.png`), clip: box });
  }
  await page.close();

  /* Frames 0..FADE-1 are blended with N..N+FADE-1, rising from the tail to
     the head, then the rest of the loop plays as recorded. */
  const seq = join(dir, 'f%05d.png');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-framerate', String(FPS), '-start_number', String(N), '-i', seq,
    '-framerate', String(FPS), '-i', seq,
    '-filter_complex',
    `[1:v]split[a][b];` +
    `[a]trim=end_frame=${FADE},setpts=PTS-STARTPTS[head];` +
    `[b]trim=start_frame=${FADE}:end_frame=${N},setpts=PTS-STARTPTS[rest];` +
    `[0:v]trim=end_frame=${FADE},setpts=PTS-STARTPTS[tail];` +
    `[tail][head]blend=all_expr='A*(1-N/${FADE})+B*(N/${FADE})'[x];` +
    `[x][rest]concat=n=2:v=1[out]`,
    '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', join(OUT, `${t.name}.mp4`)]);
  await rm(dir, { recursive: true, force: true });
  console.log(`${t.name}.png  ${t.name}.mp4  (${(N / FPS).toFixed(2)}s loop)`);
}

await browser.close();
server.close();
