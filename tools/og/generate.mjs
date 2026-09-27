/* ==========================================================================
   Share cards (og:image / twitter:image) for every public page.

     cd tools/export && node ../og/generate.mjs

   Uses the Playwright install in tools/export. Serves the repo itself, reads
   each page's own H1, draws a 1200 x 630 card in the site's type and colours,
   writes assets/og/<slug>.png, then points the page's og:image and
   twitter:image at it with a content hash, so a changed card is refetched.
   Pages without a card of their own (the legal pages) get the home card.
   ========================================================================== */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, resolve } from 'node:path';

const require = createRequire(resolve(import.meta.dirname, '../export/package.json'));
const { chromium } = require('playwright');

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'assets/og');
const SITE = 'https://getcapacity.co';

/* slug: label shown above the headline ('' for none). The headline is the
   page's own H1, so the card always says what the page says. */
const CARDS = {
  home: '',
  'ticketing': 'Ticketing',
  'enquiries': 'Enquiries',
  'profiles': 'Customer profiles',
  'till': 'Till and POS',
  'whatsapp': 'WhatsApp',
  'social': 'Social media',
  'analytics': 'Website analytics',
  'forms': 'Signup forms',
  'files': 'Files',
  'reports': 'Reports',
  'intelligence': 'Intelligence',
  'nightclubs': 'Nightclubs',
  'bars': 'Bars',
  'competitive-socialising': 'Competitive socialising',
  'festivals': 'Festivals',
  'promoters': 'Event promoters',
  integrations: 'Integrations',
  signup: 'Book a demo',
  hiring: 'Careers',
  'case-neon-rooms': 'Case study',
};
/* Pages that share another page's card. */
const SHARE = {
  waitlist: 'home', terms: 'home', privacy: 'home', dpa: 'home', cookies: 'home',
  'acceptable-use': 'home', security: 'home', 'sub-processors': 'home',
};
/* The home page lives in index.html. */
const FILE = { home: 'index' };
/* Headlines that should not be the page H1 on the card. */
const HEADLINE = {
  home: 'The operating system<br>for venues.',
  hiring: 'Help us build the future<br>of hospitality.',
};

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw 0;
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const HOST = `http://localhost:${server.address().port}/`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const card = (label, headline) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@400..800&display=swap">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body { background: #0a0a0a; color: #f5f5f5; font-family: 'Rethink Sans', sans-serif; letter-spacing: -0.03em;
         position: relative; overflow: hidden; -webkit-font-smoothing: antialiased; }
  /* The site's dot horizon, laid flat and fading up into the dark. */
  .field { position: absolute; left: 0; right: 0; bottom: 0; height: 300px;
           background-image: radial-gradient(circle, rgba(111, 150, 255, .5) 1.2px, transparent 1.8px);
           background-size: 14px 14px;
           -webkit-mask-image: radial-gradient(120% 100% at 50% 100%, #000 15%, transparent 70%);
           mask-image: radial-gradient(120% 100% at 50% 100%, #000 15%, transparent 70%); }
  .glow { position: absolute; left: 50%; bottom: -260px; width: 1300px; height: 520px; transform: translateX(-50%);
          background: radial-gradient(closest-side, rgba(27, 99, 248, .22), transparent); }
  .in { position: absolute; inset: 72px 80px 64px; display: flex; flex-direction: column; }
  .mark { width: 46px; height: auto; }
  .body { margin-top: auto; margin-bottom: auto; }
  .label { font-size: 26px; font-weight: 600; color: #7fa4ff; letter-spacing: -0.01em; margin-bottom: 18px; }
  h1 { font-size: 80px; line-height: 1.02; font-weight: 700; max-width: 1000px; text-wrap: balance; }
  .url { font-size: 22px; color: #8f8f8f; letter-spacing: -0.01em; }
</style></head><body>
  <div class="glow"></div><div class="field"></div>
  <div class="in">
    <img class="mark" src="${HOST}assets/capacity-logomark-blue.png" alt="">
    <div class="body">${label ? `<p class="label">${esc(label)}</p>` : ''}<h1>${headline}</h1></div>
    <p class="url">getcapacity.co</p>
  </div>
</body></html>`;

const pageH1 = (html) => {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) return '';
  /* The page's own line breaks are designed, so they carry over. */
  return m[1].replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '').replace(/<br\s*\/?>/g, '\u0000')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/\s*\u0000\s*/g, '<br>');
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const hashes = {};
for (const [slug, label] of Object.entries(CARDS)) {
  const html = await readFile(join(ROOT, (FILE[slug] || slug) + '.html'), 'utf8');
  const headline = HEADLINE[slug] || pageH1(html);
  await page.setContent(card(label, headline), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  await writeFile(join(OUT, slug + '.png'), png);
  hashes[slug] = createHash('sha256').update(png).digest('hex').slice(0, 10);
  console.log(`${slug}.png  ${headline}`);
}
await browser.close();
server.close();

/* Point every page at its card. */
const pages = { ...Object.fromEntries(Object.keys(CARDS).map((s) => [s, s])), ...SHARE };
for (const [slug, cardSlug] of Object.entries(pages)) {
  const file = join(ROOT, (FILE[slug] || slug) + '.html');
  let html = await readFile(file, 'utf8');
  const url = `${SITE}/assets/og/${cardSlug}.png?v=${hashes[cardSlug]}`;
  const title = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || 'Capacity';
  const tags =
    `<meta property="og:image" content="${url}" />\n` +
    `<meta property="og:image:width" content="1200" />\n` +
    `<meta property="og:image:height" content="630" />\n` +
    `<meta property="og:image:alt" content="${title}" />\n` +
    `<meta name="twitter:image" content="${url}" />`;
  html = html.replace(/<meta property="og:image(?::[a-z]+)?" content="[^"]*" \/>\n?/g, '')
             .replace(/<meta name="twitter:image" content="[^"]*" \/>\n?/g, '');
  html = html.replace(/(<meta name="twitter:card" content="[^"]*" \/>)/, `${tags}\n$1`);
  if (!html.includes('og:site_name')) html = html.replace(/(<meta property="og:type" content="[^"]*" \/>)/, `$1\n<meta property="og:site_name" content="Capacity" />\n<meta property="og:locale" content="en_GB" />`);
  await writeFile(file, html);
}
console.log('pages updated', Object.keys(pages).length);
