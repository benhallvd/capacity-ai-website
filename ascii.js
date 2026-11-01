/* The room as Capacity reads it: a dense grid of small tiles laid over a
   photograph, each carrying a character, every cell lit by how bright the
   picture is under it. Brighter cells run from navy through brand blue to a
   pale tile with a dark character. On its own it stays quiet, a character
   stepping to a new one now and then, each cell on its own slow clock. The reader moves it: a click
   drops into the grid like a stone into water, and the pointer leaves a faint
   trail that lifts the characters it passes over.

   The water is a real ripple simulation on a grid the size of the glyphs, so
   rings bend, cross and fade the way water does, and every drop lands a
   little differently. The resting grid is drawn once into its own canvas and
   only refreshed every second or so; each frame copies it and redraws just
   the cells the water or the pointer is touching.

   <img data-ascii> sets the light; data-ascii="soft" is the quieter version
   for cards and closes. Without JS, or with reduced motion, the image shows
   as a photo. */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = Array.prototype.slice.call(document.querySelectorAll('img[data-ascii]'));
  if (!els.length || reduced) return;

  /* Characters from dark to bright, three per step so a cell can change its
     character without changing its light. */
  var BANDS = [['.', ':', "'"], ['-', '=', '~'], ['+', 't', '*'], ['x', 's', 'z'], ['X', 'S', 'Z'], ['#', '8', '%'], ['@', '0', '&']];
  var VARS = 3;
  var TONES = 14;        /* light steps baked into the atlas */
  var LIFT = 1.6;        /* how a cell's light maps onto the tone steps */
  var CREST = .38;       /* the light a ripple's crest lifts a cell to, mid brand blue */
  var TRAIL = .3;        /* the light the pointer's trail lifts a cell to */
  var FONT = '"Geist Mono", ui-monospace, Menlo, monospace';
  var FPS = 30;
  var REST_EVERY = 1.2;  /* seconds between refreshes of the resting grid */
  var TRAIL_R = 42;      /* px, how wide the pointer's trail is */
  var TRAIL_LIFE = .8;   /* seconds a point of the trail lasts */
  var DAMP = .963;       /* how quickly the water settles */
  var SPONGE = 8;        /* cells at the edge that soak waves up instead of bouncing them back */

  /* A small, repeatable hash so a cell's character and clock come out the
     same every time without storing them. */
  function hash(a, b) {
    var h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function mix(a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; }
  /* Tile colour: navy up to brand blue, then on to pale. */
  function tileColour(k) { return k < .65 ? mix([10, 26, 84], [34, 92, 230], k / .65) : mix([34, 92, 230], [206, 220, 255], (k - .65) / .35); }
  /* Which tone step a cell's light lands on, or -1 for nothing. */
  function toneOf(a, floor) {
    if (a < .02) return -1;
    var k = Math.max(floor || 0, Math.min(1, a * LIFT));
    return Math.min(TONES - 1, (k * TONES) | 0);
  }

  function piece(el) {
    var soft = el.getAttribute('data-ascii') === 'soft';
    /* "wave": the home hero. The grid is mostly empty, and patches of it
       fade in and out as slow bands of light travel across. */
    var wave = el.getAttribute('data-ascii') === 'wave';
    var host = el.parentNode;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var canvas = document.createElement('canvas');
    canvas.className = 'ascii' + (soft ? ' ascii--soft' : '');
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, el.nextSibling);
    el.classList.add('is-ascii');

    var ctx = canvas.getContext('2d', { alpha: true });
    var rest = document.createElement('canvas');
    var rctx = rest.getContext('2d', { alpha: true });
    var off = document.createElement('canvas');
    var octx = off.getContext('2d', { alpha: false, willReadFrequently: true });
    var atlas = document.createElement('canvas');
    var actx = atlas.getContext('2d');

    var cols = 0, rows = 0, cw = 8, ch = 11, w = 0, h = 0, dpr = 1, gw = 0, gh = 0;
    var lum, seed, tint, restA, restC, liftBuf, damp;
    /* The water: two height fields on a square grid twice the width of a
       glyph, read back smoothly, so the rings come out round and wide. */
    var sw = 0, sh = 0, sc = 14, wa = null, wb = null, awake = false, calm = 0;
    var trail = [];
    var on = false, raf = 0, last = 0, lastRest = -1e9, wasActive = false, t0 = performance.now();

    var gain = soft ? .48 : .74;
    var base = soft ? .06 : .07;
    var span = soft ? .44 : .55;

    /* Every tone drawn once as a tile with its character, in both of its
       characters, so drawing is just copies out of this sheet. */
    function buildAtlas() {
      cw = soft ? 7 : 8; ch = soft ? 10 : 11;
      gw = Math.round(cw * dpr); gh = Math.round(ch * dpr);
      atlas.width = gw * TONES * VARS; atlas.height = gh;
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.clearRect(0, 0, atlas.width, atlas.height);
      actx.font = '500 ' + Math.round(gh * .72) + 'px ' + FONT;
      actx.textBaseline = 'middle'; actx.textAlign = 'center';
      var g = Math.max(1, Math.round(gw * .14)), r = Math.max(1, gw * .16);
      for (var t = 0; t < TONES; t++) {
        var k = (t + .5) / TONES;
        for (var v = 0; v < VARS; v++) {
          var x = (t * VARS + v) * gw;
          actx.globalAlpha = .14 + .7 * k;
          actx.fillStyle = tileColour(k);
          actx.beginPath();
          if (actx.roundRect) actx.roundRect(x + g / 2, g / 2, gw - g, gh - g, r); else actx.rect(x + g / 2, g / 2, gw - g, gh - g);
          actx.fill();
          if (k < .08) continue;
          actx.globalAlpha = k > .7 ? .85 : .24 + .46 * k;
          actx.fillStyle = k > .7 ? '#04102e' : mix([96, 140, 255], [220, 230, 255], k);
          actx.fillText(BANDS[Math.min(BANDS.length - 1, (k * BANDS.length) | 0)][v], x + gw / 2, gh / 2 + .5);
        }
      }
      actx.globalAlpha = 1;
    }
    function tile(c, tn, v, x, y) { c.drawImage(atlas, (tn * VARS + v) * gw, 0, gw, gh, x, y, gw, gh); }

    /* Size everything to the photo, and sample it at one value per cell,
       cropped the way object-fit: cover shows it. */
    function sample() {
      var r = el.getBoundingClientRect();
      w = Math.round(r.width); h = Math.round(r.height);
      if (!w || !h || !el.naturalWidth) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      buildAtlas();
      cols = Math.ceil(w / cw); rows = Math.ceil(h / ch);
      canvas.width = rest.width = Math.round(w * dpr);
      canvas.height = rest.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';

      off.width = cols; off.height = rows;
      var iw = el.naturalWidth, ih = el.naturalHeight;
      var s = Math.max(w / iw, h / ih), sw0 = w / s, sh0 = h / s;
      var pos = (getComputedStyle(el).objectPosition || '50% 50%').split(' ');
      var ox = parseFloat(pos[0]) / 100, oy = parseFloat(pos[1] || '50%') / 100;
      if (isNaN(ox)) ox = .5; if (isNaN(oy)) oy = .5;
      octx.drawImage(el, (iw - sw0) * ox, (ih - sh0) * oy, sw0, sh0, 0, 0, cols, rows);
      var d = octx.getImageData(0, 0, cols, rows).data;

      var n = cols * rows;
      lum = new Float32Array(n); seed = new Float32Array(n); tint = new Uint8Array(n);
      restA = new Float32Array(n); restC = new Uint8Array(n);
      var lo = 1, hi = 0;
      for (var i = 0; i < n; i++) {
        var v = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114) / 255;
        lum[i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
        var x = i % cols, y = (i / cols) | 0;
        seed[i] = hash(x, y);
        tint[i] = hash(x * 7 + 3, y * 13 + 1) < (soft ? .07 : .09) ? 1 : 0;
      }
      /* Stretch so the darkest cell is 0 and the brightest 1, then ease it so
         the subject stands out of a quiet field. */
      var spanL = Math.max(.08, hi - lo);
      for (var k = 0; k < n; k++) { var q = (lum[k] - lo) / spanL; lum[k] = q * q * (3 - 2 * q); }

      sc = cw * 2;
      sw = Math.ceil(w / sc) + 2; sh = Math.ceil(h / sc) + 2;
      wa = new Float32Array(sw * sh); wb = new Float32Array(sw * sh);
      /* The water settles everywhere, and much faster near the edges, so a
         ring runs out at the edge of the section rather than coming back. */
      damp = new Float32Array(sw * sh);
      for (var dy = 0; dy < sh; dy++) {
        for (var dx = 0; dx < sw; dx++) {
          var e = Math.min(dx, dy, sw - 1 - dx, sh - 1 - dy);
          damp[dy * sw + dx] = e >= SPONGE ? DAMP : DAMP * (.7 + .3 * e / SPONGE);
        }
      }
      liftBuf = new Float32Array(n);
      awake = false; trail = [];
      lastRest = -1e9;
      return true;
    }

    /* The resting grid: each cell's character and light with nothing
       touching it, drawn into its own canvas. */
    function drawRest(t) {
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.clearRect(0, 0, rest.width, rest.height);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var i = y * cols + x, v = lum[i], hz = seed[i];
          var gen = Math.floor((t + hz * 60) / (wave ? 3 + hz * 6 : 8 + hz * 14));
          restC[i] = (hash(i, gen) * VARS) | 0;
          var a;
          if (wave) {
            /* Three slow travelling waves added together, so the lit patches
               swell, drift and break up. Each cell's own threshold is a
               little different, which gives the patches ragged edges. */
            var nx = x * cw, ny = y * ch;
            var n = (Math.sin(nx * .006 + ny * .004 - t * .55)
              + .8 * Math.sin(nx * .0035 - ny * .007 + t * .4 + 1.7)
              + .6 * Math.sin((nx + ny) * .0022 - t * .25 + 4)) / 2.4 + (hz - .5) * .3;
            var m = n <= .02 ? 0 : n >= .5 ? 1 : (n - .02) / .48;
            m = m * m * (3 - 2 * m);
            a = m * (.13 + v * .5);
          } else {
            /* The quietest corners thin out rather than sitting as a flat sheet. */
            if (v < .06 && hz < .55) { restA[i] = 0; continue; }
            a = (base + v * span) * gain;
          }
          restA[i] = a;
          var tn = toneOf(tint[i] ? a * 1.35 : a);
          if (tn < 0) continue;
          tile(rctx, tn, restC[i], Math.round(x * cw * dpr), Math.round(y * ch * dpr));
        }
      }
      lastRest = t;
    }

    /* A drop: a dip in the water, never quite the same size, strength or
       shape, sometimes with a smaller splash or two beside it. */
    function drop(px, py, power, splash) {
      var cx = px / sc + 1, cy = py / sc + 1;
      var big = power > 1;
      var parts = [[cx, cy, power * (.8 + Math.random() * .5), big ? 2.6 + Math.random() * 2.2 : 1.4]];
      if (splash) {
        var extra = 1 + (Math.random() * 3 | 0);
        for (var e = 0; e < extra; e++) {
          var ang = Math.random() * 6.283, dist = 2 + Math.random() * 3.5;
          parts.push([cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, power * (.25 + Math.random() * .35), 1.2 + Math.random() * 1.4]);
        }
      }
      for (var p = 0; p < parts.length; p++) {
        var dx0 = parts[p][0], dy0 = parts[p][1], pw = parts[p][2], rad = parts[p][3];
        var r0 = Math.ceil(rad);
        for (var yy = -r0; yy <= r0; yy++) {
          for (var xx = -r0; xx <= r0; xx++) {
            var gx = Math.round(dx0) + xx, gy = Math.round(dy0) + yy;
            if (gx < 1 || gy < 1 || gx >= sw - 1 || gy >= sh - 1) continue;
            var dd = Math.sqrt(xx * xx + yy * yy) / rad;
            if (dd > 1) continue;
            wb[gy * sw + gx] -= pw * (.5 + .5 * Math.cos(dd * Math.PI));
          }
        }
      }
      awake = true; calm = 0;
      start();
    }

    /* One step of the water: each point moves towards the average of its
       neighbours and away from where it just was, then settles a little. */
    function step() {
      var peak = 0;
      for (var y = 1; y < sh - 1; y++) {
        var row = y * sw;
        for (var x = 1; x < sw - 1; x++) {
          var i = row + x;
          var nv = ((wb[i - 1] + wb[i + 1] + wb[i - sw] + wb[i + sw]) * .5 - wa[i]) * damp[i];
          wa[i] = nv;
          if (nv > peak) peak = nv; else if (-nv > peak) peak = -nv;
        }
      }
      var tmp = wa; wa = wb; wb = tmp;
      if (peak < .012) { if (++calm > 6) { awake = false; wa.fill(0); wb.fill(0); } }
      else calm = 0;
    }

    function draw(now) {
      var t = (now - t0) / 1000;
      while (trail.length && t - trail[0].t > TRAIL_LIFE) trail.shift();
      if (awake) step();
      var restDue = wave || t - lastRest > REST_EVERY;
      if (!restDue && !awake && !trail.length && !wasActive) return;
      if (restDue) drawRest(t);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rest, 0, 0);
      if (!awake && !trail.length) { wasActive = false; return; }

      /* The trail, stamped point by point into the cells around each one,
         keeping the brightest. */
      if (trail.length) {
        liftBuf.fill(0);
        var rr = TRAIL_R * TRAIL_R;
        for (var q = 0; q < trail.length; q++) {
          var tp = trail[q], life = 1 - (t - tp.t) / TRAIL_LIFE;
          if (life <= 0) continue;
          var gx0 = Math.max(0, Math.floor((tp.x - TRAIL_R) / cw)), gx1 = Math.min(cols - 1, Math.ceil((tp.x + TRAIL_R) / cw));
          var gy0 = Math.max(0, Math.floor((tp.y - TRAIL_R) / ch)), gy1 = Math.min(rows - 1, Math.ceil((tp.y + TRAIL_R) / ch));
          for (var gy = gy0; gy <= gy1; gy++) {
            var ddy = gy * ch + ch / 2 - tp.y;
            for (var gx = gx0; gx <= gx1; gx++) {
              var ddx = gx * cw + cw / 2 - tp.x, d2 = ddx * ddx + ddy * ddy;
              if (d2 > rr) continue;
              var f = 1 - Math.sqrt(d2) / TRAIL_R;
              var lv = f * (.6 + .4 * f) * life * .95;
              var gi = gy * cols + gx;
              if (lv > liftBuf[gi]) liftBuf[gi] = lv;
            }
          }
        }
      }

      var any = false;
      for (var y = 0; y < rows; y++) {
        var cy = y * ch + ch / 2;
        var fy = cy / sc + 1, iy = fy | 0, ky = fy - iy;
        if (iy >= sh - 1) { iy = sh - 2; ky = 1; }
        for (var x = 0; x < cols; x++) {
          var i = y * cols + x;
          var wv = 0;
          if (awake) {
            /* Read the water between its four nearest points. */
            var fx = (x * cw + cw / 2) / sc + 1, ix = fx | 0, kx = fx - ix;
            if (ix >= sw - 1) { ix = sw - 2; kx = 1; }
            var k0 = iy * sw + ix;
            wv = -((wb[k0] * (1 - kx) + wb[k0 + 1] * kx) * (1 - ky) + (wb[k0 + sw] * (1 - kx) + wb[k0 + sw + 1] * kx) * ky);
          }
          var lift = trail.length ? liftBuf[i] : 0;
          if (wv < .025 && wv > -.025 && lift < .025) continue;
          any = true;

          var a0 = restA[i] || .02 * gain;
          var a = a0, ci = restC[i];
          if (wv > 0) {
            /* A crest lifts a cell towards brand blue and stirs the characters it carries. */
            var c = Math.min(1, wv * 1.1);
            if (a0 < CREST) a = a0 + (CREST - a0) * c;
            if (c > .35) ci = (hash(i, Math.floor(t * 9)) * VARS) | 0;
          } else if (wv < 0) {
            /* A trough dims what is under it. */
            a = a0 * (1 - Math.min(.85, -wv * 1.1));
          }
          /* The trail lifts what it passes over a little. */
          if (lift > 0 && a < TRAIL) a = a + (TRAIL - a) * lift;
          var px = Math.round(x * cw * dpr), py = Math.round(y * ch * dpr);
          ctx.clearRect(px, py, gw, gh);
          var tn = toneOf(a);
          if (tn < 0) continue;
          tile(ctx, tn, ci, px, py);
        }
      }
      wasActive = any;
    }

    function frame(now) {
      raf = 0;
      if (!on) return;
      if (now - last >= 1000 / FPS - 2) { last = now; draw(now); }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!on) { on = true; if (!raf) raf = requestAnimationFrame(frame); } }
    function stop() { on = false; }

    /* The pointer is read off the section the grid sits in, so moving over
       the copy or a card on top of it still counts. Moving leaves a trail
       along the whole path, filled in between the points the browser
       reports so a quick movement still draws a line; a click is the stone. */
    host.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || !wa) return;
      var r = canvas.getBoundingClientRect();
      var t = (performance.now() - t0) / 1000;
      var x = e.clientX - r.left, y = e.clientY - r.top;
      var prev = trail[trail.length - 1];
      if (prev && t - prev.t < .1) {
        var mx = x - prev.x, my = y - prev.y, steps = Math.min(40, Math.floor(Math.sqrt(mx * mx + my * my) / 10));
        for (var k = 1; k < steps; k++) trail.push({ x: prev.x + mx * k / steps, y: prev.y + my * k / steps, t: prev.t + (t - prev.t) * k / steps });
      }
      trail.push({ x: x, y: y, t: t });
      if (trail.length > 160) trail.splice(0, trail.length - 160);
      start();
    }, { passive: true });
    host.addEventListener('pointerdown', function (e) {
      if (!wa) return;
      var r = canvas.getBoundingClientRect();
      drop(e.clientX - r.left, e.clientY - r.top, 2.2, true);
    }, { passive: true });

    var ready = function () {
      if (!sample()) return;
      draw(performance.now());
      canvas.classList.add('is-on');
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }, { rootMargin: '120px 0px' }).observe(canvas);
      } else start();
    };
    if (el.complete && el.naturalWidth) ready(); else el.addEventListener('load', ready, { once: true });

    var rt = 0;
    var resample = function () { clearTimeout(rt); rt = setTimeout(function () { if (sample()) draw(performance.now()); }, 150); };
    if ('ResizeObserver' in window) new ResizeObserver(resample).observe(el);
    else window.addEventListener('resize', resample, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (!on) start(); });
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { els.forEach(piece); });
  else els.forEach(piece);
})();
