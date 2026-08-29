/* ============================================================================
   Capacity site behaviour
   Vanilla, no dependencies. Everything here is progressive: the page is fully
   readable and navigable with this file blocked. All motion is skipped when the
   visitor prefers reduced motion.
   ========================================================================== */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function scrollMax() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  /* --------------------------------------------------------- smooth scroll -- */
  /* A short glide on top of the real scroll position. It drives the actual
     window scroll rather than transforming a wrapper, so position:sticky,
     IntersectionObserver and the browser's own scrollbar all keep working.
     Touch devices keep their native momentum, which already feels right. */

  var glide = null;

  if (!reduced && !coarse) {
    glide = (function () {
      var target = window.scrollY;
      var current = target;
      var running = false;
      var EASE = 0.115;

      function frame() {
        current += (target - current) * EASE;
        if (Math.abs(target - current) < 0.4) {
          current = target;
          running = false;
        }
        window.scrollTo(0, current);
        if (running) requestAnimationFrame(frame);
      }

      function nudge(by) {
        target = clamp(target + by, 0, scrollMax());
        if (!running) { running = true; requestAnimationFrame(frame); }
      }

      function to(y) {
        target = clamp(y, 0, scrollMax());
        if (!running) { running = true; requestAnimationFrame(frame); }
      }

      window.addEventListener('wheel', function (e) {
        if (e.ctrlKey) return;                 /* leave pinch-zoom alone */
        e.preventDefault();
        /* deltaMode 1 is lines, 2 is pages */
        var d = e.deltaY;
        if (e.deltaMode === 1) d *= 16;
        else if (e.deltaMode === 2) d *= window.innerHeight;
        nudge(d);
      }, { passive: false });

      /* Anything that scrolls the page by other means (keyboard, scrollbar
         drag, find-in-page) resyncs the glide so it never snaps backwards. */
      window.addEventListener('scroll', function () {
        if (!running) { target = current = window.scrollY; }
      }, { passive: true });

      window.addEventListener('resize', function () {
        target = clamp(target, 0, scrollMax());
      }, { passive: true });

      return { to: to };
    })();
  }

  /* In-page links ride the same glide instead of jumping. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute('href');
    if (!id || id === '#') return;
    var dest = document.getElementById(id.slice(1));
    if (!dest) return;
    e.preventDefault();
    var y = dest.getBoundingClientRect().top + window.scrollY - 88;
    if (glide) glide.to(y);
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', id);
  });

  /* ------------------------------------------------------------------ nav -- */
  /* The nav floats transparent over the dark hero, then picks up the light
     surface once you scroll. Pages without a dark hero ship `is-solid`. */

  var nav = $('#nav');

  if (nav) {
    var burger = $('#burger');
    var navLinks = $('#navLinks');
    if (burger && navLinks) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });
      navLinks.addEventListener('click', function (e) {
        if (e.target.closest('a')) {
          nav.classList.remove('is-open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) {
          nav.classList.remove('is-open');
          burger.setAttribute('aria-expanded', 'false');
          burger.focus();
        }
      });
    }
  }

  /* --------------------------------------------------------- scroll rig -- */
  /* One rAF-coalesced handler drives every scroll-linked piece. Each reads its
     own progress: 0 when its track's top meets the viewport top, 1 when its
     bottom is one viewport height above. */

  var drivers = [];
  var ticking = false;

  function pump() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      for (var i = 0; i < drivers.length; i++) drivers[i]();
    });
  }

  function trackProgress(el) {
    var rect = el.getBoundingClientRect();
    var travel = rect.height - window.innerHeight;
    if (travel <= 0) return rect.top <= 0 ? 1 : 0;
    return clamp(-rect.top / travel, 0, 1);
  }

  window.addEventListener('scroll', pump, { passive: true });
  window.addEventListener('resize', pump, { passive: true });
  /* Run once at start too: a reload part-way down the page, or a #hash entry,
     would otherwise sit in the initial state until the first scroll. */
  window.addEventListener('load', pump);

  /* --------------------------------------------------------------- reveal -- */

  var revealables = $$('[data-r]');

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
    $$('[data-count]').forEach(settleCount);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
        $$('[data-count]', entry.target).forEach(runCount);
        if (entry.target.hasAttribute('data-count')) runCount(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });

    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        runCount(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    $$('[data-count]').forEach(function (el) {
      if (!el.closest('[data-r]')) cio.observe(el);
    });
  }

  /* ------------------------------------------------------------- counters -- */

  function format(el, value) {
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var body = value.toFixed(dec);
    if (dec === 0) body = Number(body).toLocaleString('en-GB');
    return (el.getAttribute('data-prefix') || '') + body + (el.getAttribute('data-suffix') || '');
  }

  function settleCount(el) {
    el.textContent = format(el, parseFloat(el.getAttribute('data-count')));
  }

  function runCount(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    var goal = parseFloat(el.getAttribute('data-count'));
    if (isNaN(goal)) return;
    if (reduced) { settleCount(el); return; }

    var duration = 1200;
    var started = null;
    (function step(now) {
      if (started === null) started = now;
      var t = Math.min((now - started) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(el, goal * eased);
      if (t < 1) requestAnimationFrame(step);
      else settleCount(el);
    })(performance.now());
  }

  /* ---------------------------------------------------------- product UI -- */
  /* The screenshot stack drifts against the scroll, so the group has weight.
     --lift only, the rotation stays in CSS where it belongs. */

  var st3ds = $$('.st3d');

  if (st3ds.length) {
    if ('IntersectionObserver' in window) {
      var seen = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        });
      }, { threshold: 0.15 });
      st3ds.forEach(function (el) { seen.observe(el); });
    } else {
      st3ds.forEach(function (el) { el.classList.add('is-in'); });
    }

    if (!reduced) {
      drivers.push(function () {
        var vh = window.innerHeight || 1;
        for (var i = 0; i < st3ds.length; i++) {
          var el = st3ds[i];
          var r = el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) continue;
          var p = clamp((vh - r.top) / (vh + r.height), 0, 1);
          el.style.setProperty('--lift', ((0.5 - p) * 46).toFixed(1) + 'px');
          /* Cards sit closer to the main screen while it is still low in the
             viewport and push out toward the reader as it rises. Depth only:
             nothing here turns the group. */
          var rise = clamp((vh - r.top) / (vh * 0.85), 0, 1);
          el.style.setProperty('--zk', (0.3 + rise * 0.7).toFixed(3));
          /* Laid back at 30 degrees while it is still low in the viewport,
             standing up to square-on as it rises. */
          el.style.setProperty('--rx', ((1 - rise) * 30).toFixed(2) + 'deg');
        }
      });
    }
  }

  /* -------------------------------------------------- statement fill ----- */
  /* Words go from muted to solid as you scroll, then the whole band inverts to
     black so it meets the dark section below with no seam. */

  var stTrack = $('.statement-track');
  var stFill = $('[data-fill]');

  if (stTrack && stFill) {
    if (reduced) {
      stTrack.classList.add('is-static');
    } else {
      var words = stFill.textContent.trim().split(/\s+/);
      stFill.textContent = '';
      var wordEls = words.map(function (word, i) {
        var span = document.createElement('span');
        span.className = 'w';
        span.textContent = word;
        stFill.appendChild(span);
        if (i < words.length - 1) stFill.appendChild(document.createTextNode(' '));
        return span;
      });

      /* fill: words are fully lit here. hand: the copy gives the frame over to
         the graphic. invert: the band flips to meet the dark section below.
         Side by side, the desktop shows the statement and the graphic at once,
         so it has no handover and the stop sits past the end of the track. A
         phone has room for one of them, so the same held frame runs them as two
         beats and the fill has to finish sooner to leave room for the second.
         Read live rather than cached, so a rotation lands on the right set. */
      var narrow = window.matchMedia ? window.matchMedia('(max-width: 860px)') : null;
      var WIDE = { fill: 0.68, hand: 2, invert: 0.76 };
      var NARROW = { fill: 0.44, hand: 0.56, invert: 0.84 };
      var litCount = -1;
      var wasLate = null;

      drivers.push(function () {
        var stop = (narrow && narrow.matches) ? NARROW : WIDE;
        var p = trackProgress(stTrack);
        var lit = Math.round(clamp(p / stop.fill, 0, 1) * wordEls.length);
        if (lit !== litCount) {
          for (var i = 0; i < wordEls.length; i++) {
            wordEls[i].classList.toggle('is-on', i < lit);
          }
          litCount = lit;
        }
        var late = p >= stop.hand;
        if (late !== wasLate) {
          stTrack.classList.toggle('is-handover', late);
          wasLate = late;
        }
        stTrack.classList.toggle('is-inverted', p >= stop.invert);
      });
    }
  }

  /* ------------------------------------------------------------- dial ---- */
  /* The ring turns continuously with the scroll position rather than snapping
     between features. Rotation is written every frame and each icon is
     counter-rotated by the same amount so it always reads upright. Only the
     copy switches discretely, on a crossfade. */

  var dialTrack = $('.dial-track');
  var dialRing = $('#dialRing');

  if (dialTrack && dialRing) {
    var nodes = $$('.dial__node', dialRing);
    var icons = nodes.map(function (n) { return $('.dial__icon', n); });
    var slides = $$('.dial-slide', $('#dialSlides'));
    var railHost = $('#dialRail');
    var railItems = railHost ? $$('span', railHost) : [];
    var countEl = $('#dialCount');
    var barEl = $('#dialBar');
    var total = nodes.length;
    var stepAngle = 360 / total;
    var span = total - 1;          /* first feature at p=0, last at p=1 */

    if (reduced) {
      dialTrack.classList.add('is-static');
    } else {
      var lastRot = null;
      var activeIdx = -1;

      var turn = function (rot) {
        if (rot === lastRot) return;
        lastRot = rot;
        dialRing.style.transform = 'rotate(' + rot.toFixed(3) + 'deg)';
        for (var i = 0; i < icons.length; i++) {
          if (icons[i]) {
            icons[i].style.transform = 'rotate(' + (-(i * stepAngle + rot)).toFixed(3) + 'deg)';
          }
        }
      };

      var mark = function (index) {
        if (index === activeIdx) return;
        activeIdx = index;
        nodes.forEach(function (n, i) { n.classList.toggle('is-active', i === index); });
        slides.forEach(function (s, i) { s.classList.toggle('is-active', i === index); });
        railItems.forEach(function (s, i) { s.classList.toggle('is-active', i === index); });
        if (countEl) {
          countEl.textContent = String(index + 1).padStart(2, '0') + ' / ' +
                                String(total).padStart(2, '0');
        }
      };

      turn(0);
      mark(0);

      drivers.push(function () {
        var p = trackProgress(dialTrack);
        /* Offset by half a step so the active node crosses the pin in the
           middle of its slot rather than at the start of it. Without this the
           highlighted icon drifts a full step away from the line it is meant
           to be pointing at, and the copy looks detached from the dial. */
        turn(-(p * span - 0.5) * stepAngle);
        /* floor, not round: the highlight changes hands on the boundary, so a
           feature is never active before the one before it has finished. */
        mark(clamp(Math.floor(p * span), 0, span));
        if (barEl) barEl.style.setProperty('--p', p);
      });
    }
  }

  /* ------------------------------------------------------ pixel field ---- */
  /* A field of small squares whose density flows. Ordered (Bayer) dithering
     turns the smooth density into hard on/off pixels, which is what gives the
     stippled gradient edges. One fill colour per pass, so a frame is a few
     thousand fillRects and nothing else. */

  /* Every .hero__field on the page gets its own instance, so a page can run one
     behind the hero and another behind the call to action. */
  $$('.hero__field').forEach(function (field) {
    if (reduced || !field.getContext) return;
    (function () {
      var ctx = field.getContext('2d', { alpha: true });
      var light = field.getAttribute('data-tone') === 'light';
      var BODY = light ? 'rgba(27, 99, 248, .45)' : 'rgba(27, 99, 248, .85)';
      var PEAK = light ? 'rgba(27, 99, 248, .8)' : 'rgba(120, 175, 255, .9)';
      /* Coarser on a phone. At the desktop pitch a 390px band carries about
         forty columns of 6px squares, which reads as noise behind the copy
         rather than as a field. */
      var narrow = window.matchMedia && window.matchMedia('(max-width: 620px)').matches;
      var CELL = narrow ? 14 : 10;   /* grid pitch */
      var DOT = narrow ? 8 : 6;      /* drawn square */
      var BAYER = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
      ];
      var W = 0, H = 0, cols = 0, rows = 0, t = 0, last = 0, alive = true;

      function size() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var rect = field.getBoundingClientRect();
        W = rect.width; H = rect.height;
        if (!W || !H) return;
        field.width = Math.round(W * dpr);
        field.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(W / CELL) + 1;
        rows = Math.ceil(H / CELL) + 1;
      }

      /* Two sine layers, the second warped by the first: slow liquid drift. */
      function density(x, y, time) {
        var nx = x * 0.031, ny = y * 0.042;
        var warp = Math.sin(nx * 1.7 + time * 0.42) + Math.cos(ny * 1.3 - time * 0.31);
        var v = Math.sin(nx + warp * 0.55 + time * 0.24) *
                Math.cos(ny - warp * 0.38 - time * 0.19);
        return (v + 1) / 2;
      }

      function draw(now) {
        requestAnimationFrame(draw);
        if (!alive || now - last < 33) return;
        last = now;
        t += 0.03;
        ctx.clearRect(0, 0, W, H);

        /* Pass one: the body of the field. Pass two: only the densest cells,
           in a paler blue, which reads as highlight without a second colour
           lookup per cell. */
        var bright = [];
        ctx.fillStyle = BODY;
        for (var y = 0; y < rows; y++) {
          for (var x = 0; x < cols; x++) {
            /* Stretched hard so the field has genuinely empty regions and
               genuinely solid ones, with dithered gradients between. */
            var v = (density(x, y, t) - 0.34) * 2.3;
            if (v <= (BAYER[y & 3][x & 3] + 0.5) / 16) continue;
            if (v > 0.86) { bright.push(x, y); continue; }
            ctx.fillRect(x * CELL, y * CELL, DOT, DOT);
          }
        }
        ctx.fillStyle = PEAK;
        for (var i = 0; i < bright.length; i += 2) {
          ctx.fillRect(bright[i] * CELL, bright[i + 1] * CELL, DOT, DOT);
        }
      }

      size();
      window.addEventListener('resize', size, { passive: true });

      /* The band is sized by its own copy, so a late web font, an image landing
         or the product stack settling changes the canvas box after the first
         paint with no resize event to go with it. The bitmap would keep the
         height it was measured at and the browser would stretch it to the new
         box, which turns every square into a rectangle. Re-measure whenever the
         box itself changes. size() writes bitmap attributes, not the CSS box,
         so this cannot feed back into another resize. */
      if ('ResizeObserver' in window) {
        var lastBox = '';
        new ResizeObserver(function () {
          var box = Math.round(field.clientWidth) + 'x' + Math.round(field.clientHeight);
          if (box === lastBox) return;
          lastBox = box;
          size();
        }).observe(field);
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(size);
      }

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          alive = entries[0].isIntersecting;
        }, { threshold: 0 }).observe(field);
      }

      requestAnimationFrame(draw);
    })();
  });

  /* ----------------------------------------------------------- expand ---- */
  /* The blank panel opens from a small card to full bleed, darkening as it
     goes, and the demo call to action resolves once it fills the screen. */

  var expandTrack = $('.expand-track');
  var expandStage = $('#expandStage');

  if (expandTrack && expandStage) {
    if (reduced) {
      expandTrack.classList.add('is-static');
    } else {
      drivers.push(function () {
        var p = trackProgress(expandTrack);
        expandStage.style.setProperty('--e', clamp(p / 0.7, 0, 1).toFixed(4));
        expandStage.style.setProperty('--c', clamp((p - 0.58) / 0.26, 0, 1).toFixed(4));
      });
    }
  }

  /* --------------------------------------------------------- dot screen -- */
  /* Paints a photograph as a grid of dots sized by luminance. The dot pitch is
     the resolution, so a small source file stops being a small source file, and
     it speaks the same language as the pixel field in the hero.
     Redraws only when the frame or the pitch actually changes, never per
     scroll frame: at a 6px pitch a full-bleed panel is ~50k dots. */

  function dotScreen(canvas, img, cell, dpr) {
    if (!img || !img.complete || !img.naturalWidth) return false;

    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    /* Backstop: the bitmap size feeds the element's intrinsic size, so a layout
       slip here could grow the canvas without limit. Refuse rather than run. */
    if (w > 4096 || h > 4096) return false;
    var scale = dpr || 1;
    if (canvas.width !== w * scale || canvas.height !== h * scale) {
      canvas.width = w * scale;
      canvas.height = h * scale;
    }

    var ctx = canvas.getContext('2d');
    var cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);

    /* Sample the photo down to one pixel per dot, cropped like object-fit:
       cover so it fills the panel without distorting. */
    var off = dotScreen._off || (dotScreen._off = document.createElement('canvas'));
    off.width = cols; off.height = rows;
    var octx = off.getContext('2d', { willReadFrequently: true });
    var sr = img.naturalWidth / img.naturalHeight, dr = w / h;
    var sw = sr > dr ? img.naturalHeight * dr : img.naturalWidth;
    var sh = sr > dr ? img.naturalHeight : img.naturalWidth / dr;
    octx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2,
                   sw, sh, 0, 0, cols, rows);

    var data;
    try { data = octx.getImageData(0, 0, cols, rows).data; } catch (e) { return false; }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var half = cell / 2, TAU = Math.PI * 2;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = (y * cols + x) << 2;
        var l = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        l = (l - 0.06) * 1.42;
        if (l < 0.03) continue;
        if (l > 1) l = 1;
        var g = (188 + l * 67) | 0;
        ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + Math.min(255, g + (l * 14) | 0) + ')';
        ctx.beginPath();
        ctx.arc(x * cell + half, y * cell + half, Math.sqrt(l) * cell * 0.6, 0, TAU);
        ctx.fill();
      }
    }
    return true;
  }

  /* ---------------------------------------------------------- funnel ------ */
  /* Pointing at a stage lights its band of the funnel. Scrolling does the same,
     so the shape keeps step with whatever you are reading. */

  var funnel = $('.funnel');

  if (funnel) {
    var rows = $$('.funnel__row', funnel);
    var setActive = function (i) { funnel.setAttribute('data-active', String(i)); };

    rows.forEach(function (el) {
      var i = el.getAttribute('data-i');
      ['pointerenter', 'focus', 'click'].forEach(function (ev) {
        el.addEventListener(ev, function () { setActive(i); });
      });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          funnel.classList.add('is-in');
          obs.unobserve(e.target);
        });
      }, { threshold: 0.2 }).observe(funnel);

      var band = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) setActive(e.target.getAttribute('data-i'));
        });
      }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
      rows.forEach(function (el) { band.observe(el); });
    } else {
      funnel.classList.add('is-in');
    }

  }

  /* ------------------------------------------------------------- cta shots -- */
  /* Flicks through the set as you scroll and settles on one once the panel is
     full bleed, while the dot pitch tightens so the picture resolves as it
     takes over the screen. */

  var expandScreen = $('#expandScreen');

  if (expandScreen && expandTrack) {
    var shots = $$('.expand__shot');
    /* Quantised, so a continuous scroll causes a handful of redraws, not one
       per frame. Last entry is the held, fully resolved state. */
    var PITCH = [17, 13, 10, 8, 6];
    var SETTLE = 0.86;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var lastKey = '';

    var paint = function (shot, pitch) {
      var key = shot + ':' + pitch + ':' + expandScreen.clientWidth;
      if (key === lastKey) return;
      if (dotScreen(expandScreen, shots[shot], PITCH[pitch], dpr)) lastKey = key;
    };

    /* The shots are loaders for the dot screen, so they are display:none. A
       lazy image with no box never enters the viewport and so never loads,
       which left the finale painting nothing at all. Promote them once the
       section is a couple of screens away: still off the critical path, but
       decoded well before the panel opens. */
    (function kickLoads() {
      var wake = function () {
        shots.forEach(function (im) {
          if (im.loading === 'lazy') im.loading = 'eager';
          /* Safari ignores the property change on its own, so nudge the fetch. */
          if (!im.complete) im.src = im.src;
        });
      };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries, obs) {
          if (!entries[0].isIntersecting) return;
          obs.disconnect();
          wake();
        }, { rootMargin: '150% 0px' }).observe(expandTrack);
      } else {
        wake();
      }
    }());

    if (reduced) {
      var once = function () { paint(shots.length - 1, PITCH.length - 1); };
      shots.forEach(function (im) { im.addEventListener('load', once); });
      once();
    } else {
      drivers.push(function () {
        var p = trackProgress(expandTrack);
        var shot = p >= SETTLE
          ? shots.length - 1
          : Math.min(shots.length - 1,
                     Math.floor((p / SETTLE) * shots.length * 3) % shots.length);
        var pitch = p >= SETTLE
          ? PITCH.length - 1
          : Math.min(PITCH.length - 1, Math.floor((p / SETTLE) * PITCH.length));
        paint(shot, pitch);
      });
      /* The first frames may not have decoded by the time the driver first
         runs, so nudge it once each one lands. */
      shots.forEach(function (im) {
        im.addEventListener('load', function () { lastKey = ''; });
      });
      window.addEventListener('resize', function () { lastKey = ''; }, { passive: true });
    }
  }

  /* --------------------------------------------------------- dot bands ---- */
  /* Full-bleed photograph on the case study, painted with the same renderer as
     the home page CTA. It resolves once as it arrives rather than on scroll. */

  var bands = $$('.dotband, .chero__shot');

  if (bands.length) {
    var dpr2 = Math.min(window.devicePixelRatio || 1, 2);

    bands.forEach(function (band) {
      var canvas = $('.dotband__screen', band);
      var img = $('.dotband__src', band);
      if (!canvas || !img) return;

      /* Tighter pitch on a phone: the panel is much smaller there, and at the
         desktop pitch the picture stops being readable. */
      var narrow = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
      var PITCH = narrow ? 3 : 6;

      var draw = function () {
        var ok = dotScreen(canvas, img, PITCH, dpr2);
        if (ok) canvas.classList.add('is-drawn');
        return ok;
      };

      var resolve = draw;

      if (!img.complete) img.addEventListener('load', function () { draw(); });
      window.addEventListener('resize', function () { draw(); }, { passive: true });

      /* The hero is sized by its copy, so a late web font or an image landing
         changes the canvas box after the first paint. Without a redraw the
         picture stays at whatever size it was drawn at and sits in the corner.
         The draw sets bitmap attributes, not the CSS box, so this cannot loop. */
      if ('ResizeObserver' in window) {
        var lastBox = '';
        new ResizeObserver(function () {
          var box = canvas.clientWidth + 'x' + canvas.clientHeight;
          if (box === lastBox) return;
          lastBox = box;
          draw();
        }).observe(canvas);
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { draw(); });
      }

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            obs.unobserve(e.target);
            if (img.complete && img.naturalWidth) resolve();
            else img.addEventListener('load', resolve);
          });
        }, { threshold: 0.15 }).observe(band);
      } else {
        resolve();
      }
    });
  }

  /* ------------------------------------------------------ brand swap ------ */
  /* Feature page. The checkout takes on a different venue's identity every few
     seconds while the line underneath it never changes. */

  var swap = $('#swap');

  if (swap && !reduced) {
    var ids = $$('.swap__id', swap);
    var card = $('.swap__card', swap);
    var at = 0;
    var apply = function (i) {
      ids.forEach(function (el, n) { el.classList.toggle('is-on', n === i); });
      if (card) card.style.setProperty('--vc', ids[i].style.getPropertyValue('--vc').trim());
    };
    if (ids.length > 1) {
      apply(0);
      setInterval(function () { at = (at + 1) % ids.length; apply(at); }, 2600);
    }
  }

  /* ---------------------------------------------------------- journey ----- */
  /* Slides the rail so the active screen is centred, and steps on a timer once
     the section is on view. Clicking a neighbour or a step jumps straight to it.
     Pauses off screen, so the reader never arrives partway through. */

  var jflow = $('#jflow');

  if (jflow) {
    var jtrack = $('#jtrack', jflow);
    var jslides = $$('.jslide', jflow);
    var jdots = $$('.jdot', jflow);
    var jcaps = $$('.jcap', jflow);
    var DWELL = 4600;
    var at = 0, timer = null;

    var show = function (i) {
      at = i;
      jtrack.style.setProperty('--i', i);
      jslides.forEach(function (el, n) { el.classList.toggle('is-on', n === i); });
      jcaps.forEach(function (el, n) { el.classList.toggle('is-on', n === i); });
      jdots.forEach(function (el, n) {
        el.classList.toggle('is-on', n === i);
        el.classList.toggle('is-done', n < i);
        el.setAttribute('aria-current', n === i ? 'true' : 'false');
      });
    };

    var stop = function () { if (timer) { clearInterval(timer); timer = null; } };
    var start = function () {
      if (timer || reduced) return;
      timer = setInterval(function () { show((at + 1) % jslides.length); }, DWELL);
    };
    var jump = function (i) { stop(); show(i); start(); };

    jflow.style.setProperty('--jdwell', DWELL + 'ms');
    jslides.concat(jdots).forEach(function (el) {
      el.addEventListener('click', function () { jump(+el.getAttribute('data-i')); });
    });
    show(0);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0.3 }).observe(jflow);
    } else {
      start();
    }
  }

  /* --------------------------------------------------------- identify ----- */
  /* Rows convert one at a time as the section crosses the viewport. */

  var flip = $('#flip');

  if (flip) {
    var flipRows = $$('.flip__row', flip);
    var flipped = -1;

    var setFlipped = function (n) {
      if (n === flipped) return;
      for (var i = 0; i < flipRows.length; i++) {
        flipRows[i].classList.toggle('is-flipped', i < n);
      }
      flip.classList.toggle('is-done', n >= flipRows.length);
      flipped = n;
    };

    if (reduced) {
      setFlipped(flipRows.length);
    } else {
      drivers.push(function () {
        var r = flip.getBoundingClientRect();
        var vh = window.innerHeight || 1;
        if (r.bottom < -100 || r.top > vh + 100) return;
        /* Starts as the block reaches the lower third, finished well before it
           leaves, so nothing converts off screen. */
        var p = clamp((vh * 0.86 - r.top) / (vh * 0.56), 0, 1);
        setFlipped(Math.round(p * flipRows.length));
      });
    }
  }

  /* ------------------------------------------------------------- week ----- */
  /* Industry page. The bars build once the chart is on screen. */

  var weekBand = $('.week-band');

  if (weekBand) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          weekBand.classList.add('is-in');
          obs.unobserve(e.target);
        });
      }, { threshold: 0.3 }).observe(weekBand);
    } else {
      weekBand.classList.add('is-in');
    }
  }

  /* ------------------------------------------------------------- accordion -- */
  /* <details> has no transition of its own: the browser shows and hides the
     content outright. So intercept the toggle, animate the wrapper's height,
     and hold the open attribute back until a close has finished. Without JS the
     element still works, it just snaps. */

  var qas = $$('.qa');

  if (qas.length) {
    var DUR = 320;

    var slide = function (qa, open, done) {
      var panel = $('.qa__a', qa);
      var inner = $('.qa__inner', qa);
      if (!panel || !inner) { if (done) done(); return; }

      if (qa._anim) { qa._anim.cancel(); qa._anim = null; }
      if (reduced || !panel.animate) {
        if (done) done();
        return;
      }

      var target = inner.getBoundingClientRect().height;
      var from = open ? 0 : target;
      var to = open ? target : 0;
      qa._anim = panel.animate(
        [{ height: from + 'px', opacity: open ? 0 : 1 },
         { height: to + 'px', opacity: open ? 1 : 0 }],
        { duration: DUR, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' });
      qa._anim.onfinish = function () {
        qa._anim = null;
        if (done) done();
      };
      qa._anim.oncancel = function () { qa._anim = null; };
    };

    qas.forEach(function (qa) {
      var summary = $('.qa__q', qa);
      if (!summary) return;

      summary.addEventListener('click', function (e) {
        e.preventDefault();

        if (qa.open) {
          slide(qa, false, function () { qa.open = false; });
          return;
        }

        /* Same exclusive behaviour the name attribute gives, but animated. */
        qas.forEach(function (other) {
          if (other !== qa && other.open) {
            slide(other, false, function () { other.open = false; });
          }
        });

        qa.open = true;
        slide(qa, true);
      });
    });
  }

  /* ------------------------------------------------------------ demo form -- */
  /* Posts to /api/demo, which emails the lead. The endpoint holds the API key,
     so nothing sensitive is in this file. */

  var form = $('#form');
  if (form) {
    var done = $('#done');
    var valid = function (id) {
      var el = document.getElementById(id);
      var value = el.value.trim();
      var ok = el.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : value.length > 0;
      el.closest('.field').classList.toggle('is-invalid', !ok);
      return ok;
    };

    var errorBox = $('#formError');
    var button = $('button[type="submit"]', form);

    var showError = function (message) {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.hidden = false;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (errorBox) errorBox.hidden = true;

      var fields = ['venue', 'name', 'email'];
      var ok = fields.map(valid).every(Boolean);
      if (!ok) {
        var firstBad = $('.field.is-invalid input', form);
        if (firstBad) firstBad.focus();
        return;
      }

      var payload = { page: location.href };
      Array.prototype.forEach.call(form.elements, function (el) {
        if (el.name) payload[el.name] = el.value;
      });

      if (button) { button.disabled = true; button.textContent = 'Sending...'; }

      fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('Endpoint responded ' + res.status);
        $('#doneName').textContent = document.getElementById('name').value.trim().split(' ')[0] || 'there';
        form.hidden = true;
        done.hidden = false;
        done.setAttribute('tabindex', '-1');
        done.focus();
      }).catch(function (err) {
        if (button) {
          button.disabled = false;
          button.innerHTML = 'Book my demo <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>';
        }
        showError('That did not send. Please try again in a moment.');
        console.error('[demo]', err);
      });
    });

    form.addEventListener('input', function (e) {
      var field = e.target.closest('.field.is-invalid');
      if (field) field.classList.remove('is-invalid');
    });
  }

  /* --------------------------------------------------------- nav menu ----- */
  /* Hover already opens the dropdown in CSS. This is for touch and keyboard,
     where there is no hover to rely on. */

  var navToggle = $('.nav__toggle');

  if (navToggle) {
    navToggle.addEventListener('click', function (e) {
      e.preventDefault();
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav__group')) navToggle.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') navToggle.setAttribute('aria-expanded', 'false');
    });
  }

  /* --------------------------------------------------- nav over surface -- */
  /* The pill is always dark, so the logomark flips to white while a light
     section is behind it and back to brand blue over a dark one. The switch is
     driven off the nav's own midline, so it lands exactly on the boundary. */

  /* Two bands are markup-light but paint black at some point in their scroll:
     the statement once it inverts, and the expand finale once its panel fills
     the screen. Both only count as dark surfaces while that is true. */
  var darkBands = $$('.on-dark').concat($$('.statement-track'), $$('.expand-track'));

  if (nav && darkBands.length) {
    var wasDark = null;
    var isDark = function (el) {
      if (el.classList.contains('statement-track')) {
        return el.classList.contains('is-inverted');
      }
      if (el.classList.contains('expand-track')) {
        if (el.classList.contains('is-static')) return true;
        /* Not 0.5: the panel is centred, so it only reads as the surface
           behind the nav once it is close to full bleed. */
        return expandStage
          ? parseFloat(expandStage.style.getPropertyValue('--e') || 0) > 0.9
          : false;
      }
      return true;
    };
    drivers.push(function () {
      var mid = nav.getBoundingClientRect().top + 42;
      var over = false;
      for (var i = 0; i < darkBands.length; i++) {
        var r = darkBands[i].getBoundingClientRect();
        if (r.height && r.top <= mid && r.bottom >= mid && isDark(darkBands[i])) { over = true; break; }
      }
      if (over !== wasDark) {
        nav.classList.toggle('nav--over-dark', over);
        wasDark = over;
      }
    });
  }


  /* ------------------------------------------------------------- consent --- */
  /* PECR regulation 6. Optional cookies must not be set before the visitor
     agrees, and withdrawing must be as easy as agreeing.

     Read a decision with consented('analytics') or consented('advertising'),
     and listen for 'capacity:consent' too, since the answer can arrive after
     load. Any tag added through a tag manager must honour the same gate.

     NOTE ON THE FIRST LAYER: the bar offers Accept all and Manage cookies.
     Refusal takes one extra click, through the dialog. The ICO's stated
     position is that rejecting should be as easy as accepting at the first
     layer, so a Reject all button in the bar itself is the safer construction.
     To add one, drop a second button next to .consent__accept with
     data-consent="reject". The handler already supports it. */

  var CONSENT_KEY = 'capacity.consent';
  var CONSENT_VERSION = 2;
  var CONSENT_MAX_AGE = 365 * 24 * 60 * 60 * 1000;   /* 12 months, per the policy */
  var CONSENT_CATS = ['analytics', 'advertising'];

  function consentRead() {
    try {
      var v = JSON.parse(window.localStorage.getItem(CONSENT_KEY));
      if (!v || v.version !== CONSENT_VERSION) return null;
      if (Date.now() - new Date(v.at).getTime() > CONSENT_MAX_AGE) return null;
      return v;
    } catch (e) { return null; }
  }

  function consentWrite(choices) {
    var record = { version: CONSENT_VERSION, at: new Date().toISOString() };
    CONSENT_CATS.forEach(function (c) { record[c] = !!choices[c]; });
    try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch (e) {}
    window.capacityConsent = record;
    try { window.dispatchEvent(new CustomEvent('capacity:consent', { detail: record })); } catch (e) {}
    return record;
  }

  function consentAll(value) {
    var o = {};
    CONSENT_CATS.forEach(function (c) { o[c] = value; });
    return o;
  }

  window.consented = function (purpose) {
    var v = consentRead();
    return !!(v && v[purpose || 'analytics']);
  };

  (function consentUI() {
    var stored = consentRead();
    if (stored) window.capacityConsent = stored;

    var bar = null, dlg = null;

    /* ---- bar ---- */
    function buildBar() {
      if (bar) return bar;
      bar = document.createElement('section');
      bar.className = 'consent';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Cookie consent');
      bar.innerHTML =
        '<div class="wrap"><div class="consent__inner">' +
          '<p class="consent__text">' +
            '<span class="consent__label">Cookies</span>' +
            'We use optional cookies for analytics and advertising.' +
            /* Trimmed on a phone, where the bar has to stay a thin strip. */
            '<span class="consent__long"> Essential cookies are always on.</span>' +
            '<button type="button" class="consent__manage" data-consent="manage">Manage cookies</button>' +
          '</p>' +
          '<button type="button" class="btn btn--primary consent__accept" data-consent="accept">Accept all</button>' +
        '</div></div>';
      document.body.appendChild(bar);
      return bar;
    }

    function showBar() {
      buildBar().hidden = false;
      if (!reduced) {
        bar.classList.remove('consent--in');
        void bar.offsetWidth;
        bar.classList.add('consent--in');
      }
    }

    function hideBar() { if (bar) bar.hidden = true; }

    /* ---- preferences dialog ---- */
    function buildDialog() {
      if (dlg) return dlg;
      dlg = document.createElement('dialog');
      dlg.className = 'cprefs';
      dlg.innerHTML =
        '<form method="dialog"><div class="cprefs__body">' +
          '<h2>Cookie preferences</h2>' +
          '<p class="cprefs__lede">Essential cookies are required for the site to work and cannot be ' +
            'switched off. Everything else is off unless you turn it on. See our ' +
            '<a href="cookies.html">Cookie Policy</a>.</p>' +
          '<div class="cprefs__row">' +
            '<input type="checkbox" id="cpref-ess" checked disabled />' +
            '<div><b>Essential</b><span>Remembers your cookie choice and keeps the site working.</span></div>' +
          '</div>' +
          '<div class="cprefs__row">' +
            '<input type="checkbox" id="cpref-analytics" data-cat="analytics" />' +
            '<div><b>Analytics</b><span>Measures how the site is used, so we can improve it.</span></div>' +
          '</div>' +
          '<div class="cprefs__row">' +
            '<input type="checkbox" id="cpref-advertising" data-cat="advertising" />' +
            '<div><b>Advertising</b><span>Measures our advertising and shows it to people who have ' +
              'visited this site. Set by Google, Meta, TikTok and Snapchat.</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="cprefs__actions">' +
          '<button type="button" class="btn btn--outline btn--sm" data-consent="reject">Reject all</button>' +
          '<button type="button" class="btn btn--outline btn--sm" data-consent="save">Save preferences</button>' +
          '<button type="button" class="btn btn--primary btn--sm" data-consent="accept">Accept all</button>' +
        '</div></form>';
      document.body.appendChild(dlg);
      return dlg;
    }

    function openDialog() {
      buildDialog();
      var current = consentRead() || {};
      CONSENT_CATS.forEach(function (c) {
        var box = dlg.querySelector('[data-cat="' + c + '"]');
        if (box) box.checked = !!current[c];
      });
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }

    function closeDialog() {
      if (!dlg) return;
      if (typeof dlg.close === 'function' && dlg.open) dlg.close();
      else dlg.removeAttribute('open');
    }

    function readDialog() {
      var o = {};
      CONSENT_CATS.forEach(function (c) {
        var box = dlg && dlg.querySelector('[data-cat="' + c + '"]');
        o[c] = !!(box && box.checked);
      });
      return o;
    }

    /* ---- one handler for bar, dialog and footer links ---- */
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest && ev.target.closest('[data-consent], [data-consent-settings]');
      if (!el) return;
      var action = el.getAttribute('data-consent') ||
                   (el.hasAttribute('data-consent-settings') ? 'manage' : null);
      if (!action) return;
      ev.preventDefault();

      if (action === 'manage') { openDialog(); return; }
      if (action === 'accept') consentWrite(consentAll(true));
      else if (action === 'reject') consentWrite(consentAll(false));
      else if (action === 'save') consentWrite(readDialog());
      else return;

      closeDialog();
      hideBar();
    });

    /* The ask waits for the visitor to start scrolling, so it does not land on
       top of the page the moment it opens. Deferring it is safe because nothing
       optional is set until a choice is made, so there is no processing to
       inform anyone about in the meantime. A page shorter than the viewport
       cannot be scrolled, hence the fallback timer. */
    if (!stored) (function armReveal() {
      var SCROLL_TRIGGER = 120;
      var FALLBACK_MS = 8000;
      var done = false;
      var timer;

      function reveal() {
        if (done) return;
        done = true;
        window.removeEventListener('scroll', onScroll);
        clearTimeout(timer);
        /* A choice may have been made from the footer while this was pending,
           in which case there is nothing left to ask. */
        if (!consentRead()) showBar();
      }
      function onScroll() { if (window.scrollY > SCROLL_TRIGGER) reveal(); }

      window.addEventListener('scroll', onScroll, { passive: true });
      timer = setTimeout(reveal, FALLBACK_MS);
      onScroll();   /* covers a restored scroll position on back or reload */
    }());
  }());

  pump();
})();
