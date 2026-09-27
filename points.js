/* ==========================================================================
   Capacity points. Recognisable objects built from points that you can pick
   up and turn.

   Usage: any element with data-points="<object>" becomes a stage. Optional
   attributes: data-zoom, data-yaw, data-pitch, data-auto="spin" (round
   objects turn; everything else sways about its best side; "still" holds
   its pose and moves only with the pointer), and
   data-points-style="dot", which paints the object in the site's own
   halftone: the same ordered grid, dot curve and greys as the photographs
   (dotScreen in site.js), with brand blue kept for lit accents only.

   By default each stage gets its own canvas. A page that carries many stages
   sets data-points-shared on <body>, and then one fixed canvas and one GL
   context draw every stage through its own viewport, so there is no limit
   on how many a page can hold.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;
  function rnd() { return Math.random(); }

  /* ======================================================================
     Geometry kit. Every object is sampled onto its surface as points with a
     normal (for light), a tone (for printed detail) and a part (for anything
     that moves on its own, like a jog wheel).
     ====================================================================== */

  function Geo() { this.p = []; this.n = []; this.a = []; this.parts = [null]; }

  function xform(xf, v, isNormal) {
    if (!xf) return v;
    var x = v[0], y = v[1], z = v[2], c, s, t;
    if (xf.k) {
      if (isNormal) { x /= xf.k[0]; y /= xf.k[1]; z /= xf.k[2]; }
      else { x *= xf.k[0]; y *= xf.k[1]; z *= xf.k[2]; }
    }
    if (xf.rx) { c = Math.cos(xf.rx); s = Math.sin(xf.rx); t = y * c - z * s; z = y * s + z * c; y = t; }
    if (xf.ry) { c = Math.cos(xf.ry); s = Math.sin(xf.ry); t = x * c + z * s; z = -x * s + z * c; x = t; }
    if (xf.rz) { c = Math.cos(xf.rz); s = Math.sin(xf.rz); t = x * c - y * s; y = x * s + y * c; x = t; }
    if (isNormal) {
      var l = Math.sqrt(x * x + y * y + z * z) || 1;
      return [x / l, y / l, z / l];
    }
    var k = xf.s || 1, T = xf.t || [0, 0, 0];
    return [x * k + T[0], y * k + T[1], z * k + T[2]];
  }
  /* Transforms compose right to left: the last one listed is applied first. */
  function chain(list, v, isNormal) {
    for (var i = list.length - 1; i >= 0; i--) v = xform(list[i], v, isNormal);
    return v;
  }
  Geo.prototype.add = function (pos, nrm, tone, o) {
    var xs = o && o.xf ? (o.xf.length !== undefined ? o.xf : [o.xf]) : [];
    var P = chain(xs, pos, false), N = chain(xs, nrm, true);
    this.p.push(P[0], P[1], P[2]);
    this.n.push(N[0], N[1], N[2]);
    this.a.push(tone, (o && o.part) || 0, rnd());
  };
  Geo.prototype.part = function (def) { this.parts.push(def); return this.parts.length - 1; };

  function tf(v) { return function () { return v; }; }

  /* Lathe: a profile of [radius, height] pairs spun round the y axis. */
  function lathe(g, prof, count, o) {
    o = o || {};
    var segs = [], tot = 0;
    for (var i = 0; i < prof.length - 1; i++) {
      var A = prof[i], B = prof[i + 1];
      var dr = B[0] - A[0], dy = B[1] - A[1], len = Math.sqrt(dr * dr + dy * dy);
      tot += len * ((A[0] + B[0]) * 0.5 + 0.015);
      segs.push({ A: A, dr: dr, dy: dy, len: len, cum: tot });
    }
    var th0 = o.th0 || 0, th1 = o.th1 === undefined ? TAU : o.th1;
    var made = 0, guard = count * 6;
    while (made < count && guard-- > 0) {
      var r = rnd() * tot, lo = 0, hi = segs.length - 1;
      while (lo < hi) { var m = (lo + hi) >> 1; if (segs[m].cum < r) lo = m + 1; else hi = m; }
      var S = segs[lo];
      if (!S.len) continue;
      var t = rnd(), rr = S.A[0] + S.dr * t, yy = S.A[1] + S.dy * t;
      var th = th0 + rnd() * (th1 - th0), ct = Math.cos(th), st = Math.sin(th);
      var nr = S.dy / S.len, ny = -S.dr / S.len;
      var pos = [rr * ct, yy, rr * st];
      if (o.skip && o.skip(pos, rr, yy, th)) continue;
      g.add(pos, [nr * ct, ny, nr * st], o.tone ? o.tone(rr, yy, th, pos) : 1, o);
      made++;
    }
  }

  function sphere(g, c, r, count, o) {
    o = o || {};
    var made = 0, guard = count * 6;
    while (made < count && guard-- > 0) {
      var z = rnd() * 2 - 1, ph = rnd() * TAU, q = Math.sqrt(1 - z * z);
      var d = [q * Math.cos(ph), z, q * Math.sin(ph)];
      if (o.skip && o.skip(d)) continue;
      g.add([c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r], d, o.tone ? o.tone(d) : 1, o);
      made++;
    }
  }

  function box(g, c, h, count, o) {
    o = o || {};
    var ax = h[1] * h[2], ay = h[0] * h[2], az = h[0] * h[1], tot = 2 * (ax + ay + az);
    for (var i = 0; i < count; i++) {
      var r = rnd() * tot, sgn = rnd() < 0.5 ? -1 : 1, u = rnd() * 2 - 1, v = rnd() * 2 - 1, pos, nrm;
      if (r < 2 * ax) { pos = [sgn * h[0], u * h[1], v * h[2]]; nrm = [sgn, 0, 0]; }
      else if (r < 2 * (ax + ay)) { pos = [u * h[0], sgn * h[1], v * h[2]]; nrm = [0, sgn, 0]; }
      else { pos = [u * h[0], v * h[1], sgn * h[2]]; nrm = [0, 0, sgn]; }
      var P = [c[0] + pos[0], c[1] + pos[1], c[2] + pos[2]];
      g.add(P, nrm, o.tone ? o.tone(P, nrm) : 1, o);
    }
  }

  /* A tube along any curve f(t), t in [0, 1]. */
  function tube(g, f, radius, count, o) {
    o = o || {};
    for (var i = 0; i < count; i++) {
      var t = rnd(), P = f(t), Q = f(Math.min(1, t + 0.002)), R = f(Math.max(0, t - 0.002));
      var T = [Q[0] - R[0], Q[1] - R[1], Q[2] - R[2]];
      var tl = Math.sqrt(T[0] * T[0] + T[1] * T[1] + T[2] * T[2]) || 1;
      T = [T[0] / tl, T[1] / tl, T[2] / tl];
      var U = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      var B = [T[1] * U[2] - T[2] * U[1], T[2] * U[0] - T[0] * U[2], T[0] * U[1] - T[1] * U[0]];
      var bl = Math.sqrt(B[0] * B[0] + B[1] * B[1] + B[2] * B[2]) || 1;
      B = [B[0] / bl, B[1] / bl, B[2] / bl];
      var N = [B[1] * T[2] - B[2] * T[1], B[2] * T[0] - B[0] * T[2], B[0] * T[1] - B[1] * T[0]];
      var a = rnd() * TAU, ca = Math.cos(a), sa = Math.sin(a);
      var n = [N[0] * ca + B[0] * sa, N[1] * ca + B[1] * sa, N[2] * ca + B[2] * sa];
      g.add([P[0] + n[0] * radius, P[1] + n[1] * radius, P[2] + n[2] * radius], n, o.tone ? o.tone(t) : 1, o);
    }
  }
  function polyline(pts) {
    var lens = [0], tot = 0;
    for (var i = 1; i < pts.length; i++) {
      tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      lens.push(tot);
    }
    return function (t) {
      var d = t * tot, i = 1;
      while (i < lens.length - 1 && lens[i] < d) i++;
      var k = (d - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1);
      var A = pts[i - 1], B = pts[i];
      return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k];
    };
  }

  /* Extrude: any 2D shape drawn on a canvas becomes a solid slab. Faces take
     their tone from the pixel, so printing survives, and the sides take
     their normal from the shape's own edge. */
  function maskOf(canvas) {
    return { w: canvas.width, h: canvas.height, d: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data };
  }
  function extrude(g, M, width, depth, count, o) {
    o = o || {};
    var w = M.w, h = M.h, d = M.d, inside = [], edge = [];
    function A(x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3]; }
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (A(x, y) < 128) continue;
        var i = y * w + x;
        inside.push(i);
        if (A(x + 1, y) < 128 || A(x - 1, y) < 128 || A(x, y + 1) < 128 || A(x, y - 1) < 128) edge.push(i);
      }
    }
    if (!inside.length) return;
    var s = width / w;
    var faces = o.oneFace ? 1 : 2;
    var faceA = inside.length * s * s * faces, sideA = edge.length * s * 2 * depth;
    var nFace = Math.round(count * faceA / (faceA + sideA)), nSide = count - nFace;
    var sideTone = o.sideTone === undefined ? 0.7 : o.sideTone;
    for (var k = 0; k < nFace; k++) {
      var id = inside[(rnd() * inside.length) | 0];
      var px = id % w + rnd(), py = ((id / w) | 0) + rnd();
      var front = o.oneFace ? 1 : (k & 1 ? 1 : -1);
      var tone = o.faceTone ? o.faceTone(d[id * 4] / 255, front) : 1;
      g.add([(px - w / 2) * s, (h / 2 - py) * s, front * depth], [0, 0, front], tone, o);
    }
    for (var e = 0; e < nSide; e++) {
      var ed = edge[(rnd() * edge.length) | 0];
      var ex = ed % w, ey = (ed / w) | 0;
      var gx = A(ex + 1, ey) - A(ex - 1, ey), gy = A(ex, ey + 1) - A(ex, ey - 1);
      var gl2 = Math.sqrt(gx * gx + gy * gy) || 1;
      g.add([(ex + rnd() - w / 2) * s, (h / 2 - ey - rnd()) * s, (rnd() * 2 - 1) * depth],
            [-gx / gl2, gy / gl2, 0], sideTone, o);
    }
  }
  function pad(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  /* Centre the object, scale it to a unit radius, and carry every moving
     part's pivot through the same transform. */
  function finish(g) {
    var p = g.p, n = p.length / 3;
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (var i = 0; i < n; i++) for (var j = 0; j < 3; j++) {
      var v = p[i * 3 + j];
      if (v < mn[j]) mn[j] = v;
      if (v > mx[j]) mx[j] = v;
    }
    var c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2], rad = 0;
    for (var k = 0; k < n; k++) {
      var dx = p[k * 3] - c[0], dy = p[k * 3 + 1] - c[1], dz = p[k * 3 + 2] - c[2];
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > rad) rad = d2;
    }
    rad = Math.sqrt(rad) || 1;
    var out = new Float32Array(n * 9);
    for (var q = 0; q < n; q++) {
      out[q * 9] = (p[q * 3] - c[0]) / rad;
      out[q * 9 + 1] = (p[q * 3 + 1] - c[1]) / rad;
      out[q * 9 + 2] = (p[q * 3 + 2] - c[2]) / rad;
      out[q * 9 + 3] = g.n[q * 3]; out[q * 9 + 4] = g.n[q * 3 + 1]; out[q * 9 + 5] = g.n[q * 3 + 2];
      out[q * 9 + 6] = g.a[q * 3]; out[q * 9 + 7] = g.a[q * 3 + 1]; out[q * 9 + 8] = g.a[q * 3 + 2];
    }
    var partA = new Float32Array(32), partB = new Float32Array(32);
    for (var pi = 1; pi < g.parts.length && pi < 8; pi++) {
      var P = g.parts[pi];
      var pc = P.c || c;
      partA[pi * 4] = (pc[0] - c[0]) / rad;
      partA[pi * 4 + 1] = (pc[1] - c[1]) / rad;
      partA[pi * 4 + 2] = (pc[2] - c[2]) / rad;
      partA[pi * 4 + 3] = P.spin || 0;
      partB[pi * 4] = (P.bob || 0) / rad;
      partB[pi * 4 + 1] = P.pulse || 0;
      partB[pi * 4 + 2] = P.phase || 0;
      partB[pi * 4 + 3] = P.rock ? 1 : 0;
    }
    return { data: out, count: n, partA: partA, partB: partB };
  }

  /* ======================================================================
     The objects.
     ====================================================================== */

  var D = window.innerWidth < 700 ? 0.7 : 1;
  var OBJECTS = {};

  /* ---- Festivals: the big top ----------------------------------------- */
  OBJECTS.tent = function (big) {
    var g = new Geo(), N = 16, dens = big === false ? 1 : 1.5;
    function stripe(th) {
      var a = ((th % TAU) + TAU) % TAU;
      return Math.floor(a / TAU * N) % 2 ? 1.05 : 0.26;
    }
    var door = Math.PI / 2;
    lathe(g, [[1.0, 0], [1.0, 0.56]], 15000 * dens * D, {
      tone: function (r, y, th) { return stripe(th) * 0.92; },
      skip: function (p, r, y) { return Math.abs(Math.atan2(p[2], p[0]) - door) < 0.2 && y < 0.44; }
    });
    lathe(g, [[1.1, 0.60], [0.84, 0.84], [0.56, 1.10], [0.28, 1.38], [0.07, 1.60], [0, 1.64]], 24000 * dens * D, {
      tone: function (r, y, th) { return stripe(th); }
    });
    lathe(g, [[1.1, 0.61], [1.1, 0.47]], 4200 * dens * D, {
      tone: function (r, y, th) { return stripe(th) * 1.05; },
      skip: function (p, r, y, th) { return y < 0.61 - 0.13 * Math.abs(Math.sin(th * N / 2)); }
    });
    tube(g, polyline([[0, 1.6, 0], [0, 1.98, 0]]), 0.013, 900 * dens * D, { tone: tf(0.8) });
    for (var f = 0; f < 1300 * dens * D; f++) {
      var u = rnd(), v = rnd();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      g.add([0.3 * u, 1.97 - 0.13 * v - 0.065 * u, 0.012 * (rnd() - 0.5)], [0, 0, 1], 1.15);
    }
    var ropes = 12, ropePts = [];
    for (var k = 0; k < ropes; k++) {
      var th = (k + 0.5) / ropes * TAU + 0.06;
      if (Math.abs(((th - door + Math.PI) % TAU) - Math.PI) < 0.3) continue;
      var a0 = [1.1 * Math.cos(th), 0.6, 1.1 * Math.sin(th)], a1 = [1.78 * Math.cos(th), 0, 1.78 * Math.sin(th)];
      ropePts.push([a0, a1]);
      tube(g, polyline([a0, a1]), 0.006, 520 * dens * D, { tone: tf(0.5) });
    }
    for (var b = 0; b < ropePts.length; b++) {
      var R0 = ropePts[b], R1 = ropePts[(b + 1) % ropePts.length];
      var s0 = [R0[0][0] + (R0[1][0] - R0[0][0]) * 0.35, 0.39, R0[0][2] + (R0[1][2] - R0[0][2]) * 0.35];
      var s1 = [R1[0][0] + (R1[1][0] - R1[0][0]) * 0.35, 0.39, R1[0][2] + (R1[1][2] - R1[0][2]) * 0.35];
      for (var q = 1; q < 8; q++) {
        var t = q / 8;
        sphere(g, [s0[0] + (s1[0] - s0[0]) * t, s0[1] - Math.sin(t * Math.PI) * 0.09, s0[2] + (s1[2] - s0[2]) * t],
               0.018, 70 * dens, { tone: tf(1.5) });
      }
    }
    for (var gr = 0; gr < 6500 * dens * D; gr++) {
      var ra = Math.sqrt(rnd()) * 1.85, ta = rnd() * TAU;
      g.add([ra * Math.cos(ta), 0, ra * Math.sin(ta)], [0, 1, 0], 0.22 * (1 - ra / 2.1));
    }
    return finish(g);
  };
  OBJECTS.tentSmall = function () { return OBJECTS.tent(false); };

  /* ---- Nightclubs: two players and a mixer ------------------------------ */
  function playerScreen() {
    return pad(640, 360, function (c, w, h) {
      c.fillStyle = 'rgb(70,70,70)';
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgb(255,255,255)';
      /* Two waveforms, the loaded track and its overview. */
      for (var x = 20; x < w - 20; x += 3) {
        var k = x / w;
        var a = (0.35 + 0.65 * Math.abs(Math.sin(k * 41) * Math.sin(k * 13 + 1))) * 46;
        c.fillRect(x, 150 - a, 2, a * 2);
        var o = (0.3 + 0.7 * Math.abs(Math.sin(k * 9 + 2))) * 12;
        c.fillRect(x, 262 - o, 2, o * 2);
      }
      c.fillRect(w / 2 - 2, 90, 4, 120);
      c.fillRect(20, 24, 260, 18);
      c.fillRect(20, 52, 150, 12);
      c.fillRect(430, 300, 190, 40);
      c.fillRect(20, 300, 120, 40);
      c.fillRect(170, 300, 80, 40);
    });
  }
  function player(g, cx, jogPart) {
    box(g, [cx, 0.05, 0], [0.5, 0.05, 0.56], 9000 * D, {
      tone: function (P, n) { return n[1] > 0.5 ? 0.42 : 0.3; }
    });
    /* The jog: brushed ring, dimpled platter, lit centre display. */
    lathe(g, [[0.35, 0.0], [0.35, 0.03], [0.32, 0.045], [0.14, 0.05], [0.0, 0.05]], 13000 * D, {
      part: jogPart, xf: { t: [cx - 0.02, 0.1, 0.1] },
      tone: function (r, y) {
        if (r > 0.3) return 1.05;
        if (r < 0.1) return r > 0.075 ? 1.4 : 0.9;
        return (((r * 38) % 1) < 0.25) ? 0.62 : 0.34;
      }
    });
    /* The tilted screen at the back, waveform and all. */
    extrude(g, maskOf(playerScreen()), 0.74, 0.012, 11000 * D, {
      xf: { t: [cx, 0.3, -0.5], rx: -0.42 },
      faceTone: function (v) { return v > 0.8 ? 1.35 : 0.34; }, sideTone: 0.4
    });
    box(g, [cx, 0.19, -0.56], [0.38, 0.1, 0.04], 1500 * D, { tone: tf(0.3) });
    /* Hot cue pads. */
    for (var i = 0; i < 8; i++) {
      box(g, [cx - 0.3 + i * 0.086, 0.104, -0.2], [0.03, 0.005, 0.02], 160 * D, { tone: tf(i % 2 ? 1.0 : 1.2) });
    }
    /* Play and cue, the two lit rings every DJ looks for. */
    lathe(g, [[0.052, 0], [0.052, 0.012], [0, 0.012]], 700 * D, { xf: { t: [cx - 0.4, 0.1, 0.44] }, tone: tf(1.45) });
    lathe(g, [[0.052, 0], [0.052, 0.012], [0, 0.012]], 700 * D, { xf: { t: [cx - 0.4, 0.1, 0.3] }, tone: tf(1.3) });
    /* Tempo fader. */
    box(g, [cx + 0.42, 0.101, 0.22], [0.012, 0.002, 0.2], 400 * D, { tone: tf(0.25) });
    box(g, [cx + 0.42, 0.12, 0.16], [0.036, 0.018, 0.026], 500 * D, { tone: tf(1.1) });
    /* The left column of buttons. */
    for (var b = 0; b < 5; b++) {
      box(g, [cx - 0.42, 0.104, -0.16 + b * 0.08], [0.035, 0.004, 0.022], 120 * D, { tone: tf(0.8) });
    }
  }
  function mixer(g) {
    box(g, [0, 0.06, 0.02], [0.37, 0.06, 0.52], 10000 * D, {
      tone: function (P, n) { return n[1] > 0.5 ? 0.4 : 0.28; }
    });
    var chans = [-0.21, -0.07, 0.07, 0.21];
    for (var c = 0; c < chans.length; c++) {
      var x = chans[c];
      for (var k = 0; k < 5; k++) {
        lathe(g, [[0.022, 0], [0.022, 0.026], [0, 0.026]], 170 * D, { xf: { t: [x, 0.12, -0.4 + k * 0.08] }, tone: tf(0.85) });
      }
      /* Cue buttons light orange in the real thing; here they are the
         brightest thing on the mixer. */
      box(g, [x, 0.124, 0.02], [0.024, 0.004, 0.014], 140 * D, { tone: tf(1.4) });
      box(g, [x, 0.121, 0.22], [0.006, 0.002, 0.1], 180 * D, { tone: tf(0.25) });
      box(g, [x, 0.138, 0.2], [0.022, 0.016, 0.018], 220 * D, { tone: tf(1.05) });
      box(g, [x + 0.04, 0.122, -0.26], [0.004, 0.002, 0.13], 200 * D, {
        tone: function (P) { return ((P[2] * 60) % 1 + 1) % 1 < 0.5 ? 1.35 : 0.2; }
      });
    }
    box(g, [0, 0.121, 0.43], [0.1, 0.002, 0.006], 160 * D, { tone: tf(0.25) });
    box(g, [0, 0.136, 0.43], [0.018, 0.014, 0.022], 200 * D, { tone: tf(1.1) });
    box(g, [0.3, 0.122, -0.18], [0.05, 0.002, 0.045], 400 * D, { tone: tf(1.2) });
    tube(g, polyline([[-0.33, 0.12, -0.46], [-0.33, 0.34, -0.5]]), 0.008, 350 * D, { tone: tf(0.7) });
  }
  OBJECTS.cdj = function () {
    var g = new Geo();
    var jL = [-0.94, 0.1, 0.1], jR = [0.9, 0.1, 0.1];
    var pL = g.part({ c: jL, spin: 0.7 });
    var pR = g.part({ c: jR, spin: -0.5 });
    player(g, -0.92, pL);
    player(g, 0.92, pR);
    mixer(g);
    return finish(g);
  };

  /* ---- Bars: the glass -------------------------------------------------- */
  OBJECTS.cocktail = function () {
    var g = new Geo();
    lathe(g, [[0, 0], [0.42, 0], [0.42, 0.024], [0.07, 0.055], [0.036, 0.09], [0.036, 0.86], [0.66, 1.42], [0.64, 1.425]], 26000 * D, {
      tone: function (r, y) { return (y > 0.86 && y < 1.28) ? 0.95 : 0.5; }
    });
    lathe(g, [[0.5, 1.28], [0, 1.28]], 7000 * D, { tone: function (r) { return 0.75 + 0.35 * (1 - r / 0.5); } });
    sphere(g, [0.1, 1.14, 0.06], 0.075, 1500 * D, { tone: tf(1.2) });
    sphere(g, [0.1, 1.14, 0.06], 0.025, 250 * D, { tone: tf(0.4) });
    tube(g, polyline([[-0.14, 1.58, -0.06], [0.22, 1.02, 0.1]]), 0.008, 700 * D, { tone: tf(1.0) });
    return finish(g);
  };

  /* ---- Gaming venues: the lane ------------------------------------------ */
  OBJECTS.bowling = function () {
    var g = new Geo();
    var pin = [[0, 0], [0.19, 0], [0.245, 0.12], [0.3, 0.4], [0.265, 0.66], [0.155, 0.95], [0.12, 1.07], [0.17, 1.27], [0.17, 1.37], [0.12, 1.47], [0, 1.52]];
    function pinTone(r, y) { return ((y > 0.99 && y < 1.04) || (y > 1.08 && y < 1.13)) ? 1.3 : 0.8; }
    lathe(g, pin, 17000 * D, { xf: { t: [-0.32, 0, -0.05] }, tone: pinTone });
    lathe(g, pin, 15000 * D, { xf: { t: [0.18, 0, -0.52] }, tone: pinTone });
    lathe(g, pin, 13000 * D, { xf: { t: [-0.78, 0, -0.62] }, tone: pinTone });
    var holes = [[0.15, 0.78, 0.6], [-0.08, 0.84, 0.54], [0.05, 0.62, 0.78]].map(function (h) {
      var l = Math.hypot(h[0], h[1], h[2]); return [h[0] / l, h[1] / l, h[2] / l];
    });
    sphere(g, [0.62, 0.42, 0.34], 0.42, 16000 * D, {
      tone: function (d) { return 0.72 + 0.12 * Math.sin(d[0] * 9 + d[1] * 5); },
      skip: function (d) {
        for (var i = 0; i < holes.length; i++) {
          if (d[0] * holes[i][0] + d[1] * holes[i][1] + d[2] * holes[i][2] > (i === 2 ? 0.985 : 0.99)) return true;
        }
        return false;
      }
    });
    box(g, [0, -0.02, 0], [1.4, 0.02, 1.0], 7000 * D, {
      tone: function (P, n) { return n[1] > 0.5 ? 0.18 + 0.08 * ((P[0] * 9 % 1 + 1) % 1 < 0.5 ? 1 : 0) : 0.1; }
    });
    return finish(g);
  };

  /* ---- Live events: the mic --------------------------------------------- */
  OBJECTS.mic = function () {
    var g = new Geo();
    var tilt = { rz: -0.42, t: [0, 0.1, 0] };
    sphere(g, [0, 1.28, 0], 0.28, 15000 * D, {
      xf: tilt,
      tone: function (d) {
        var th = Math.atan2(d[2], d[0]), ph = Math.acos(Math.max(-1, Math.min(1, d[1])));
        var a = Math.abs(((th / TAU * 16) % 1 + 1) % 1 - 0.5) < 0.09;
        var b = Math.abs(((ph / Math.PI * 12) % 1) - 0.5) < 0.09;
        return (a || b) ? 1.15 : 0.42;
      },
      skip: function (d) { return d[1] < -0.55; }
    });
    lathe(g, [[0.255, 1.02], [0.255, 1.12]], 2200 * D, { xf: tilt, tone: tf(1.1) });
    lathe(g, [[0, 0.22], [0.12, 0.22], [0.2, 0.98], [0.24, 1.02]], 12000 * D, { xf: tilt, tone: tf(0.68) });
    box(g, [0.19, 0.62, 0], [0.02, 0.06, 0.03], 500 * D, { xf: [tilt, { rz: -0.1 }], tone: tf(1.2) });
    tube(g, function (t) {
      return [Math.sin(t * 3.4) * 0.35 * t + 0.1 * t, 0.22 - t * 0.95, Math.cos(t * 2.4) * 0.25 * t];
    }, 0.02, 3000 * D, { xf: tilt, tone: tf(0.4) });
    return finish(g);
  };

  /* ---- Icons: extruded from the brand files, or from a stroke glyph ------ */
  var IMG = {};
  function loadImage(src, cb) {
    if (IMG[src] !== undefined) { if (IMG[src]) cb(IMG[src]); return; }
    IMG[src] = null;
    var img = new Image();
    img.onload = function () { IMG[src] = img; cb(img); };
    img.onerror = function () { IMG[src] = false; };
    img.src = src;
  }
  var ICON_SRC = ['assets/brands/instagram.svg', 'assets/brands/tiktok.svg', 'assets/brands/whatsapp.svg'];
  ICON_SRC.forEach(function (s) { loadImage(s, function () {}); });

  /* Integrations: the tools a venue already runs, orbiting the one place
     they all land. The only object that uses the mark, because here the
     mark is the point. */
  var MARK_D = 'M287.74,1196.66h470.67l-212.19,315.84h313.72l140.15-208.88,140.33,208.88h313.72l-212.19-315.84h470.32l-171.07-254h-298.7l149.08-222.18-157.13-232.97-234.35,348.92-234.35-348.92-157.13,232.97,149.26,222.18h-298.89l-171.25,254Z';
  var HUB_SRC = ['instagram', 'gmail', 'whatsapp', 'google', 'tiktok', 'facebook', 'ga4', 'snapchat'].map(function (n) { return 'assets/brands/' + n + '.svg'; });
  var hubWanted = false;
  OBJECTS.hub = function () {
    if (!hubWanted) { hubWanted = true; HUB_SRC.forEach(function (s) { loadImage(s, function () {}); }); }
    for (var j = 0; j < HUB_SRC.length; j++) if (IMG[HUB_SRC[j]] === null || IMG[HUB_SRC[j]] === undefined) return null;
    var g = new Geo();
    var mark = maskOf(pad(420, 310, function (c, w, h) {
      var k = Math.min(w / 1520, h / 1120);
      c.translate((w - 1520 * k) / 2, (h - 1120 * k) / 2);
      c.scale(k, k);
      c.translate(-240, -440);
      c.fillStyle = '#fff';
      c.fill(new Path2D(MARK_D));
    }));
    extrude(g, mark, 0.95, 0.07, 26000 * D, { faceTone: tf(1.35), sideTone: 0.9 });
    var ring = g.part({ c: [0, 0, 0], spin: 0.32 });
    var n = HUB_SRC.length;
    for (var i = 0; i < n; i++) {
      var img = IMG[HUB_SRC[i]];
      if (!img) continue;
      var a = i / n * TAU;
      var ic = maskOf(pad(200, 200, function (c, w, h) { c.drawImage(img, 8, 8, w - 16, h - 16); }));
      extrude(g, ic, 0.36, 0.03, 6000 * D, {
        part: ring, xf: { t: [Math.cos(a) * 1.32, Math.sin(i * 1.7) * 0.12, Math.sin(a) * 1.32], ry: -a + Math.PI / 2 },
        faceTone: tf(0.95), sideTone: 0.6
      });
    }
    /* The orbit itself, faint, so the icons read as travelling round. */
    for (var k = 0; k < 2600 * D; k++) {
      var t = rnd() * TAU;
      g.add([Math.cos(t) * 1.32, 0, Math.sin(t) * 1.32], [0, 1, 0], 0.22, { part: ring });
    }
    return finish(g);
  };

  OBJECTS.socials = function () {
    for (var j = 0; j < ICON_SRC.length; j++) if (!IMG[ICON_SRC[j]]) return null;
    var g = new Geo();
    var xs = [-1.18, 0, 1.18];
    for (var i = 0; i < 3; i++) {
      var img = IMG[ICON_SRC[i]];
      var mask = pad(360, 360, function (c, w, h) { c.drawImage(img, 12, 12, w - 24, h - 24); });
      var c = [xs[i], i === 1 ? 0.12 : 0, 0];
      var part = g.part({ c: c, spin: 0.9, phase: i * 1.9, bob: 0.05, rock: true });
      extrude(g, maskOf(mask), 0.95, 0.09, 26000 * D, { part: part, xf: { t: c }, sideTone: 0.62, faceTone: tf(1.0) });
    }
    return finish(g);
  };

  /* A stroke glyph in the same 24 unit grid as the site's icon set. */
  function glyph(paths, circles, size) {
    return pad(size, size, function (c, w) {
      var k = w / 24;
      c.scale(k, k);
      c.strokeStyle = '#fff';
      c.lineWidth = 2.1;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      paths.forEach(function (d) { c.stroke(new Path2D(d)); });
      circles.forEach(function (ci) { c.beginPath(); c.arc(ci[0], ci[1], ci[2], 0, TAU); c.stroke(); });
    });
  }

  /* ---- Customers: the people glyph, not a sculpted head ------------------ */
  OBJECTS.people = function () {
    var g = new Geo();
    var M = maskOf(glyph([
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75'
    ], [[9, 7, 4]], 420));
    var p1 = g.part({ c: [0, 0, 0], spin: 0.8, rock: true });
    extrude(g, M, 1.8, 0.1, 42000 * D, { part: p1, sideTone: 0.7, faceTone: tf(1.0) });
    return finish(g);
  };

  /* ---- Ticketing: the ticket ------------------------------------------- */
  function ticketCanvas(label) {
    return pad(820, 380, function (c, w, h) {
      var r = 26, stub = 590;
      c.fillStyle = 'rgb(150,150,150)';
      c.beginPath();
      c.moveTo(r, 0); c.lineTo(w - r, 0); c.quadraticCurveTo(w, 0, w, r);
      c.lineTo(w, h - r); c.quadraticCurveTo(w, h, w - r, h);
      c.lineTo(r, h); c.quadraticCurveTo(0, h, 0, h - r);
      c.lineTo(0, r); c.quadraticCurveTo(0, 0, r, 0);
      c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.arc(stub, 0, 30, 0, TAU); c.fill();
      c.beginPath(); c.arc(stub, h, 30, 0, TAU); c.fill();
      for (var y = 44; y < h - 40; y += 22) { c.beginPath(); c.arc(stub, y, 5, 0, TAU); c.fill(); }
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgb(255,255,255)';
      c.font = '800 104px ' + getComputedStyle(document.body).fontFamily;
      c.fillText(label, 48, 150);
      c.fillRect(52, 176, 300, 16);
      c.fillRect(52, 212, 220, 16);
      c.fillRect(52, 290, 140, 34);
      c.fillRect(214, 290, 140, 34);
      for (var b = 0; b < 24; b++) {
        var bw = 3 + ((b * 7) % 5) * 2;
        c.fillRect(630 + b * 6.6, 70, bw * 0.5, 240);
      }
    });
  }
  OBJECTS.tickets = function () {
    var g = new Geo();
    var cA = [0, 0, 0.12], cB = [0.16, 0.26, -0.14];
    var pA = g.part({ c: cA, bob: 0.03, phase: 0 });
    var pB = g.part({ c: cB, bob: 0.03, phase: 2.1 });
    function face(v) { return v > 0.8 ? 1.35 : 0.34; }
    extrude(g, maskOf(ticketCanvas('ADMIT ONE')), 2.0, 0.022, 30000 * D, { part: pB, xf: { t: cB, rz: 0.13 }, faceTone: face, sideTone: 0.5, oneFace: true });
    extrude(g, maskOf(ticketCanvas('SAT 14')), 2.0, 0.022, 34000 * D, { part: pA, xf: { t: cA, rz: -0.11 }, faceTone: face, sideTone: 0.5, oneFace: true });
    return finish(g);
  };

  /* ---- Inbox: the envelope --------------------------------------------- */
  OBJECTS.envelope = function () {
    var g = new Geo();
    var env = pad(900, 600, function (c, w, h) {
      c.fillStyle = 'rgb(140,140,140)'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgb(255,255,255)'; c.lineWidth = 14; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(10, 10); c.lineTo(w / 2, 340); c.lineTo(w - 10, 10); c.stroke();
      c.beginPath(); c.moveTo(10, h - 10); c.lineTo(330, 300); c.moveTo(w - 10, h - 10); c.lineTo(w - 330, 300); c.stroke();
    });
    var letter = pad(760, 560, function (c, w, h) {
      c.fillStyle = 'rgb(200,200,200)'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgb(255,255,255)';
      for (var l = 0; l < 6; l++) c.fillRect(60, 70 + l * 52, l === 5 ? 260 : 560, 16);
    });
    var cL = [0, 0.34, -0.06];
    var pL = g.part({ c: cL, bob: 0.07, phase: 0.4 });
    extrude(g, maskOf(letter), 1.52, 0.012, 22000 * D, { part: pL, xf: { t: cL }, faceTone: function (v) { return v > 0.9 ? 1.0 : 0.5; }, sideTone: 0.5 });
    extrude(g, maskOf(env), 1.8, 0.035, 50000 * D, { faceTone: function (v) { return v > 0.9 ? 1.35 : 0.6; }, sideTone: 0.6 });
    return finish(g);
  };

  /* ---- Intelligence: the spark ------------------------------------------ */
  OBJECTS.sparkle = function () {
    var g = new Geo();
    var M = maskOf(pad(400, 400, function (c, w, h) {
      var cx = w / 2, cy = h / 2, R = 188, k = 0.16;
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(cx, cy - R);
      c.quadraticCurveTo(cx + R * k, cy - R * k, cx + R, cy);
      c.quadraticCurveTo(cx + R * k, cy + R * k, cx, cy + R);
      c.quadraticCurveTo(cx - R * k, cy + R * k, cx - R, cy);
      c.quadraticCurveTo(cx - R * k, cy - R * k, cx, cy - R);
      c.fill();
    }));
    var c1 = [0, 0, 0], c2 = [0.95, 0.82, 0.1], c3 = [-0.86, -0.72, 0.2];
    var p1 = g.part({ c: c1, spin: 0.5 });
    var p2 = g.part({ c: c2, spin: -1.3, pulse: 0.5, phase: 1.0 });
    var p3 = g.part({ c: c3, spin: 1.7, pulse: 0.5, phase: 2.4 });
    extrude(g, M, 1.5, 0.16, 36000 * D, { part: p1, xf: { t: c1 }, sideTone: 0.8, faceTone: tf(1.0) });
    extrude(g, M, 0.5, 0.06, 6000 * D, { part: p2, xf: { t: c2 }, sideTone: 0.9, faceTone: tf(1.15) });
    extrude(g, M, 0.34, 0.045, 3500 * D, { part: p3, xf: { t: c3 }, sideTone: 0.9, faceTone: tf(1.15) });
    return finish(g);
  };

  /* ---- Campaigns: the megaphone ---------------------------------------- */
  OBJECTS.megaphone = function () {
    var g = new Geo();
    var aim = { rz: -1.15, t: [-0.2, -0.1, 0] };
    lathe(g, [[0, 0], [0.16, 0], [0.16, 0.46], [0.56, 1.26], [0.53, 1.27], [0.15, 0.5]], 30000 * D, {
      xf: aim,
      tone: function (r, y) { return y > 1.24 ? 1.2 : (y < 0.46 && y > 0.3 ? 1.0 : 0.62); }
    });
    box(g, [0.23, 0.28, 0], [0.05, 0.14, 0.045], 1800 * D, { xf: aim, tone: tf(0.8) });
    box(g, [0.14, 0.2, 0], [0.04, 0.02, 0.03], 400 * D, { xf: aim, tone: tf(1.1) });
    var waves = g.part({ c: [0, 0, 0], pulse: 0.8 });
    for (var w = 0; w < 3; w++) {
      var rad = 0.36 + w * 0.26;
      tube(g, (function (R) {
        return function (t) {
          var a = (t - 0.5) * 1.3;
          return [Math.sin(a) * R, 1.42 + Math.cos(a) * R - R * 0.35, 0];
        };
      })(rad), 0.016, 1300 * D, { part: waves, xf: aim, tone: tf(1.1 - w * 0.2) });
    }
    return finish(g);
  };

  /* ---- Reports: the chart ---------------------------------------------- */
  OBJECTS.chart = function () {
    var g = new Geo();
    box(g, [0, -0.03, 0], [1.05, 0.03, 0.62], 9000 * D, {
      tone: function (P, n) { return n[1] < 0.5 ? 0.3 : (((P[2] * 5 % 1 + 1) % 1) < 0.08 ? 0.5 : 0.24); }
    });
    var hs = [0.34, 0.52, 0.44, 0.78, 0.66, 1.02], tops = [];
    for (var i = 0; i < hs.length; i++) {
      var x = -0.78 + i * 0.312;
      box(g, [x, hs[i] / 2, 0], [0.095, hs[i] / 2, 0.095], 5200 * D, {
        tone: function (P, n) { return n[1] > 0.5 ? 1.2 : 0.85; }
      });
      tops.push([x, hs[i] + 0.2, 0]);
    }
    var line = g.part({ c: [0, 0, 0], pulse: 0.35 });
    tube(g, polyline(tops), 0.012, 2600 * D, { part: line, tone: tf(1.1) });
    for (var t = 0; t < tops.length; t++) sphere(g, tops[t], 0.035, 350 * D, { part: line, tone: tf(1.4) });
    return finish(g);
  };

  /* ======================================================================
     Morph targets. Every shape in a sequence is resampled to the same number
     of points so any one can turn into any other. A screenshot is a target
     too: one point per pixel cell, lying flat, facing the camera.
     ====================================================================== */

  function resample(geo, N) {
    var src = geo.data, n = geo.count, out = new Float32Array(N * 9);
    for (var i = 0; i < N; i++) {
      var j = (rnd() * n) | 0;
      for (var k = 0; k < 9; k++) out[i * 9 + k] = src[j * 9 + k];
      out[i * 9 + 8] = rnd();
    }
    return { data: out, count: N, partA: geo.partA, partB: geo.partB };
  }

  /* The flat target for a screenshot. hw is the half width in object units;
     the half height follows the picture. */
  function uiTarget(img, N, hw) {
    var cols = 220, rows = Math.round(cols * img.naturalHeight / img.naturalWidth);
    var c = pad(cols, rows, function (ctx, w, h) { ctx.drawImage(img, 0, 0, w, h); });
    var d = c.getContext('2d').getImageData(0, 0, cols, rows).data;
    var hh = hw * rows / cols, cells = [];
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = (y * cols + x) * 4;
        var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        var l = r * 0.299 + g * 0.587 + b * 0.114;
        if (l < 0.07 || d[i + 3] < 128) continue;
        /* Brand blue in the UI stays blue in the dots. */
        var accent = (b - r > 0.25 && b > 0.5) ? 1 : 0;
        cells.push([x, y, l, accent]);
      }
    }
    var out = new Float32Array(N * 9);
    for (var k = 0; k < N; k++) {
      var cell = cells[k < cells.length ? k : (rnd() * cells.length) | 0];
      out[k * 9] = ((cell[0] + 0.5) / cols * 2 - 1) * hw;
      out[k * 9 + 1] = (1 - (cell[1] + 0.5) / rows * 2) * hh;
      out[k * 9 + 2] = 0;
      out[k * 9 + 5] = 1;
      out[k * 9 + 6] = cell[3] ? 1.45 : Math.min(1.25, cell[2] * 1.35);
      out[k * 9 + 8] = rnd();
    }
    return { data: out, count: N, partA: new Float32Array(32), partB: new Float32Array(32), hw: hw, hh: hh };
  }

  /* A photograph as a relief: one point per cell of a fixed grid, cover
     fitted to the stage, lifted by its own brightness. Every photo shares
     the grid, so point i only ever changes size, tone and depth, and one
     picture turns into the next without anything crossing the frame. */
  function photoTarget(img, cols, rows, A) {
    var c = pad(cols, rows, function (ctx, w, h) {
      var sr = img.naturalWidth / img.naturalHeight, dr = w / h;
      var sw = sr > dr ? img.naturalHeight * dr : img.naturalWidth;
      var sh = sr > dr ? img.naturalHeight : img.naturalWidth / dr;
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
    });
    var d = c.getContext('2d').getImageData(0, 0, cols, rows).data;
    var N = cols * rows, out = new Float32Array(N * 9);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var k = y * cols + x, i = k * 4;
        var l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        l = Math.max(0, Math.min(1, (l - 0.06) * 1.42));
        out[k * 9] = ((x + 0.5) / cols * 2 - 1) * A;
        out[k * 9 + 1] = 1 - (y + 0.5) / rows * 2;
        out[k * 9 + 2] = (l - 0.45) * 0.34;
        out[k * 9 + 5] = 1;
        out[k * 9 + 6] = l;
        out[k * 9 + 8] = rnd();
      }
    }
    return { data: out, count: N, partA: new Float32Array(32), partB: new Float32Array(32) };
  }

  /* A coded screen as a target. The points land on the screen's own boxes
     and text lines, read from the live layout, so when the real screen
     takes over it is exactly where the points already are. Coordinates are
     in the flat camera plane: x runs -aspect..aspect, y runs -1..1. */
  function domTarget(stage, win, N) {
    var S = stage.getBoundingClientRect();
    var A = S.width / S.height;
    var parts = [];
    function box(r, mode, tone, weight) {
      if (r.width < 1 || r.height < 1) return;
      parts.push({ x: r.left - S.left, y: r.top - S.top, w: r.width, h: r.height, mode: mode, tone: tone, weight: weight });
    }
    box(win.getBoundingClientRect(), 'fill', 0.16, 0.25);
    box(win.getBoundingClientRect(), 'edge', 0.8, 1.2);
    var q = win.querySelectorAll('.ui-card, .ui-side, .ui-win__bar, .ui-ai, .ui-bubble, .ui-stats > div');
    for (var i = 0; i < q.length; i++) { box(q[i].getBoundingClientRect(), 'fill', 0.3, 0.35); box(q[i].getBoundingClientRect(), 'edge', 0.75, 1); }
    q = win.querySelectorAll('.ui-bar i, .ui-hours i, .ui-btn, .ui-pill, .ui-av, .ui-side a.is-on, .ui-spark');
    for (var j = 0; j < q.length; j++) box(q[j].getBoundingClientRect(), 'fill', 1.45, 1.6);
    /* Every line of text becomes a short bar of dots, like the skeleton of
       the screen before it loads. */
    var walker = document.createTreeWalker(win, NodeFilter.SHOW_TEXT, null);
    var range = document.createRange();
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      range.selectNodeContents(n);
      var rs = range.getClientRects();
      for (var k = 0; k < rs.length; k++) {
        var rr = rs[k];
        var big = rr.height > 18;
        parts.push({ x: rr.left - S.left, y: rr.top - S.top + rr.height * 0.25, w: rr.width, h: rr.height * 0.5,
                     mode: 'fill', tone: big ? 1.25 : 1.05, weight: 2.2 });
      }
    }
    var total = 0;
    parts.forEach(function (p) {
      p.area = p.mode === 'edge' ? (p.w + p.h) * 2 * 2 : p.w * p.h;
      p.score = p.area * p.weight;
      total += p.score;
    });
    var out = new Float32Array(N * 9), at = 0;
    function put(px, py, tone) {
      if (at >= N) return;
      out[at * 9] = (px / S.width * 2 - 1) * A;
      out[at * 9 + 1] = 1 - py / S.height * 2;
      out[at * 9 + 2] = 0;
      out[at * 9 + 5] = 1;
      out[at * 9 + 6] = tone;
      out[at * 9 + 8] = rnd();
      at++;
    }
    parts.forEach(function (p) {
      var c = Math.round(N * p.score / total);
      for (var m = 0; m < c; m++) {
        if (p.mode === 'edge') {
          var t = rnd() * (p.w + p.h) * 2, ex, ey;
          if (t < p.w) { ex = p.x + t; ey = p.y; }
          else if (t < p.w + p.h) { ex = p.x + p.w; ey = p.y + t - p.w; }
          else if (t < p.w * 2 + p.h) { ex = p.x + p.w - (t - p.w - p.h); ey = p.y + p.h; }
          else { ex = p.x; ey = p.y + p.h - (t - p.w * 2 - p.h); }
          put(ex, ey, p.tone);
        } else {
          put(p.x + rnd() * p.w, p.y + rnd() * p.h, p.tone);
        }
      }
    });
    while (at < N) {
      var f = parts[0];
      put(f.x + rnd() * f.w, f.y + rnd() * f.h, f.tone);
    }
    return { data: out, count: N, partA: new Float32Array(32), partB: new Float32Array(32), dom: true };
  }

  /* How each shape likes to be seen in a sequence. */
  var POSE = {
    tickets:   { yaw: -0.12, pitch: 0.08, zoom: 1.05 },
    socials:   { yaw: 0.0,   pitch: 0.1,  zoom: 1.3 },
    envelope:  { yaw: -0.3,  pitch: 0.12, zoom: 1.0 },
    sparkle:   { yaw: 0.2,   pitch: 0.1,  zoom: 1.0 },
    megaphone: { yaw: 0.35,  pitch: 0.15, zoom: 1.0 },
    chart:     { yaw: -0.5,  pitch: 0.3,  zoom: 1.05, spin: true },
    people:    { yaw: -0.15, pitch: 0.08, zoom: 1.1 },
    cdj:       { yaw: -0.3,  pitch: 0.5,  zoom: 1.9 },
    tent:      { yaw: -0.3,  pitch: 0.2,  zoom: 1.4, spin: true },
    ui:        { yaw: 0,     pitch: 0,    zoom: 1.0 }
  };

  /* ======================================================================
     Rendering. The shader keeps every point alive: a slow coherent flow
     slides points along their own surface, and each one fades out and back
     in on its own clock, so a shape reads as a living cloud rather than
     points pinned in glass.
     ====================================================================== */

  var VS = [
    'precision highp float;',
    'attribute vec3 aPos;',
    'attribute vec3 aNrm;',
    'attribute vec3 aAux;',
    'uniform mat3 uRot;',
    'uniform float uTime, uAssemble, uDpr, uAspect, uZoom, uPt, uAlpha, uFlow;',
    'uniform vec4 uPartA[8];',
    'uniform vec4 uPartB[8];',
    'uniform vec3 uDeep, uHot, uAccent;',
    'uniform float uAccentOn;',
    'uniform float uMono;',
    'varying vec3 vCol;',
    'varying float vA;',
    'void main() {',
    '  vec3 p = aPos;',
    '  vec3 n = aNrm;',
    '  float sd = aAux.z;',
    '  int part = int(aAux.y + 0.5);',
    '  vec4 A = uPartA[part];',
    '  vec4 B = uPartB[part];',
    '  float ang = (uTime * A.w + B.z) * step(0.0001, abs(A.w));',
    '  if (B.w > 0.5) ang = sin(uTime * A.w + B.z) * 0.6;',
    '  float c = cos(ang), s = sin(ang);',
    '  vec3 q = p - A.xyz;',
    '  q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);',
    '  n = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);',
    '  p = q + A.xyz;',
    '  p.y += sin(uTime * 1.3 + B.z) * B.x;',
    /* Flow. A smooth field so neighbours move together, plus a little of
       each point's own, with the normal component removed so points slide
       along the surface instead of leaving it. */
    '  vec3 fl = vec3(sin(p.y * 6.0 + uTime * 0.9), sin(p.z * 6.0 + uTime * 0.75 + 1.7), sin(p.x * 6.0 + uTime * 0.83 + 3.1));',
    '  fl += 0.7 * vec3(sin(uTime * 1.3 + sd * 51.0), sin(uTime * 1.1 + sd * 37.0), sin(uTime * 0.9 + sd * 23.0));',
    '  fl -= n * dot(fl, n);',
    '  p += fl * uFlow;',
    /* A breath off the surface, so hard cut edges read as soft. */
    '  p += n * sin(uTime * 1.6 + sd * 89.0) * uFlow * 0.45;',
    '  vec3 dir = normalize(vec3(fract(sd * 13.17) - 0.5, fract(sd * 71.71) - 0.5, fract(sd * 37.37) - 0.5) + vec3(0.0001));',
    '  vec3 from = p * 0.22 + dir * (0.18 + fract(sd * 5.3) * 0.3);',
    '  float st = clamp(uAssemble * 1.5 - sd * 0.5, 0.0, 1.0);',
    '  st = st * st * (3.0 - 2.0 * st);',
    '  p = mix(from, p, st);',
    '  vec3 v = uRot * p;',
    '  vec3 vn = uRot * n;',
    '  float z = 3.3 - v.z;',
    '  vec2 pr = v.xy / z * uZoom;',
    '  gl_Position = vec4(pr.x / uAspect, pr.y, 0.0, 1.0);',
    '  gl_PointSize = uPt * uDpr * (3.3 / z);',
    '  vec3 L = normalize(vec3(-0.5, 0.75, 0.55));',
    '  float lam = max(dot(vn, L), 0.0);',
    '  float facing = vn.z;',
    '  float rim = pow(1.0 - abs(facing), 2.2);',
    '  float light = 0.16 + 0.74 * lam + 0.30 * rim;',
    '  float front = mix(0.28, 1.0, smoothstep(-0.25, 0.35, facing));',
    '  float pulse = 1.0 + B.y * sin(uTime * 3.2 - length(p) * 7.0);',
    '  float tone = aAux.x;',
    /* Each point has its own slow life: it dims, and comes back. */
    '  float life = fract(uTime * 0.11 + sd * 7.3);',
    '  float alive = 0.72 + 0.28 * smoothstep(0.0, 0.18, life) * smoothstep(1.0, 0.72, life);',
    '  vCol = mix(uDeep, uHot, clamp(light * tone * 0.95, 0.0, 1.0));',
    '  vCol = mix(vCol, uAccent, step(1.28, tone) * uAccentOn);',
    '  if (uMono > 0.5) vCol = vec3(clamp(light * tone, 0.0, 1.6), step(1.28, tone), 0.0);',
    '  float fog = smoothstep(4.6, 2.3, z);',
    '  vA = uAlpha * front * (0.30 + 0.70 * clamp(tone, 0.0, 1.4)) * fog * pulse * alive * mix(0.25, 1.0, st);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 vCol;',
    'varying float vA;',
    'uniform float uHard;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float r = dot(c, c);',
    '  if (r > 0.25) discard;',
    '  float a = vA * (1.0 - smoothstep(mix(0.05, 0.19, uHard), 0.25, r));',
    '  gl_FragColor = vec4(vCol * a, a);',
    '}'
  ].join('\n');

  /* The morph. Two shapes are bound at once; the first breaks into a slow
     cloud and the second forms out of it. Each point keeps its own flow and
     its own clock, exactly like a single shape. */
  var VS_MORPH = [
    'precision highp float;',
    'attribute vec3 aPA; attribute vec3 aNA; attribute vec3 aXA;',
    'attribute vec3 aPB; attribute vec3 aNB; attribute vec3 aXB;',
    'uniform mat3 uRot;',
    'uniform float uTime, uMix, uDpr, uAspect, uZoom, uPt, uAlpha, uFlow, uMono, uAssemble, uMode, uPhoto, uCell, uWave;',
    'uniform vec4 uPA_A[8]; uniform vec4 uPB_A[8];',
    'uniform vec4 uPA_B[8]; uniform vec4 uPB_B[8];',
    'uniform vec3 uDeep, uHot, uAccent;',
    'uniform float uAccentOn;',
    'varying vec3 vCol;',
    'varying float vA;',
    'vec3 spinY(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z); }',
    /* A proper hash. fract(seed * k) for a few k is strongly correlated, and
       that correlation drew arcs and meridians through the cloud. */
    'float h1(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }',
    'void main() {',
    '  float sd = aXA.z;',
    '  int ia = int(aXA.y + 0.5); int ib = int(aXB.y + 0.5);',
    '  vec4 A1 = uPA_A[ia]; vec4 B1 = uPB_A[ia];',
    '  vec4 A2 = uPA_B[ib]; vec4 B2 = uPB_B[ib];',
    '  float a1 = (uTime * A1.w + B1.z) * step(0.0001, abs(A1.w)); if (B1.w > 0.5) a1 = sin(uTime * A1.w + B1.z) * 0.6;',
    '  float a2 = (uTime * A2.w + B2.z) * step(0.0001, abs(A2.w)); if (B2.w > 0.5) a2 = sin(uTime * A2.w + B2.z) * 0.6;',
    '  vec3 pa = spinY(aPA - A1.xyz, a1) + A1.xyz; pa.y += sin(uTime * 1.3 + B1.z) * B1.x;',
    '  vec3 pb = spinY(aPB - A2.xyz, a2) + A2.xyz; pb.y += sin(uTime * 1.3 + B2.z) * B2.x;',
    '  vec3 na = spinY(aNA, a1); vec3 nb = spinY(aNB, a2);',
    /* A little stagger so a shape comes apart unevenly, like something real. */
    '  float t = clamp(uMix * 1.2 - sd * 0.2, 0.0, 1.0);',
    /* A photograph changes as a wave across the frame, not dot by dot. */
    '  if (uMode > 0.5) t = clamp(uMix * 1.7 - (0.5 + 0.18 * aPA.x + 0.3 * aPA.y) * 0.7, 0.0, 1.0);',
    '  vec3 rnd = vec3(h1(sd * 91.7 + 1.3), h1(sd * 47.3 + 7.1), h1(sd * 13.9 + 3.7));',
    '  vec3 dir = normalize(rnd - 0.5 + vec3(0.0001));',
    '  float bell = sin(3.14159 * t);',
    '  float e1, e2; vec3 p; vec3 n; float tone;',
    '  if (uMode > 0.5) {',
    /* Flow: every point goes straight to its new place, lifted on a slow
       swell on the way, so a picture turns into the next like a surface. */
    '    float e = t * t * (3.0 - 2.0 * t);',
    '    p = mix(pa, pb, e);',
    /* The wave lifts the dots toward you as it passes, so the change reads
       as depth rather than as scatter. */
    '    p.z += bell * (0.28 + 0.3 * rnd.x);',
    '    p.xy += (rnd.yz - 0.5) * 0.018 * bell;',
    '    n = normalize(mix(na, nb, e) + vec3(0.0001));',
    '    tone = mix(aXA.x, aXB.x, e);',
    '    e1 = bell; e2 = e;',
    '  } else {',
    /* Cloud: one shape dissolves into a soft drifting volume, and the next
       condenses out of it. No shape of its own in between. */
    '    e1 = smoothstep(0.0, 0.5, t); e2 = smoothstep(0.5, 1.0, t);',
    '    vec3 cloud = dir * (0.12 + 0.95 * pow(h1(sd * 7.7 + 9.1), 0.45));',
    '    cloud += 0.16 * vec3(sin(cloud.y * 3.1 + uTime * 0.45 + rnd.y * 6.28), sin(cloud.z * 2.7 + uTime * 0.38 + rnd.z * 6.28), sin(cloud.x * 2.9 + uTime * 0.41 + rnd.x * 6.28));',
    '    p = mix(mix(pa, cloud, e1), pb, e2);',
    '    n = normalize(mix(mix(na, dir, e1), nb, e2) + vec3(0.0001));',
    '    tone = mix(mix(aXA.x, 0.75, e1), aXB.x, e2);',
    '  }',
    '  vec3 fl = vec3(sin(p.y * 6.0 + uTime * 0.9), sin(p.z * 6.0 + uTime * 0.75 + 1.7), sin(p.x * 6.0 + uTime * 0.83 + 3.1));',
    '  fl += 0.7 * vec3(sin(uTime * 1.3 + sd * 51.0), sin(uTime * 1.1 + sd * 37.0), sin(uTime * 0.9 + sd * 23.0));',
    '  fl -= n * dot(fl, n);',
    '  float calm = 1.0 - e2 * step(0.5, uMono) * 0.0;',
    '  p += fl * uFlow * calm;',
    '  float st = clamp(uAssemble * 1.5 - sd * 0.5, 0.0, 1.0);',
    '  st = st * st * (3.0 - 2.0 * st);',
    '  p = mix(p * 0.22 + dir * (0.18 + rnd.y * 0.3), p, st);',
    '  vec3 v = uRot * p;',
    '  vec3 vn = uRot * n;',
    '  float z = 3.3 - v.z;',
    '  vec2 pr = v.xy / z * uZoom;',
    '  gl_Position = vec4(pr.x / uAspect, pr.y, 0.0, 1.0);',
    '  gl_PointSize = uPt * uDpr * (3.3 / z);',
    /* Photographs: one dot per cell, sized by brightness like the site's
       halftone, so the page keeps one texture. */
    '  if (uPhoto > 0.5) gl_PointSize = uCell * (0.3 + 0.9 * sqrt(clamp(tone, 0.0, 1.0))) * (3.3 / z);',
    '  vec3 L = normalize(vec3(-0.5, 0.75, 0.55));',
    '  float light = 0.16 + 0.74 * max(dot(vn, L), 0.0) + 0.30 * pow(1.0 - abs(vn.z), 2.2);',
    '  float front = mix(0.28, 1.0, smoothstep(-0.25, 0.35, vn.z));',
    '  float life = fract(uTime * 0.11 + sd * 7.3);',
    '  float alive = 0.72 + 0.28 * smoothstep(0.0, 0.18, life) * smoothstep(1.0, 0.72, life);',
    '  vCol = mix(uDeep, uHot, clamp(light * tone * 0.95, 0.0, 1.0));',
    '  vCol = mix(vCol, uAccent, step(1.28, tone) * uAccentOn);',
    '  if (uMono > 0.5) vCol = vec3(clamp(light * tone, 0.0, 1.6), step(1.28, tone), 0.0);',
    '  float fog = smoothstep(4.6, 2.3, z);',
    '  vA = uAlpha * front * (0.30 + 0.70 * clamp(tone, 0.0, 1.4)) * fog * alive * mix(0.25, 1.0, st);',
    /* The reveal: a front crosses the screen, the points behind it hand over
       to the real screen and the ones at the front flare as it passes. */
    '  float wx = gl_Position.x;',
    '  vA *= smoothstep(uWave - 0.02, uWave + 0.10, wx);',
    '  float crest = exp(-pow((wx - uWave) * 14.0, 2.0));',
    '  vA *= 1.0 + 2.2 * crest * step(-1.5, uWave);',
    '  vCol = mix(vCol, vec3(0.85, 0.92, 1.0), crest * 0.6 * step(-1.5, uWave));',
    '  if (uPhoto > 0.5) {',
    '    float g = (188.0 + tone * 67.0) / 255.0;',
    '    vCol = vec3(g, g, min(1.0, g + tone * 0.055));',
    '    vA = step(0.03, tone) * mix(0.0, 1.0, st) * (0.85 + 0.15 * bell);',
    '  }',
    '}'
  ].join('\n');
  var MORPH_UNIFORMS = ['uWave', 'uMode', 'uPhoto', 'uCell', 'uHard', 'uRot', 'uTime', 'uMix', 'uDpr', 'uAspect', 'uZoom', 'uPt', 'uAlpha', 'uFlow', 'uMono', 'uAssemble',
                        'uPA_A', 'uPB_A', 'uPA_B', 'uPB_B', 'uDeep', 'uHot', 'uAccent', 'uAccentOn'];

  /* The halftone pass. One dot per cell, sized by the brightness under it,
     with the same curve and greys as dotScreen in site.js. */
  var VS_QUAD = 'attribute vec2 aQ; void main() { gl_Position = vec4(aQ, 0.0, 1.0); }';
  var FS_DOT = [
    'precision highp float;',
    'uniform sampler2D uTex;',
    'uniform vec2 uRes;',
    'uniform float uCell, uGain;',
    'uniform vec3 uAccent;',
    'void main() {',
    '  vec2 cell = floor(gl_FragCoord.xy / uCell);',
    '  vec2 c = (cell + 0.5) * uCell;',
    '  vec2 s = vec2(0.0);',
    '  for (int i = -1; i <= 1; i++) {',
    '    for (int j = -1; j <= 1; j++) {',
    '      s += texture2D(uTex, (c + vec2(float(i), float(j)) * uCell * 0.33) / uRes).rg;',
    '    }',
    '  }',
    '  s /= 9.0;',
    '  float l = (s.r * uGain - 0.06) * 1.42;',
    '  if (l < 0.03) discard;',
    '  l = min(l, 1.0);',
    '  float r = sqrt(l) * uCell * 0.6;',
    '  float d = length(gl_FragCoord.xy - c);',
    '  float a = clamp(r - d + 0.5, 0.0, 1.0);',
    '  if (a <= 0.0) discard;',
    '  float g = (188.0 + l * 67.0) / 255.0;',
    '  vec3 col = vec3(g, g, min(1.0, g + l * 14.0 / 255.0));',
    '  col = mix(col, uAccent, clamp(s.g * 4.0, 0.0, 1.0));',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var UNIFORMS = ['uAccent', 'uAccentOn', 'uMono', 'uRot', 'uTime', 'uAssemble', 'uDpr', 'uAspect', 'uZoom', 'uPt', 'uAlpha', 'uFlow', 'uPartA', 'uPartB', 'uDeep', 'uHot'];

  function Renderer(canvas, fixed, dot, ink) {
    this.canvas = canvas;
    this.fixed = fixed;
    this.dot = !!dot;
    this.ink = !!ink;
    this.views = [];
    this.w = 0; this.h = 0; this.dpr = 1;
    var attrs = { alpha: true, antialias: false, depth: false, premultipliedAlpha: true, powerPreference: 'high-performance' };
    var gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs);
    this.gl = gl;
    if (!gl) return;
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    this.compile = compile;
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    var U = this.U = {};
    UNIFORMS.forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    this.locPos = gl.getAttribLocation(prog, 'aPos');
    this.locNrm = gl.getAttribLocation(prog, 'aNrm');
    this.locAux = gl.getAttribLocation(prog, 'aAux');
    gl.enableVertexAttribArray(this.locPos);
    gl.enableVertexAttribArray(this.locNrm);
    gl.enableVertexAttribArray(this.locAux);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.palette(U);
    gl.uniform1f(U.uMono, this.dot ? 1 : 0);
    this.prog = prog;

    if (this.dot) {
      var dp = gl.createProgram();
      gl.attachShader(dp, compile(gl.VERTEX_SHADER, VS_QUAD));
      gl.attachShader(dp, compile(gl.FRAGMENT_SHADER, FS_DOT));
      gl.linkProgram(dp);
      if (!gl.getProgramParameter(dp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(dp));
      this.dprog = dp;
      this.DU = {};
      var DU = this.DU;
      ['uTex', 'uRes', 'uCell', 'uGain', 'uAccent'].forEach(function (n) { DU[n] = gl.getUniformLocation(dp, n); });
      this.locQ = gl.getAttribLocation(dp, 'aQ');
      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.tex = gl.createTexture();
      this.fbo = gl.createFramebuffer();
      this.fw = 0; this.fh = 0;
    }
  }
  /* The offscreen target the points are drawn into before the dot pass. */
  Renderer.prototype.target = function () {
    var gl = this.gl;
    if (this.fw === this.w && this.fh === this.h) return;
    this.fw = this.w; this.fh = this.h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.w, this.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  Renderer.prototype.dotPass = function () {
    var gl = this.gl, DU = this.DU;
    /* Match the photographs: 6px cells, 3px on a phone. */
    var cell = (this.cell || (window.innerWidth <= 900 ? 3 : 6)) * this.dpr;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.dprog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(DU.uTex, 0);
    gl.uniform2f(DU.uRes, this.w, this.h);
    gl.uniform1f(DU.uCell, cell);
    gl.uniform1f(DU.uGain, this.gain || 2.2);
    gl.uniform3f(DU.uAccent, 0.231, 0.475, 0.976);
    gl.disableVertexAttribArray(this.locPos);
    gl.disableVertexAttribArray(this.locNrm);
    gl.disableVertexAttribArray(this.locAux);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.locQ);
    gl.vertexAttribPointer(this.locQ, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(this.locQ);
    gl.useProgram(this.prog);
    gl.enableVertexAttribArray(this.locPos);
    gl.enableVertexAttribArray(this.locNrm);
    gl.enableVertexAttribArray(this.locAux);
    gl.blendFunc(gl.ONE, gl.ONE);
  };
  Renderer.prototype.resize = function () {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw, ch;
    if (this.fixed) { cw = window.innerWidth; ch = window.innerHeight; }
    else { cw = this.canvas.clientWidth; ch = this.canvas.clientHeight; }
    var w = Math.max(2, Math.round(cw * this.dpr)), h = Math.max(2, Math.round(ch * this.dpr));
    if (w !== this.w || h !== this.h) { this.w = this.canvas.width = w; this.h = this.canvas.height = h; }
  };

  /* glow: the lab's blue. ink: the site's own greys, with brand blue kept
     for the lit details only, so an object sits in a page like its type. */
  Renderer.prototype.palette = function (U) {
    var gl = this.gl;
    if (this.ink) {
      gl.uniform3f(U.uDeep, 0.34, 0.35, 0.39);
      gl.uniform3f(U.uHot, 0.96, 0.96, 0.98);
      gl.uniform3f(U.uAccent, 0.231, 0.475, 0.976);
      gl.uniform1f(U.uAccentOn, 1);
    } else {
      gl.uniform3f(U.uDeep, 0.07, 0.22, 0.74);
      gl.uniform3f(U.uHot, 0.82, 0.90, 1.0);
      gl.uniform3f(U.uAccent, 0, 0, 0);
      gl.uniform1f(U.uAccentOn, 0);
    }
  };

  Renderer.prototype.ensureMorph = function () {
    if (this.mprog) return;
    var gl = this.gl;
    var mp = gl.createProgram();
    gl.attachShader(mp, this.compile(gl.VERTEX_SHADER, VS_MORPH));
    gl.attachShader(mp, this.compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(mp);
    if (!gl.getProgramParameter(mp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(mp));
    this.mprog = mp;
    var MU = this.MU = {};
    MORPH_UNIFORMS.forEach(function (n) { MU[n] = gl.getUniformLocation(mp, n); });
    this.mloc = ['aPA', 'aNA', 'aXA', 'aPB', 'aNB', 'aXB'].map(function (n) { return gl.getAttribLocation(mp, n); });
    gl.useProgram(mp);
    this.palette(MU);
    gl.uniform1f(MU.uMono, this.dot ? 1 : 0);
    gl.useProgram(this.prog);
  };

  function rotation(yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]);
  }

  function View(el, renderer) {
    var t = this;
    this.el = el;
    this.r = renderer;
    this.obj = el.getAttribute('data-points');
    this.zoom = parseFloat(el.getAttribute('data-zoom') || '1');
    this.yaw = parseFloat(el.getAttribute('data-yaw') || '-0.35');
    this.pitch = parseFloat(el.getAttribute('data-pitch') || '0.26');
    this.spin = el.getAttribute('data-auto') === 'spin';
    /* still: holds its pose, moving only with the pointer and a drag. */
    this.still = el.getAttribute('data-auto') === 'still';
    /* data-bright lifts a stage that sits small or on its own in a dark
       panel, where the default exposure reads as murky. */
    this.bright = parseFloat(el.getAttribute('data-bright') || '1');
    this.vyaw = 0; this.vpitch = 0; this.sway = 0;
    this.tx = 0; this.ty = 0; this.tiltX = 0; this.tiltY = 0;
    this.drag = false; this.moved = 0; this.lx = 0; this.ly = 0;
    this.assemble = REDUCED ? 1 : 0; this.started = false; this.visible = false;
    this.geo = null; this.buf = null;

    el.addEventListener('pointerdown', function (e) {
      t.drag = true; t.moved = 0; t.lx = e.clientX; t.ly = e.clientY;
      t.vyaw = 0; t.vpitch = 0;
      el.classList.add('touched');
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      t.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      t.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!t.drag) return;
      var dx = e.clientX - t.lx, dy = e.clientY - t.ly;
      t.lx = e.clientX; t.ly = e.clientY;
      t.moved += Math.abs(dx) + Math.abs(dy);
      t.vyaw = dx * 0.0085;
      t.vpitch = e.pointerType === 'mouse' ? dy * 0.0065 : 0;
      t.yaw += t.vyaw;
      t.pitch = Math.max(-0.35, Math.min(1.1, t.pitch + t.vpitch));
    });
    function up() {
      /* A tap without a drag sends it back to pieces to reassemble. */
      t.drag = false;
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', function () { t.tx = 0; t.ty = 0; });
  }

  View.prototype.draw = function (now, dt, cr) {
    var r = this.el.getBoundingClientRect();
    if (!this.visible || !this.geo || r.bottom < 0 || r.top > window.innerHeight) return 0;
    var R = this.r, gl = R.gl, U = R.U;

    if (this.started && this.assemble < 1) this.assemble = Math.min(1, this.assemble + dt / 2.2);
    if (!this.drag) {
      this.yaw += this.vyaw;
      this.pitch = Math.max(-0.35, Math.min(1.1, this.pitch + this.vpitch));
      this.vyaw *= 0.94; this.vpitch *= 0.9;
      /* Round things turn. Flat things sway about their best side. */
      if (!REDUCED && Math.abs(this.vyaw) < 0.002) {
        if (this.spin) this.yaw += dt * 0.26; else if (!this.still) this.sway += dt;
      }
    }
    this.tiltX += (this.tx - this.tiltX) * Math.min(1, dt * 4);
    this.tiltY += (this.ty - this.tiltY) * Math.min(1, dt * 4);

    var sx = R.w / cr.width, sy = R.h / cr.height;
    var x = Math.round((r.left - cr.left) * sx), y = Math.round(R.h - (r.bottom - cr.top) * sy);
    var w = Math.round(r.width * sx), h = Math.round(r.height * sy);
    gl.viewport(x, y, w, h);
    var scx = Math.max(0, x), scy = Math.max(0, y);
    gl.scissor(scx, scy, Math.max(0, Math.min(R.w, x + w) - scx), Math.max(0, Math.min(R.h, y + h) - scy));

    var swayYaw = this.spin ? 0 : Math.sin(this.sway * 0.45) * 0.42;
    var small = Math.min(r.width, r.height);
    gl.uniformMatrix3fv(U.uRot, false, rotation(this.yaw + swayYaw + this.tiltX * 0.22, this.pitch + this.tiltY * 0.14));
    gl.uniform1f(U.uTime, REDUCED ? 0 : now);
    gl.uniform1f(U.uAssemble, this.assemble);
    gl.uniform1f(U.uDpr, R.dpr);
    gl.uniform1f(U.uAspect, r.width / r.height);
    gl.uniform1f(U.uZoom, 2.25 * this.zoom);
    var ptK = R.dot ? 2.8 : 1, aK = R.dot ? 0.3 : (R.ink ? 1.9 : 1);
    gl.uniform1f(U.uPt, (small > 600 ? 1.9 : 1.6) * ptK);
    gl.uniform1f(U.uAlpha, 0.42 * aK * this.bright);
    gl.uniform1f(U.uFlow, REDUCED ? 0 : 0.0065);
    gl.uniform4fv(U.uPartA, this.geo.partA);
    gl.uniform4fv(U.uPartB, this.geo.partB);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.vertexAttribPointer(R.locPos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(R.locNrm, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(R.locAux, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(gl.POINTS, 0, this.geo.count);
    return this.geo.count;
  };

  /* ---- Morph view ------------------------------------------------------- */
  /* A stage that moves through a sequence of shapes. data-points-seq lists
     them; "ui" means the screenshot inside the stage (img.points-ui).
     data-points-drive="scroll" follows the element named in
     data-points-track; anything else plays once on time and ends on the last
     shape, and a tap replays it. */
  var SEQ_N = window.innerWidth < 700 ? 40000 : 80000;

  function MorphView(el, renderer) {
    var t = this;
    this.el = el;
    this.r = renderer;
    this.seq = el.getAttribute('data-points-seq').split(/[\s,]+/).filter(Boolean);
    this.drive = el.getAttribute('data-points-drive') || 'time';
    this.track = this.drive === 'scroll' ? document.querySelector(el.getAttribute('data-points-track')) : null;
    this.ui = el.querySelector('.points-ui');
    this.targets = [];
    this.bufs = [];
    this.s = 0;
    this.clock = 0;
    this.assemble = REDUCED ? 1 : 0;
    this.started = false; this.visible = false;
    this.yaw = 0; this.pitch = 0; this.zoom = 1; this.spinYaw = 0; this.sway = 0;
    this.tx = 0; this.ty = 0; this.tiltX = 0; this.tiltY = 0;
    this.dragYaw = 0; this.vyaw = 0; this.drag = false; this.lx = 0; this.moved = 0;
    this.geo = true;   /* never picked up by the single shape builder */
    this.photo = /^photo\d+$/.test(this.seq[0] || '');
    /* data-points-range="a b": the sequence plays between those points of
       the track. data-points-wave="a b": then a wave reveals the real screen. */
    this.range = (el.getAttribute('data-points-range') || '0 1').split(/\s+/).map(Number);
    this.waveRange = el.getAttribute('data-points-wave') ? el.getAttribute('data-points-wave').split(/\s+/).map(Number) : null;
    this.srcs = el.querySelectorAll('img.points-src');
    this.N = SEQ_N;
    this.domUi = !!(this.ui && this.ui.hasAttribute('data-points-dom'));
    if (this.ui) {
      /* The points are sampled from a picture of the screen; what takes over
         once they land can be that picture or the screen itself, coded. */
      var img = el.querySelector('img.points-sample') || (this.ui.tagName === 'IMG' ? this.ui : this.ui.querySelector('img'));
      this.uiImg = img;
      el.classList.add('points-live');
    }

    el.addEventListener('pointerdown', function (e) {
      t.drag = true; t.moved = 0; t.lx = e.clientX; t.vyaw = 0;
      el.classList.add('touched');
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      t.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      t.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!t.drag) return;
      var dx = e.clientX - t.lx;
      t.lx = e.clientX;
      t.moved += Math.abs(dx);
      t.vyaw = dx * 0.0085;
      t.dragYaw += t.vyaw;
    });
    function up() {
      /* On a timed stage a tap plays it again from the first shape. */
      t.drag = false;
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', function () { t.tx = 0; t.ty = 0; });
  }

  MorphView.prototype.ready = function () {
    for (var i = 0; i < this.seq.length; i++) if (!this.targets[i]) return false;
    return true;
  };

  /* Build one target a frame so a long sequence never stalls the page. */
  MorphView.prototype.buildOne = function () {
    for (var i = 0; i < this.seq.length; i++) {
      if (this.targets[i]) continue;
      var name = this.seq[i], t = null;
      if (this.photo) {
        var src = this.srcs[parseInt(name.slice(5), 10)];
        if (!src || !src.complete || !src.naturalWidth) {
          if (src && src.loading === 'lazy') src.loading = 'eager';
          return;
        }
        t = photoTarget(src, this.cols, this.rows, this.gridA);
      } else if (name === 'ui' && this.domUi) {
        this.domW = this.el.clientWidth; this.domH = this.el.clientHeight;
        t = domTarget(this.el, this.ui, SEQ_N);
      } else if (name === 'ui') {
        var img = this.uiImg;
        if (!img || !img.complete || !img.naturalWidth) return;
        t = uiTarget(img, SEQ_N, 0.98);
      } else {
        var make = OBJECTS[name];
        if (!make) { this.seq.splice(i, 1); return; }
        var g = make();
        if (!g) return;
        t = resample(g, SEQ_N);
      }
      var gl = this.r.gl;
      this.targets[i] = t;
      this.bufs[i] = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]);
      gl.bufferData(gl.ARRAY_BUFFER, t.data, gl.STATIC_DRAW);
      return;
    }
  };

  /* Where in the sequence we are, as a float: 2.0 is the third shape
     fully formed, 2.5 is the cloud between the third and fourth. */
  MorphView.prototype.position = function (dt) {
    var K = this.seq.length;
    if (this.drive === 'scroll' && this.track) {
      var r = this.track.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      var p = span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
      this.trackP = p;
      p = Math.max(0, Math.min(1, (p - this.range[0]) / Math.max(0.0001, this.range[1] - this.range[0])));
      /* Eased, so a flick of the wheel is a motion rather than a cut. */
      var want = p * (K - 1);
      if (this.sp === undefined) this.sp = want;
      this.sp += (want - this.sp) * (1 - Math.exp(-dt * 4.5));
      return this.sp;
    }
    /* Timed: hold each shape, then move through the cloud to the next. */
    if (this.started && this.ready()) this.clock += dt;
    var HOLD = 2.6, MOVE = 2.2, at = 0, c = this.clock;
    for (var i = 0; i < K - 1; i++) {
      if (c < HOLD) return i;
      c -= HOLD;
      if (c < MOVE) return i + c / MOVE;
      c -= MOVE;
      at = i + 1;
    }
    return K - 1;
  };

  MorphView.prototype.draw = function (now, dt, cr) {
    var r = this.el.getBoundingClientRect();
    if (!this.visible || r.bottom < 0 || r.top > window.innerHeight) return 0;
    var R = this.r, gl = R.gl;
    if (this.photo) {
      /* The grid follows the stage: 6px cells, 4px on a phone. A real change
         of size throws the photos away and samples them again. */
      this.cellCss = window.innerWidth <= 760 ? 4 : 6;
      var cols = Math.max(8, Math.round(r.width / this.cellCss)), rows = Math.max(8, Math.round(r.height / this.cellCss));
      if (!this.cols || Math.abs(cols - this.cols) > this.cols * 0.08 || Math.abs(rows - this.rows) > this.rows * 0.08) {
        for (var b = 0; b < this.bufs.length; b++) if (this.bufs[b]) gl.deleteBuffer(this.bufs[b]);
        this.targets = []; this.bufs = [];
        this.cols = cols; this.rows = rows; this.gridA = r.width / r.height; this.N = cols * rows;
      }
    }
    if (this.domUi) {
      var ui = this.seq.indexOf('ui');
      if (this.targets[ui] && (Math.abs(this.el.clientWidth - this.domW) > 2 || Math.abs(this.el.clientHeight - this.domH) > 2)) {
        gl.deleteBuffer(this.bufs[ui]);
        this.targets[ui] = null; this.bufs[ui] = null;
      }
    }
    if (!this.ready()) this.buildOne();
    R.ensureMorph();
    var MU = R.MU, K = this.seq.length;

    if (this.started && this.assemble < 1) this.assemble = Math.min(1, this.assemble + dt / 2.0);
    var s = this.position(dt);
    var ia = Math.min(Math.floor(s), K - 2), ib = ia + 1;
    /* Landing mid-sequence (a reload part-way down, a fast scroll) can ask
       for a shape that is still being built. Wait for it; it is a frame away. */
    if (!this.targets[ia] || !this.targets[ib]) { this.buildOne(); return 0; }
    var local = Math.max(0, Math.min(1, s - ia));
    /* Scroll holds each shape for the middle of its slot. */
    var mix = this.drive === 'scroll' ? Math.max(0, Math.min(1, (local - 0.18) / 0.64)) : local;
    /* Tell the page which shape is actually on show, so copy tied to it can
       change once the next one has formed rather than halfway through the
       cloud. Held with a margin either side so it does not flicker. */
    var shown = this.shown;
    if (mix >= 0.66) shown = ib;
    else if (mix <= 0.34) shown = ia;
    else if (shown !== ia && shown !== ib) shown = mix < 0.5 ? ia : ib;
    if (shown !== this.shown) {
      this.shown = shown;
      this.el.dispatchEvent(new CustomEvent('points:shape', { detail: { index: shown } }));
    }

    /* The pose follows the shapes: each has a best side, the screenshot
       faces you square on. */
    var PA = POSE[this.seq[ia]] || {}, PB = POSE[this.seq[ib]] || {};
    var e = mix * mix * (3 - 2 * mix);
    var yaw = (PA.yaw || 0) * (1 - e) + (PB.yaw || 0) * e;
    var pitch = (PA.pitch || 0) * (1 - e) + (PB.pitch || 0) * e;
    var aspect0 = r.width / r.height;
    var U0 = this.targets[this.seq.indexOf('ui')];
    /* The screenshot is sized to fill most of the stage, whatever its shape. */
    var uiZoom = U0 ? 0.86 * 3.3 * aspect0 / (U0.hw * 2.25) : 1;
    if (U0) uiZoom = Math.min(uiZoom, 0.86 * 3.3 / (U0.hh * 2.25));
    /* A coded screen was laid out in the flat camera plane, so it is drawn
       at exactly one to one. */
    if (this.domUi) uiZoom = 3.3 / 2.25 / (this.el.getAttribute('data-zoom') ? parseFloat(this.el.getAttribute('data-zoom')) : 1);
    /* On a portrait stage an object is fitted to the width, not the height. */
    var fitK = Math.min(1, aspect0 * 1.35);
    var zA = this.seq[ia] === 'ui' ? uiZoom : (PA.zoom || 1) * fitK;
    var zB = this.seq[ib] === 'ui' ? uiZoom : (PB.zoom || 1) * fitK;
    var zoom = zA * (1 - e) + zB * e;
    var flat = (this.seq[ib] === 'ui' ? e : 0) + (this.seq[ia] === 'ui' ? 1 - e : 0);
    if (this.photo) { zoom = 3.3 / 2.25; flat = 1; yaw = 0; pitch = 0; }
    if (!REDUCED) this.sway += dt;
    if (!this.drag) { this.dragYaw += this.vyaw; this.vyaw *= 0.94; this.dragYaw *= Math.pow(0.35, dt); }
    this.tiltX += (this.tx - this.tiltX) * Math.min(1, dt * 4);
    this.tiltY += (this.ty - this.tiltY) * Math.min(1, dt * 4);
    var live = 1 - flat;
    yaw += (Math.sin(this.sway * 0.45) * 0.3 + this.tiltX * 0.2 + this.dragYaw) * live;
    pitch += this.tiltY * 0.12 * live;
    /* A photograph still answers the hand, just gently: the relief tips
       toward the pointer and breathes on its own. */
    if (this.photo && !REDUCED) {
      yaw = this.tiltX * 0.07 + Math.sin(this.sway * 0.21) * 0.02;
      pitch = -this.tiltY * 0.05 + Math.cos(this.sway * 0.17) * 0.015;
    }

    var sx = R.w / cr.width, sy = R.h / cr.height;
    var x = Math.round((r.left - cr.left) * sx), y = Math.round(R.h - (r.bottom - cr.top) * sy);
    var w = Math.round(r.width * sx), h = Math.round(r.height * sy);
    gl.viewport(x, y, w, h);
    var scx = Math.max(0, x), scy = Math.max(0, y);
    gl.scissor(scx, scy, Math.max(0, Math.min(R.w, x + w) - scx), Math.max(0, Math.min(R.h, y + h) - scy));

    var aspect = r.width / r.height;
    var z = 2.25 * zoom * (this.el.getAttribute('data-zoom') ? parseFloat(this.el.getAttribute('data-zoom')) : 1);

    gl.useProgram(R.mprog);
    gl.disableVertexAttribArray(R.locPos);
    gl.disableVertexAttribArray(R.locNrm);
    gl.disableVertexAttribArray(R.locAux);
    gl.uniformMatrix3fv(MU.uRot, false, rotation(yaw, pitch));
    gl.uniform1f(MU.uTime, REDUCED ? 0 : now);
    gl.uniform1f(MU.uMix, mix);
    gl.uniform1f(MU.uDpr, R.dpr);
    gl.uniform1f(MU.uAspect, aspect);
    gl.uniform1f(MU.uZoom, z);
    /* In the halftone the points are only a surface for the grid to sample,
       so they are drawn large and faint until they merge into one. */
    var ptK = R.dot ? 2.8 : 1, aK = R.dot ? 0.3 : (R.ink ? 1.9 : 1);
    gl.uniform1f(MU.uPt, (Math.min(r.width, r.height) > 600 ? 1.9 : 1.6) * ptK);
    /* A coded screen covers only part of the picture the points came from,
       so once it has taken over the points step back entirely. */
    if (this.ui && this.ui.hasAttribute('data-auto-height')) {
      var over = this.seq[ib] === 'ui' && mix > 0.985;
      this.cover = (this.cover || 0) + ((over ? 1 : 0) - (this.cover || 0)) * Math.min(1, dt * 3);
      aK *= 1 - this.cover;
    }
    gl.uniform1f(MU.uAlpha, 0.42 * aK);
    gl.uniform1f(MU.uFlow, REDUCED ? 0 : 0.0065 * (1 - flat * 0.85));
    gl.uniform1f(MU.uAssemble, this.assemble);
    gl.uniform1f(MU.uMode, this.photo ? 1 : 0);
    var wave = -9;
    if (this.waveRange && this.trackP !== undefined) {
      var wp = (this.trackP - this.waveRange[0]) / (this.waveRange[1] - this.waveRange[0]);
      if (wp > 0) wave = -1.15 + Math.min(1, wp) * 2.4;
      this.wave = wave;
    }
    gl.uniform1f(MU.uWave, wave);
    gl.uniform1f(MU.uPhoto, this.photo ? 1 : 0);
    gl.uniform1f(MU.uHard, this.photo ? 1 : 0);
    gl.uniform1f(MU.uCell, (this.cellCss || 6) * R.dpr);
    if (this.photo) gl.uniform1f(MU.uFlow, 0);
    var TA = this.targets[ia], TB = this.targets[ib];
    gl.uniform4fv(MU.uPA_A, TA.partA); gl.uniform4fv(MU.uPB_A, TA.partB);
    gl.uniform4fv(MU.uPA_B, TB.partA); gl.uniform4fv(MU.uPB_B, TB.partB);
    var L = R.mloc;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[ia]);
    for (var k = 0; k < 3; k++) { gl.enableVertexAttribArray(L[k]); gl.vertexAttribPointer(L[k], 3, gl.FLOAT, false, 36, k * 12); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[ib]);
    for (var m = 0; m < 3; m++) { gl.enableVertexAttribArray(L[m + 3]); gl.vertexAttribPointer(L[m + 3], 3, gl.FLOAT, false, 36, m * 12); }
    gl.drawArrays(gl.POINTS, 0, this.N);
    for (var q = 0; q < 6; q++) gl.disableVertexAttribArray(L[q]);
    gl.useProgram(R.prog);
    gl.enableVertexAttribArray(R.locPos);
    gl.enableVertexAttribArray(R.locNrm);
    gl.enableVertexAttribArray(R.locAux);

    /* Once the screenshot has formed, the real one takes over, placed from
       the same numbers the points landed on. */
    if (this.ui && this.domUi) {
      /* The screen is placed by CSS; the wave writes where its edge is,
         as a fraction of the screen's own width. */
      var wr = this.ui.getBoundingClientRect();
      var cxl = (wr.left - r.left) / r.width * 2 - 1, cxr = (wr.right - r.left) / r.width * 2 - 1;
      var frac = (this.wave === undefined || this.wave < -1.5) ? -0.2 : (this.wave - cxl) / Math.max(0.001, cxr - cxl);
      this.ui.style.setProperty('--w', Math.max(-0.2, Math.min(1.2, frac)).toFixed(4));
      this.ui.classList.toggle('is-on', frac > -0.15);
    } else if (this.ui) {
      var landed = this.seq[ib] === 'ui' && mix > 0.985;
      var U = this.targets[this.seq.indexOf('ui')];
      if (U) {
        var hwc = U.hw / 3.3 * z / aspect, hhc = U.hh / 3.3 * z;
        var st = this.ui.style;
        st.width = (hwc * r.width) + 'px';
        if (!this.ui.hasAttribute('data-auto-height')) st.height = (hhc * r.height) + 'px';
        st.left = ((1 - hwc) * 0.5 * r.width) + 'px';
        st.top = ((1 - hhc) * 0.5 * r.height) + 'px';
      }
      this.ui.classList.toggle('is-on', landed);
    }
    return this.N;
  };

  /* ---- Boot ------------------------------------------------------------- */
  var renderers = [], views = [];
  var stats = { fps: 60, points: 0 };

  function boot() {
    var els = document.querySelectorAll('[data-points], [data-points-seq]');
    if (!els.length) return;
    var shared = document.body.hasAttribute('data-points-shared');
    var sharedR = null;
    try {
      if (shared) {
        var c = document.createElement('canvas');
        c.className = 'points-canvas points-canvas--fixed';
        c.setAttribute('aria-hidden', 'true');
        c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5';
        document.body.insertBefore(c, document.body.firstChild);
        sharedR = new Renderer(c, true);
        if (!sharedR.gl) return;
        renderers.push(sharedR);
      }
      Array.prototype.forEach.call(els, function (el) {
        var R = sharedR;
        if (!R) {
          if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
          var ic = document.createElement('canvas');
          ic.className = 'points-canvas';
          ic.setAttribute('aria-hidden', 'true');
          /* Objects get a feathered edge so nothing is ever cut square;
             a full bleed photograph wants its corners. */
          var feather = el.getAttribute('data-points-edge') === 'none' ? '' :
            '-webkit-mask-image:radial-gradient(ellipse closest-side at 50% 50%, #000 82%, transparent 100%);' +
            'mask-image:radial-gradient(ellipse closest-side at 50% 50%, #000 82%, transparent 100%)';
          ic.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;' + feather;
          el.appendChild(ic);
          var style = el.getAttribute('data-points-style');
          R = new Renderer(ic, false, style === 'dot', style === 'ink');
          if (!R.gl) { el.classList.add('points-off'); return; }
          renderers.push(R);
        }
        if (el.getAttribute('data-points-gain')) R.gain = parseFloat(el.getAttribute('data-points-gain'));
        /* Objects carry finer detail than photographs, so a stage may ask for a
           tighter grid than the 6px the photos use. */
        if (el.getAttribute('data-points-cell')) R.cell = parseFloat(el.getAttribute('data-points-cell'));
        var v = el.hasAttribute('data-points-seq') ? new MorphView(el, R) : new View(el, R);
        el.classList.add('points-on');
        R.views.push(v);
        views.push(v);
      });
    } catch (err) {
      console.error('[points]', err);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        for (var i = 0; i < views.length; i++) {
          if (views[i].el === en.target) {
            views[i].visible = en.isIntersecting;
            if (en.intersectionRatio > 0.2) views[i].started = true;
          }
        }
      });
    }, { rootMargin: '200px 0px', threshold: [0, 0.2] });
    views.forEach(function (v) { io.observe(v.el); });

    /* Build at most one object a frame, nearest first, so geometry never
       lands in one long stall. */
    function buildNext() {
      var best = null, bestD = 1e9, vh = window.innerHeight;
      for (var i = 0; i < views.length; i++) {
        var v = views[i];
        if (v.geo || v.failed || v instanceof MorphView) continue;
        var r = v.el.getBoundingClientRect();
        var d = r.top > vh ? r.top - vh : (r.bottom < 0 ? -r.bottom : 0);
        if (d < bestD) { bestD = d; best = v; }
      }
      if (!best || bestD > 1600) return;
      var make = OBJECTS[best.obj];
      if (!make) { best.failed = true; return; }
      var g = make();
      if (!g) return;
      var gl = best.r.gl;
      best.geo = g;
      best.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, best.buf);
      gl.bufferData(gl.ARRAY_BUFFER, g.data, gl.STATIC_DRAW);
    }

    var last = performance.now();
    function frame(now) {
      var dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      if (dt > 0) stats.fps += (1 / dt - stats.fps) * 0.06;
      if (!document.hidden) {
        buildNext();
        var total = 0;
        for (var i = 0; i < renderers.length; i++) {
          var R = renderers[i], gl = R.gl;
          var any = false;
          for (var j = 0; j < R.views.length; j++) if (R.views[j].visible) any = true;
          if (!any) continue;
          R.resize();
          if (R.dot) { R.target(); gl.bindFramebuffer(gl.FRAMEBUFFER, R.fbo); }
          gl.disable(gl.SCISSOR_TEST);
          gl.viewport(0, 0, R.w, R.h);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.enable(gl.SCISSOR_TEST);
          var cr = R.canvas.getBoundingClientRect();
          for (var k = 0; k < R.views.length; k++) total += R.views[k].draw(now / 1000, dt, cr);
          if (R.dot) R.dotPass();
        }
        stats.points = total;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ======================================================================
     Backgrounds. data-points-bg on any element puts a field of points
     behind its content: a slow terrain rolling toward a horizon, lit brand
     blue, that ripples where the pointer is. It replaces the old pixel
     field on heroes and calls to action.
     ====================================================================== */

  var VS_BG = [
    'precision highp float;',
    'attribute vec2 aG;',
    'uniform float uTime, uAspect, uDpr, uHorizon, uFlip;',
    'uniform vec2 uPtr;',
    'varying float vA;',
    'varying float vH;',
    'void main() {',
    '  float x = aG.x, z = aG.y;',
    '  float t = uTime;',
    '  float h = 0.22 * sin(x * 1.1 + t * 0.35) * cos(z * 0.8 - t * 0.28)',
    '          + 0.08 * sin((x + z) * 2.0 + t * 0.55)',
    '          + 0.04 * sin(x * 4.3 - z * 3.1 + t * 0.9);',
    '  vec2 d = vec2(x, z) - uPtr;',
    '  float rr = length(d);',
    '  h += 0.1 * exp(-rr * rr * 0.9) * sin(rr * 6.0 - t * 3.0);',
    '  vec3 p = vec3(x, h - 0.9, z + 0.6);',
    '  float w = p.z;',
    '  vec2 pr = vec2(p.x / w, p.y / w) * 1.35;',
    '  pr.y += uHorizon;',
    '  pr.y *= uFlip;',
    '  gl_Position = vec4(pr.x / uAspect, pr.y, 0.0, 1.0);',
    '  gl_PointSize = uDpr * clamp(3.4 / w, 0.9, 3.6);',
    '  float fog = smoothstep(10.0, 2.0, w) * smoothstep(0.5, 1.3, w);',
    '  vH = clamp(h * 3.2 + 0.5, 0.0, 1.0);',
    '  vA = fog * (0.55 + 0.9 * vH);',
    '}'
  ].join('\n');
  var FS_BG = [
    'precision mediump float;',
    'varying float vA;',
    'varying float vH;',
    'uniform vec3 uLo, uHi;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  if (dot(c, c) > 0.25) discard;',
    '  vec3 col = mix(uLo, uHi, vH);',
    '  gl_FragColor = vec4(col * vA, vA);',
    '}'
  ].join('\n');

  function BgView(el) {
    var t = this;
    this.el = el;
    this.visible = false;
    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.className = 'points-bg';
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    el.insertBefore(c, el.firstChild);
    this.canvas = c;
    var gl = c.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true }) ||
             c.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
    this.gl = gl;
    if (!gl) return;
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS_BG));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS_BG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { this.gl = null; return; }
    gl.useProgram(pr);
    this.U = {};
    var U = this.U;
    ['uTime', 'uAspect', 'uDpr', 'uHorizon', 'uFlip', 'uPtr', 'uLo', 'uHi'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    this.buf = gl.createBuffer();
    this.loc = gl.getAttribLocation(pr, 'aG');
    this.span = 0;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var light = el.getAttribute('data-points-bg') === 'light';
    gl.uniform3f(U.uLo, light ? 0.55 : 0.08, light ? 0.65 : 0.22, light ? 0.95 : 0.74);
    gl.uniform3f(U.uHi, light ? 0.11 : 0.62, light ? 0.39 : 0.76, light ? 0.97 : 1.0);
    this.horizon = parseFloat(el.getAttribute('data-points-horizon') || '0.05');
    this.ptr = [0, 3]; this.want = [0, 3];
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width * 2 - 1, ny = 1 - (e.clientY - r.top) / r.height * 2;
      /* Undo the projection roughly, so the ripple sits under the pointer. */
      var yy = ny - t.horizon;
      var z = yy < -0.02 ? Math.min(9, 1.35 * 0.9 / -yy - 0.6) : 9;
      t.want = [nx * (r.width / r.height) * (z + 0.6) / 1.35, z];
    }, { passive: true });
    el.addEventListener('pointerleave', function () { t.want = [0, 12]; });
  }
  /* The terrain is laid out wide enough for the stage it is drawn in, so on a
     wide band it still runs off both edges rather than ending in a corner.
     The column count grows with it, so the dots keep their spacing. */
  BgView.prototype.build = function (span) {
    var gl = this.gl;
    var small = window.innerWidth < 700;
    var cols = Math.min(small ? 220 : 460, Math.round((small ? 110 : 200) * span)), rows = small ? 70 : 110;
    var g = new Float32Array(cols * rows * 2), k = 0;
    for (var zi = 0; zi < rows; zi++) {
      for (var xi = 0; xi < cols; xi++) {
        var z = 0.4 + Math.pow(zi / (rows - 1), 1.35) * 9.5;
        g[k++] = (xi / (cols - 1) * 2 - 1) * (1.2 + z * 1.05) * span;
        g[k++] = z;
      }
    }
    this.count = cols * rows;
    this.span = span;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, g, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.loc);
    gl.vertexAttribPointer(this.loc, 2, gl.FLOAT, false, 0, 0);
  };
  BgView.prototype.draw = function (now, dt) {
    var gl = this.gl;
    if (!gl || !this.visible || document.hidden) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(2, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    /* Far edge projects to about 1.49 x span, the near edge to 2.19 x span;
       both have to clear the aspect ratio with some margin. */
    var span = Math.max(1, (w / h) / 1.3) * 1.08;
    if (Math.abs(span - this.span) > 0.12) this.build(span);
    this.ptr[0] += (this.want[0] - this.ptr[0]) * Math.min(1, dt * 3);
    this.ptr[1] += (this.want[1] - this.ptr[1]) * Math.min(1, dt * 3);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this.U.uTime, REDUCED ? 8 : now);
    gl.uniform1f(this.U.uAspect, w / h);
    gl.uniform1f(this.U.uDpr, dpr);
    gl.uniform1f(this.U.uHorizon, this.horizon);
    gl.uniform1f(this.U.uFlip, 1);
    gl.uniform2f(this.U.uPtr, this.ptr[0], this.ptr[1]);
    gl.drawArrays(gl.POINTS, 0, this.count);
  };

  var bgs = [];
  function bootBg() {
    var els = document.querySelectorAll('[data-points-bg]');
    if (!els.length) return;
    Array.prototype.forEach.call(els, function (el) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var v = new BgView(el);
      if (v.gl) { bgs.push(v); el.classList.add('points-bg-on'); }
    });
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { bgs.forEach(function (v) { if (v.el === e.target) v.visible = e.isIntersecting; }); });
    });
    bgs.forEach(function (v) { io.observe(v.el); });
    var last = performance.now();
    (function tick(now) {
      var dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      for (var i = 0; i < bgs.length; i++) bgs[i].draw(now / 1000, dt);
      requestAnimationFrame(tick);
    })(last);
  }

  window.CapacityPoints = { objects: OBJECTS, stats: stats };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
    document.addEventListener('DOMContentLoaded', bootBg);
  } else { boot(); bootBg(); }
})();
