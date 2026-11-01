/* ==========================================================================
   Share cards (og:image / twitter:image) for every public page.

     cd tools/export && node ../og/generate.mjs

   Uses the Playwright install in tools/export. Serves the repo itself, reads
   each page's own H1, draws a 1200 x 630 card in the site's room hero style,
   writes assets/og/<slug>.jpg (JPEG keeps it small enough for WhatsApp's preview), then points the page's og:image and
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
  'analytics': 'Website',
  'forms': 'Signup forms',
  'files': 'Files',
  'reports': 'Reports',
  'intelligence': 'Capacity Intelligence',
  'nightclubs': 'Nightclubs',
  'bars': 'Bars',
  'competitive-socialising': 'Competitive socialising',
  'festivals': 'Festivals',
  'promoters': 'Event promoters',
  integrations: 'Integrations',
  discovery: '',
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
  home: 'Get your venue or events<br>to capacity.',
  hiring: 'Help us build the future<br>of hospitality.',
};

const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
/* The card being drawn, served from the same origin as the photo so the
   glyph field can read its pixels. */
let current = '';
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__card') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(current); }
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw 0;
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const HOST = `http://localhost:${server.address().port}/`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/* The card is the site's room hero: the page's own photo in black and white,
   the ascii.js glyph field over it, and the headline set on the left. */
const card = (label, headline, photo, sentence) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@400..800&family=Mona+Sans:wdth,wght@125,600..800&display=swap">
<style>
  @font-face { font-family: 'Geist Mono'; src: url(${HOST}assets/fonts/GeistMono-Regular.woff2) format('woff2'); font-weight: 400; }
  @font-face { font-family: 'Geist Mono'; src: url(${HOST}assets/fonts/GeistMono-Medium.woff2) format('woff2'); font-weight: 500; }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body { background: #0a0a0a; color: #f5f5f5; font-family: 'Rethink Sans', sans-serif;
         position: relative; overflow: hidden; -webkit-font-smoothing: antialiased; }
  .room { position: absolute; inset: 0; }
  .room img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 40%;
              filter: grayscale(1) contrast(1.06) brightness(.8); }
  /* Darker on the left, where the headline sits. */
  .shade { position: absolute; inset: 0; z-index: 1;
           background: linear-gradient(90deg, rgba(10,10,10,.86) 0%, rgba(10,10,10,.6) 45%, rgba(10,10,10,.12) 100%),
                       linear-gradient(180deg, rgba(10,10,10,.35) 0%, transparent 40%, rgba(10,10,10,.55) 100%); }
  canvas.ascii { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 2; mix-blend-mode: screen; opacity: .16;
                 -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,.14) 0%, rgba(0,0,0,.3) 42%, #000 72%);
                 mask-image: linear-gradient(90deg, rgba(0,0,0,.14) 0%, rgba(0,0,0,.3) 42%, #000 72%); }
  .in { position: absolute; inset: 64px 80px 60px; z-index: 3; display: flex; flex-direction: column; }
  .mark { width: 44px; height: auto; }
  .body { margin-top: auto; margin-bottom: auto; }
  .label, .url { font-family: 'Geist Mono', monospace; font-weight: 500; font-size: 18px; letter-spacing: .14em; text-transform: uppercase; }
  .label { color: #7aa3ff; margin-bottom: 22px; }
  h1 { font-family: 'Mona Sans', sans-serif; font-stretch: 125%; font-size: 60px; line-height: .98; font-weight: 700; letter-spacing: -0.012em; text-transform: uppercase; max-width: 960px; text-wrap: balance; }
  h1.s { text-transform: none; font-weight: 600; letter-spacing: -0.02em; line-height: 1.08; }
  .url { color: #9a9ea6; }
</style></head><body>
  <div class="room"><img src="${HOST}assets/photo/${photo}" alt="" data-ascii></div>
  <div class="shade"></div>
  <div class="in">
    <img class="mark" src="${HOST}assets/capacity-logomark-blue.png" alt="">
    <div class="body">${label ? `<p class="label">${esc(label)}</p>` : ''}<h1${sentence ? ' class="s"' : ''}>${headline}</h1></div>
    <p class="url">getcapacity.co</p>
  </div>
  <script src="${HOST}ascii.js"></script>
</body></html>`;

/* The photo behind each card: the page's own hero photo, or these for pages
   without one. */
const PHOTO = { home: 'room-booth.jpg', discovery: 'room-mirror-ball.jpg', hiring: 'room-confetti.jpg' };
const pagePhoto = (html) => (html.match(/<img class="room-bg" src="assets\/photo\/([^"]+)"/) || [])[1];

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
  const photo = PHOTO[slug] || pagePhoto(html) || 'room-booth.jpg';
  /* Case follows the page: see h--sentence in site.css. */
  const sentence = slug === 'hiring' || /<h1[^>]*h--sentence/.test(html);
  current = card(label, headline, photo, sentence);
  await page.goto(HOST + '__card', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('canvas.ascii.is-on');
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'jpeg', quality: 86 });
  await writeFile(join(OUT, slug + '.jpg'), png);
  hashes[slug] = createHash('sha256').update(png).digest('hex').slice(0, 10);
  console.log(`${slug}.jpg  ${headline}`);
}
await browser.close();
server.close();

/* Point every page at its card. */
const pages = { ...Object.fromEntries(Object.keys(CARDS).map((s) => [s, s])), ...SHARE };
for (const [slug, cardSlug] of Object.entries(pages)) {
  const file = join(ROOT, (FILE[slug] || slug) + '.html');
  let html = await readFile(file, 'utf8');
  const url = `${SITE}/assets/og/${cardSlug}.jpg?v=${hashes[cardSlug]}`;
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
