(function () {
  /* The Tiles chapter has the live stage; the subpages only need print stills. */
  var BASE = document.currentScript.src.replace(/[^/]*$/, '');
  var stage = document.getElementById('stage');
  var cv = stage && stage.querySelector('canvas');
  var ctx = cv && cv.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TONES = 24;       /* tone steps baked into the atlas */
  var HOLD = 0.8;       /* how much of a cell's light survives each frame */
  var D = 4;            /* camera distance */
  var FONT = '"Geist Mono", ui-monospace, Menlo, monospace';

  /* How each variant draws a cell. cols is cells across the panel, aspect
     is cell height over width. */
  var VARIANTS = [
    { id: 'tiles',  label: 'Tiles',  cols: 118, aspect: 1.4 },
    { id: 'light',  label: 'Light',  cols: 132, aspect: 1.75, light: true }
  ];
  var TILE_RAMP = ['.', '-', '+', 'x', 'X', '#', '@'];
  var NAVY = [8, 22, 72], BLUE = [27, 99, 248], PALE = [230, 238, 255];
  /* The tile colours. Blue is Capacity; a client's own subject brings its own. */
  var TINTS = {
    blue:      { deep: [10, 26, 84], mid: [34, 92, 230], hi: [206, 220, 255], on: '#04102e', lo: [96, 140, 255], top: [220, 230, 255], cell: BLUE, ink: [74, 128, 250], inkHi: [10, 42, 122] },
    labyrinth: { deep: [58, 8, 42], mid: [255, 46, 136], hi: [255, 216, 233], on: '#1c0614', lo: [255, 120, 180], top: [255, 228, 240], cell: [255, 46, 136], ink: [244, 92, 158], inkHi: [120, 6, 62] }
  };

  function hash(a, b) {
    var h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  /* navy through brand blue to near white */
  function pal(k) { return k < 0.6 ? mix(NAVY, BLUE, k / 0.6) : mix(BLUE, PALE, (k - 0.6) / 0.4); }

  var V = VARIANTS[0];
  var cellU, W, H, dpr, cw, ch, cols, rows, ox, oy, scale, cx, cy;
  var val, tone, atlas, cwp, chp, stars;

  /* ---- Atlas: every tone drawn once, three versions of each ---------- */
  function buildAtlas() {
    cwp = Math.round(cw * dpr); chp = Math.round(ch * dpr);
    atlas = document.createElement('canvas');
    atlas.width = TONES * cwp; atlas.height = 3 * chp;
    var a = atlas.getContext('2d');
    a.font = '500 ' + Math.round(chp * 0.72) + 'px ' + FONT;
    a.textAlign = 'center'; a.textBaseline = 'middle';
    var g = Math.max(1, Math.round(cwp * 0.14)), r = Math.max(1, cwp * 0.16), P = TINTS[S.tint || 'blue'];
    for (var t = 0; t < TONES; t++) {
      var k = (t + 0.5) / TONES;
      for (var v = 0; v < 3; v++) {
        var x = t * cwp, y = v * chp, mx = x + cwp / 2, my = y + chp / 2 + 0.5;
        if (V.id === 'tiles') {
          a.fillStyle = rgb(k < 0.65 ? mix(P.deep, P.mid, k / 0.65) : mix(P.mid, P.hi, (k - 0.65) / 0.35), 0.3 + 0.7 * k);
          a.beginPath(); a.roundRect(x + g / 2, y + g / 2, cwp - g, chp - g, r); a.fill();
          if (k > 0.2) {
            a.fillStyle = k > 0.7 ? P.on : rgb(mix(P.lo, P.top, k), 0.4 + 0.6 * k);
            a.fillText(TILE_RAMP[Math.min(TILE_RAMP.length - 1, Math.floor(k * TILE_RAMP.length))], mx, my);
          }
        } else if (V.id === 'type') {
          a.fillStyle = rgb(pal(Math.pow(k, 0.6)), 0.55 + 0.45 * k);
          a.fillText(V.ramp[Math.min(V.ramp.length - 1, 1 + Math.floor(k * (V.ramp.length - 1)))], mx, my);
        } else if (V.id === 'light') {
          /* soft tinted cells on white with one quiet blue digit, so the shape
             carries the weight and the digits stay a texture */
          var kk = clamp((k - 0.08) / 0.7);
          a.font = '500 ' + Math.round(chp * 0.58) + 'px ' + FONT;
          a.fillStyle = rgb(P.cell, 0.07 + 0.43 * kk);
          a.beginPath(); a.roundRect(x + g / 2, y + g / 2, cwp - g, chp - g, r); a.fill();
          a.fillStyle = rgb(mix(P.ink, P.inkHi, 0.25 + 0.3 * kk), 0.72);
          a.fillText(v === 1 ? '1' : '0', mx, my);
        } else if (V.id === 'binary') {
          a.fillStyle = rgb(pal(Math.pow(k, 0.6)), 0.5 + 0.5 * k);
          a.fillText(v === 1 ? '1' : '0', mx, my);
        } else if (V.id === 'dots') {
          a.fillStyle = rgb(pal(k), 1);
          a.beginPath(); a.arc(mx, y + chp / 2, Math.min(cwp, chp) * 0.5 * (0.2 + 0.8 * Math.sqrt(k)), 0, Math.PI * 2); a.fill();
        } else {
          a.fillStyle = rgb(pal(k), 0.25 + 0.75 * clamp(k * 1.6));
          a.beginPath(); a.roundRect(x + 0.5 * dpr, y + 0.5 * dpr, cwp - dpr, chp - dpr, Math.max(1, cwp * 0.12)); a.fill();
        }
      }
    }
  }

  function resize(fw, fh) {
    var rc = fw ? { width: fw, height: fh } : stage.getBoundingClientRect();
    W = rc.width; H = rc.height; dpr = fw ? 2 : Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cw = Math.max(4, Math.floor(W / ((fw ? stillCols : V.cols) * (S.dense || 1)))); ch = Math.round(cw * V.aspect);
    cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
    ox = (W - cols * cw) / 2; oy = (H - rows * ch) / 2;
    val = new Float32Array(cols * rows); tone = new Int8Array(cols * rows).fill(-1);
    scale = fw ? Math.min(W * 0.84 / U, H * 0.8 / MARK_H) : Math.min(W * 0.78 / U, H * 0.56 / MARK_H);
    cellU = cw / scale;
    cx = W / 2; cy = fw ? H * 0.5 : H * 0.43;
    stars = [];
    for (var i = 0; i < 70; i++) stars.push([hash(i, 1) * W, hash(i, 2) * H * 0.85, hash(i, 3) * 6.28, 0.3 + hash(i, 4)]);
    buildAtlas();
  }

  /* ---- Marks: a flat logo extruded into a slab ----------------------- */
  var CAP_PATH = 'M287.74,1196.66h470.67l-212.19,315.84h313.72l140.15-208.88,140.33,208.88h313.72l-212.19-315.84h470.32l-171.07-254h-298.7l149.08-222.18-157.13-232.97-234.35,348.92-234.35-348.92-157.13,232.97,149.26,222.18h-298.89l-171.25,254Z';
  var PAD = 10;
  var SLAB = 0.11;      /* half its thickness, set per mark */
  /* Each mark is drawn white on black into its own mask. U is its width in
     scene units, h the height to fit; inset adds the second line inside the
     edge; outline lights the edge itself, which fills small holes, so a
     detailed logo goes without, and a thin slab so its holes are not walled
     in by their own sides. */
  var MARKS = {
    capacity: { MW: 320, MH: 236, U: 2.2, h: 1.6, slab: 0.11, inset: true, outline: true, draw: function (g, MW, MH) {
      var s = (MW - 2 * PAD) / 1424.52;
      g.setTransform(s, 0, 0, s, MW / 2 - 1000 * s, MH / 2 - 999.75 * s);
      g.fill(new Path2D(CAP_PATH));
    } }
    /* Any logo works: give it src (a light-on-black PNG) and a draw that
       places the image, for example
       name: { MW: 480, MH: 480, U: 2.2, h: 2, slab: 0.03, inset: false, outline: false, src: 'logo.png',
               draw: function (g, MW, MH, img) { g.drawImage(img, PAD, PAD, MW - 2 * PAD, MH - 2 * PAD); } } */
    , labyrinth: { MW: 620, MH: 620, U: 2.2, h: 2.2, slab: 0.03, inset: false, outline: false, src: BASE + 'assets/clients/labyrinth-logo.png',
      draw: function (g, MW, MH, img) { g.drawImage(img, PAD, PAD, MW - 2 * PAD, MH - 2 * PAD); } }
    /* Real solids have no mask: their light is worked out from the ray. */
    , ball: { U: 2.2, h: 2.1, solid: true }, band: { U: 2.2, h: 1.7, solid: true }, pin: { U: 1.5, h: 2.1, solid: true }
  };
  var MW, MH, U, MARK_H, INSET, OUTLINE, dist, toMask;

  /* Fill the mark into a small mask, then a signed chamfer distance to its
     edge so the face can carry an outline and an inset line. */
  function buildMark(m, img) {
    MW = m.MW; MH = m.MH;
    var c = document.createElement('canvas'); c.width = MW; c.height = MH;
    var g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, MW, MH); g.fillStyle = '#fff';
    m.draw(g, MW, MH, img);
    var px = g.getImageData(0, 0, MW, MH).data, n = MW * MH;
    var din = new Float32Array(n), dout = new Float32Array(n);
    for (var i = 0; i < n; i++) { var on = px[i * 4] > 127; din[i] = on ? 1e6 : 0; dout[i] = on ? 0 : 1e6; }
    chamfer(din); chamfer(dout);
    var k = m.U / (MW - 2 * PAD);
    m.dist = new Float32Array(n);
    for (i = 0; i < n; i++) m.dist[i] = din[i] > 0 ? -din[i] * k : dout[i] * k;
    m.toMask = 1 / k;
  }
  function useMark(m) { MW = m.MW; MH = m.MH; U = m.U; MARK_H = m.h; SLAB = m.slab; INSET = m.inset; OUTLINE = m.outline; dist = m.dist; toMask = m.toMask; }
  function loadMarks() {
    return Promise.all(Object.keys(MARKS).map(function (key) {
      var m = MARKS[key];
      if (m.solid) return;
      if (!m.src) { buildMark(m); return; }
      return new Promise(function (done) {
        var img = new Image();
        img.onload = function () { buildMark(m, img); done(); };
        img.onerror = function () { done(); };
        img.src = m.src;
      });
    }));
  }
  function chamfer(d) {
    var x, y, i, v;
    for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) {
      i = y * MW + x; v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - MW] + 1);
        if (x > 0) v = Math.min(v, d[i - MW - 1] + 1.414);
        if (x < MW - 1) v = Math.min(v, d[i - MW + 1] + 1.414);
      }
      d[i] = v;
    }
    for (y = MH - 1; y >= 0; y--) for (x = MW - 1; x >= 0; x--) {
      i = y * MW + x; v = d[i];
      if (x < MW - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < MH - 1) {
        v = Math.min(v, d[i + MW] + 1);
        if (x < MW - 1) v = Math.min(v, d[i + MW + 1] + 1.414);
        if (x > 0) v = Math.min(v, d[i + MW - 1] + 1.414);
      }
      d[i] = v;
    }
  }
  function sdAt(lx, ly) {
    var mx = (lx * toMask + MW / 2) | 0, my = (MH / 2 - ly * toMask) | 0;
    if (mx < 0 || my < 0 || mx >= MW || my >= MH) return 1;
    return dist[my * MW + mx];
  }

  var R, oL, lamF, sheen;
  var L = (function () { var x = -0.3, y = 0.55, z = 0.78, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();

  function rot(yaw, pitch, roll) {
    var cy_ = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    /* R = Ry * Rx * Rz */
    return [
      cy_ * cr + sy * sp * sr, -cy_ * sr + sy * sp * cr, sy * cp,
      cp * sr, cp * cr, -sp,
      -sy * cr + cy_ * sp * sr, sy * sr + cy_ * sp * cr, cy_ * cp
    ];
  }
  function ap(m, x, y, z) { return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z]; }

  /* It sways on its own, and every nine seconds turns once all the way round. */
  function markPose(t) {
    var p = (t - 4) % 9 / 2.6, turn = t < 4 || p >= 1 ? 0 : Math.PI * (1 - Math.cos(Math.PI * p));
    R = rot(0.5 * Math.sin(t * 0.45) + turn, -0.22 + 0.1 * Math.sin(t * 0.37), 0.05 * Math.sin(t * 0.29));
    oL = [R[6] * D, R[7] * D, R[8] * D];
    lamF = 0.55 + 0.45 * Math.abs(R[2] * L[0] + R[5] * L[1] + R[8] * L[2]);
    sheen = 2.4 * Math.sin(t * 0.45 + turn);  /* where the light band crosses the face */
  }

  /* March the ray through the slab: the first sample lands on a face, any
     later hit is the extruded side. */
  function markLight(x, y) {
    var dx = R[0] * x + R[3] * y - R[6] * D, dy = R[1] * x + R[4] * y - R[7] * D, dz = R[2] * x + R[5] * y - R[8] * D;
    if (Math.abs(dz) < 1e-6) return 0;
    var ta = (SLAB - oL[2]) / dz, tb = (-SLAB - oL[2]) / dz, t0 = Math.min(ta, tb), dt = (Math.max(ta, tb) - t0) / 8;
    var glow = 0;
    for (var k = 0; k <= 8; k++) {
      var tt = t0 + dt * k, lx = oL[0] + dx * tt, ly = oL[1] + dy * tt, sd = sdAt(lx, ly);
      if (k === 0) {
        if (sd < 0) {
          /* outline and inset line are sized in cells so they survive the grid */
          var edge = OUTLINE ? 1 - clamp((-sd - 0.9 * cellU) / cellU) : 0, inner = INSET ? 1 - clamp((Math.abs(sd + 3.6 * cellU) - 0.35 * cellU) / (0.7 * cellU)) : 0;
          var b = lx * 0.8 + ly * 0.6 - sheen, band = Math.exp(-b * b * 3);
          var fill = ((OUTLINE ? 0.38 : 0.58) + 0.5 * band) * lamF;
          return Math.max(fill, edge * (0.85 + 0.15 * lamF), inner * (0.7 + 0.3 * band) * lamF);
        }
        if (OUTLINE && sd < cellU) glow = (1 - sd / cellU) * (0.7 + 0.3 * lamF);
      } else if (sd < 0) {
        var gx = sdAt(lx + 0.02, ly) - sdAt(lx - 0.02, ly), gy = sdAt(lx, ly + 0.02) - sdAt(lx, ly - 0.02), gl = Math.hypot(gx, gy) || 1;
        var nw = ap(R, gx / gl, gy / gl, 0);
        var lam = 0.35 + 0.65 * Math.abs(nw[0] * L[0] + nw[1] * L[1] + nw[2] * L[2]);
        return Math.max(glow, OUTLINE ? 0.16 + 0.42 * lam : 0.1 + 0.15 * lam);
      }
    }
    return glow;
  }


  /* ---- Solids: real 3D objects, lit the same way as the slabs ---------- */
  function ray(x, y) {
    var dx = R[0] * x + R[3] * y - R[6] * D, dy = R[1] * x + R[4] * y - R[7] * D, dz = R[2] * x + R[5] * y - R[8] * D, n = Math.hypot(dx, dy, dz);
    return [dx / n, dy / n, dz / n];
  }
  /* Print is flat: no turn, no sides, the same cells straight on with a soft
     diagonal fall of tone. Mask subjects only. */
  function flatLight(x, y) {
    if (sdAt(x, y) >= 0) return 0;
    return clamp(0.66 + 0.09 * (y - x * 0.6));
  }
  /* A mirror ball: rows of square facets, each with its own flat normal, and
     a few catching the light in turn. */
  var FACETS = 16;
  function ballLight(x, y) {
    var d = ray(x, y), b = oL[0] * d[0] + oL[1] * d[1] + oL[2] * d[2], disc = b * b - (D * D - 1);
    if (disc < 0) return 0;
    var t = -b - Math.sqrt(disc), px = oL[0] + d[0] * t, py = oL[1] + d[1] * t, pz = oL[2] + d[2] * t;
    var lat = Math.asin(py), rw = Math.floor((lat + Math.PI / 2) / Math.PI * FACETS), la = (rw + 0.5) / FACETS * Math.PI - Math.PI / 2;
    var cnt = Math.max(1, Math.round(Math.cos(la) * FACETS * 2)), f = (Math.atan2(pz, px) + Math.PI) / (2 * Math.PI) * cnt, col = Math.floor(f), lo = (col + 0.5) / cnt * 2 * Math.PI - Math.PI;
    var nw = ap(R, Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo));
    var s = clamp(nw[0] * L[0] + nw[1] * L[1] + nw[2] * L[2]), seed = rw * 131 + col, tw = hash(seed, Math.floor(now * 1.4 + hash(seed, 7) * 8));
    var gap = Math.abs(f - col - 0.5) > 0.42 ? 0.55 : 1;
    return clamp((0.14 + 0.32 * hash(seed, 3) + 0.62 * Math.pow(s, 5) + (tw > 0.93 ? 0.55 : 0)) * gap * (0.55 + 0.45 * Math.abs(nw[2])));
  }
  /* Sphere trace inside a bounding ball, then shade from the surface normal. */
  function march(sd, B, shade) {
    return function (x, y) {
      var d = ray(x, y), b = oL[0] * d[0] + oL[1] * d[1] + oL[2] * d[2], near = D * D - b * b;
      if (near > B * B) return 0;
      var h = Math.sqrt(B * B - near), t = -b - h, end = -b + h;
      for (var i = 0; i < 48 && t < end; i++) {
        var px = oL[0] + d[0] * t, py = oL[1] + d[1] * t, pz = oL[2] + d[2] * t, v = sd(px, py, pz);
        if (v < 0.004) {
          var e = 0.008, nx = sd(px + e, py, pz) - sd(px - e, py, pz), ny = sd(px, py + e, pz) - sd(px, py - e, pz), nz = sd(px, py, pz + e) - sd(px, py, pz - e), nl = Math.hypot(nx, ny, nz) || 1;
          var nw = ap(R, nx / nl, ny / nl, nz / nl);
          return shade(px, py, pz, 0.28 + 0.72 * Math.abs(nw[0] * L[0] + nw[1] * L[1] + nw[2] * L[2]), Math.pow(1 - Math.abs(nw[2]), 3));
        }
        t += v * 0.9;
      }
      return 0;
    };
  }
  /* A wristband: a flat ring laid at an angle, with a printed strip. */
  var TILT = 1.02, TC = Math.cos(TILT), TS = Math.sin(TILT);
  function bandSd(x, y, z) {
    var yy = TC * y - TS * z, zz = TS * y + TC * z, q = Math.hypot(x, zz) - 0.95, ax = Math.abs(q) - 0.02, ay = Math.abs(yy) - 0.3;
    return Math.hypot(Math.max(ax, 0), Math.max(ay, 0)) + Math.min(Math.max(ax, ay), 0) - 0.012;
  }
  function bandShade(x, y, z, lam, rim) {
    var yy = TC * y - TS * z, zz = TS * y + TC * z, a = Math.atan2(zz, x), strip = Math.abs(yy) < 0.1 && Math.sin(a * 44) > 0 ? 0.38 : 0, lip = Math.abs(yy) > 0.25 ? 0.3 : 0;
    return clamp(0.12 + 0.62 * lam + strip + lip + 0.3 * rim);
  }
  /* A bowling pin: three spheres blended, cut flat at the foot, two stripes. */
  function smin(a, b, k) { var h = clamp(0.5 + 0.5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); }
  function pinSd(x, y, z) {
    var r = Math.hypot(x, z), body = Math.hypot(r, y + 0.42) - 0.54, neck = Math.hypot(r * 1.3, (y - 0.36) * 0.62) - 0.14, head = Math.hypot(r, y - 0.74) - 0.27;
    return Math.max(smin(smin(body, neck, 0.3), head, 0.2), -(y + 0.92));
  }
  function pinShade(x, y, z, lam, rim) {
    var stripe = (y > 0.26 && y < 0.33) || (y > 0.4 && y < 0.47) ? 0.42 : 0;
    return clamp(0.14 + 0.66 * lam + stripe + 0.3 * rim);
  }
  var ballRay = ballLight, bandRay = march(bandSd, 1.08, bandShade), pinRay = march(pinSd, 1.12, pinShade);

  /* Each subject is the mark or an icon, drawn into its own mask from the
     grid in the Icons chapter and turned the same way. */
  ['ticketing', 'nightclubs', 'bars', 'festivals', 'socialising', 'enquiries', 'profiles', 'social', 'analytics', 'phone'].forEach(function (id) {
    var parts = document.querySelectorAll('[data-icon="' + id + '"] path');
    MARKS[id] = { MW: 320, MH: 320, U: 1.9, h: 1.9, slab: 0.07, inset: false, outline: true, draw: function (g, MW) {
      var s = (MW - 2 * PAD) / 48;
      g.setTransform(s, 0, 0, s, PAD, PAD);
      parts.forEach(function (p) { g.fill(new Path2D(p.getAttribute('d')), 'evenodd'); });
    } };
  });
  var SUBJECTS = [
    { id: 'mark',        label: 'Mark',    mark: 'capacity' },
    { id: 'ticketing',   label: 'Ticket',  mark: 'ticketing' },
    { id: 'nightclubs',  label: 'Speaker', mark: 'nightclubs' },
    { id: 'bars',        label: 'Glass',   mark: 'bars' },
    { id: 'festivals',   label: 'Tent',    mark: 'festivals' },
    { id: 'socialising', label: 'Target',  mark: 'socialising' },
    { id: 'enquiries',   label: 'Chat',    mark: 'enquiries' },
    { id: 'profiles',    label: 'Person',  mark: 'profiles' },
    { id: 'social',      label: 'Megaphone', mark: 'social' },
    { id: 'analytics',   label: 'Chart',   mark: 'analytics' },
    { id: 'phone',       label: 'Phone',   mark: 'phone' },
    { id: 'ball',        label: 'Mirror ball', mark: 'ball', ray: ballRay },
    { id: 'band',        label: 'Wristband', mark: 'band', ray: bandRay },
    { id: 'pin',         label: 'Pin',     mark: 'pin', ray: pinRay },
    { id: 'labyrinth',   label: 'Labyrinth', mark: 'labyrinth', tint: 'labyrinth', dense: 1.8 }
  ];
  var S = SUBJECTS[0], light = markLight, now = 0, ready = false, still = false, stillCols = 72, cut = 0.045;
  function useSubject() { useMark(MARKS[S.mark]); light = S.ray || markLight; }

  /* ---- Frame ----------------------------------------------------------- */
  function frame(t) {
    var n = cols * rows, sub = 0.25 / scale;
    now = t;
    markPose(t);
    for (var r = 0; r < rows; r++) {
      var py = oy + (r + 0.5) * ch;
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c, px = ox + (c + 0.5) * cw;
        var x = (px - cx) / scale, y = -(py - cy) / scale;
        var l = 0.25 * (light(x - cw * sub, y - ch * sub) + light(x + cw * sub, y - ch * sub) + light(x - cw * sub, y + ch * sub) + light(x + cw * sub, y + ch * sub));
        var hv = val[i] * HOLD; val[i] = l > hv ? l : hv;
        tone[i] = val[i] < cut ? -1 : Math.min(TONES - 1, Math.floor(val[i] * TONES));
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);

    for (var s = 0; !V.light && !S.tint && !still && s < stars.length; s++) {
      var st = stars[s];
      ctx.fillStyle = 'rgba(150,180,240,' + (0.08 + 0.14 * (0.5 + 0.5 * Math.sin(t * st[3] + st[2]))) + ')';
      ctx.fillRect(Math.round(st[0] * dpr), Math.round(st[1] * dpr), dpr, dpr);
    }

    /* binary flips its digits on each cell's own slow clock; the rest only
       change when the tone does */
    var flip = V.id === 'binary' || V.id === 'light' ? 0.6 : 0;
    for (var j = 0; j < n; j++) {
      var tj = tone[j];
      if (tj < 0) continue;
      var rr = (j / cols) | 0, cc = j - rr * cols;
      var vv = flip ? (hash(j, Math.floor(t * flip + hash(j, 5) * 9)) < 0.5 ? 0 : 1) : Math.floor(hash(j, tj >> 2) * 3);
      ctx.drawImage(atlas, tj * cwp, vv * chp, cwp, chp, Math.round((ox + cc * cw) * dpr), Math.round((oy + rr * ch) * dpr), cwp, chp);
    }
  }

  /* ---- Switches ------------------------------------------------------- */
  var subBar = document.getElementById('subjects'), bar = document.getElementById('variants');
  function pills(el, list, pick) {
    list.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = v.label; b.dataset.id = v.id;
      b.addEventListener('click', function () { pick(v.id); });
      el.appendChild(b);
    });
  }
  function find(list, id) { return list.filter(function (v) { return v.id === id; })[0]; }
  function sync() {
    if (V.light) stage.dataset.theme = 'light'; else delete stage.dataset.theme;
    if (S.tint) stage.dataset.brand = S.tint; else delete stage.dataset.brand;
    Array.prototype.forEach.call(subBar.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === S.id)); });
    Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === V.id)); });
    if (ready) { resize(); if (reduced) frame(1.3); }
  }
  function use(id) { V = find(VARIANTS, id) || V; sync(); }
  function subject(id) { S = find(SUBJECTS, id) || S; if (ready) useSubject(); sync(); }
  if (stage) { pills(subBar, SUBJECTS, subject); pills(bar, VARIANTS, use); }
  if (stage) (function () {
    var parts = location.hash.slice(1).split('/');
    S = find(SUBJECTS, parts[0]) || find(SUBJECTS, parts[1]) || SUBJECTS[0];
    V = find(VARIANTS, parts[1]) || find(VARIANTS, parts[0]) || VARIANTS[0];
    sync();
  })();

  var t0 = 0;
  /* This page is long, so the stage only draws while it is on screen. */
  var inView = false;
  if (stage) new IntersectionObserver(function (e) { inView = e[0].isIntersecting; }).observe(stage);
  function loop(now) {
    if (!t0) t0 = now;
    if (inView) frame((now - t0) / 1000);
    requestAnimationFrame(loop);
  }

  /* Print pieces use a still of the same render: canvas[data-tile="subject/style"],
     with data-cols the cell count and the box the shape. They are flat, because
     the turned render does not survive print; data-live keeps it for screens. */
  function stills() {
    var keep = [V, S, cv, ctx];
    still = true;
    Array.prototype.forEach.call(document.querySelectorAll('canvas[data-tile]'), function (c) {
      var p = c.dataset.tile.split('/'), w = 1000, h = Math.round(w * (c.offsetHeight / c.offsetWidth || 1));
      stillCols = +c.dataset.cols || 72;
      S = find(SUBJECTS, p[0]) || S; V = find(VARIANTS, p[1]) || V;
      cv = document.createElement('canvas'); ctx = cv.getContext('2d');
      useSubject();
      /* data-live keeps the turned render, for screens only */
      var live = 'live' in c.dataset;
      if (!live) light = flatLight;
      cut = live ? 0.045 : 0.28;
      resize(w, h); frame(+c.dataset.t || 1.3);
      c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0);
    });
    still = false; cut = 0.045;
    V = keep[0]; S = keep[1]; cv = keep[2]; ctx = keep[3];
  }

  document.fonts.load('500 12px "Geist Mono"').then(function () {
    return Promise.all([loadMarks(), document.fonts.load('600 12px "Geist Mono"')]);
  }).then(function () {
    stills();
    if (!stage) return;
    ready = true;
    useSubject();
    resize();
    new ResizeObserver(function () { resize(); if (reduced) frame(1.3); }).observe(stage);
    if (reduced) frame(1.3); else requestAnimationFrame(loop);
  });
})();

/* An icon through the tiles: white on black at its box's own shape, so the
   tile layer crops nothing. */
document.querySelectorAll('img[data-glyph]').forEach(function (img) {
  var box = img.parentNode.getBoundingClientRect(), parts = document.querySelectorAll('[data-icon="' + img.dataset.glyph + '"] path');
  var h = 48 / 0.72, w = h * box.width / box.height, x = 24 - w / 2, y = 24 - h / 2;
  var art = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>';
  parts.forEach(function (p) { art += '<path fill="' + (p.classList.contains('lit') ? '#8a8a8a' : '#fff') + '" fill-rule="evenodd" d="' + p.getAttribute('d') + '"/>'; });
  img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [x, y, w, h].join(' ') + '" width="' + Math.round(1000 * w / h) + '" height="1000">' + art + '</svg>');
});
