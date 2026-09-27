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

      /* A wheel over something that scrolls on its own (an open dialog, a
         long list) belongs to that thing, not to the page. */
      function ownsWheel(el, dy) {
        for (; el && el !== document.body && el.nodeType === 1; el = el.parentNode) {
          if (el.matches('dialog[open], [data-glide-stop]')) return true;
          var oy = getComputedStyle(el).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
            if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
          }
        }
        return false;
      }

      /* Pinned sections are read one step at a time, so the wheel carries
         less distance while one fills the screen. */
      var heavy = $$('[data-glide-slow]');
      function friction() {
        for (var i = 0; i < heavy.length; i++) {
          var r = heavy[i].getBoundingClientRect();
          if (r.top <= 1 && r.bottom >= window.innerHeight - 1) return parseFloat(heavy[i].getAttribute('data-glide-slow')) || 0.6;
        }
        return 1;
      }

      window.addEventListener('wheel', function (e) {
        if (e.ctrlKey) return;                 /* leave pinch-zoom alone */
        if (document.documentElement.classList.contains('is-locked')) return;
        if (ownsWheel(e.target, e.deltaY)) return;
        e.preventDefault();
        /* deltaMode 1 is lines, 2 is pages */
        var d = e.deltaY;
        if (e.deltaMode === 1) d *= 16;
        else if (e.deltaMode === 2) d *= window.innerHeight;
        nudge(d * friction());
      }, { passive: false });

      /* Anything that scrolls the page by other means (keyboard, scrollbar
         drag, find-in-page) resyncs the glide so it never snaps backwards. */
      window.addEventListener('scroll', function () {
        if (!running) { target = current = window.scrollY; }
      }, { passive: true });

      window.addEventListener('resize', function () {
        target = clamp(target, 0, scrollMax());
      }, { passive: true });

      return { to: to, busy: function () { return running; } };
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

  /* ------------------------------------------------------------- tour ---- */
  /* Sticky feature tour. The object on the right is drawn and morphed by
     points.js from the same scroll position; this only switches the copy,
     and it does so when points.js reports the next object has formed. */

  var tourTrack = $('.tour-track');

  if (tourTrack) {
    var slides = $$('.tour-slide', $('#tourSlides'));
    var countEl = $('#tourCount');
    var barEl = $('#tourBar');
    var total = slides.length;
    var span = total - 1;

    if (reduced) {
      tourTrack.classList.add('is-static');
    } else {
      var activeIdx = -1;
      var mark = function (index) {
        if (index === activeIdx) return;
        activeIdx = index;
        slides.forEach(function (s, i) { s.classList.toggle('is-active', i === index); });
        if (countEl) {
          countEl.textContent = String(index + 1).padStart(2, '0') + ' / ' +
                                String(total).padStart(2, '0');
        }
      };
      mark(0);
      /* With WebGL the copy follows the object: points.js says which shape
         is on show once it has formed. Without it, scroll position decides. */
      var byShape = false;
      var tourObj = $('.tour__obj', tourTrack);
      if (tourObj) {
        tourObj.addEventListener('points:shape', function (e) {
          byShape = true;
          mark(clamp(e.detail.index, 0, span));
        });
      }
      drivers.push(function () {
        var p = trackProgress(tourTrack);
        if (!byShape) mark(clamp(Math.round(p * span), 0, span));
        if (barEl) barEl.style.setProperty('--p', p);
      });

      /* Where step i sits on the page. */
      var stepY = function (i) {
        var travel = tourTrack.offsetHeight - window.innerHeight;
        return tourTrack.offsetTop + travel * (i / span);
      };
      var goTo = function (y) {
        if (glide) glide.to(y);
        else window.scrollTo({ top: y, behavior: 'smooth' });
      };

      /* Feature pills anywhere on the page jump straight to their step. */
      $$('[data-tour-step]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          goTo(stepY(+a.getAttribute('data-tour-step')));
        });
      });

      /* No settling: stop half way and the reader stays in the cloud
         between two features, which is part of the point. */
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

  /* ------------------------------------------------------------ bento ---- */
  /* Each card rests on its finished frame and plays once each time its tile
     is hovered, or focused from the keyboard, then holds; leaving and coming
     back plays it again. Nothing loops. A touch screen has no hover, so
     there a tile plays while it is on screen instead. Every card is fitted to
     its stage so the inset above and below it is the same on every tile. */

  var bento = $('#bento');
  var bts = $$('.bt');

  if (bento && bts.length) {
    var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var players = [];
    var STOP = {};

    /* A player's steps check its generation, so leaving the tile stops the
       loop wherever it is and the card goes straight back to its rest frame. */
    var run = function (pl) {
      var g = pl.gen;
      var alive = function () { return g === pl.gen; };
      var x = {
        wait: function (ms) {
          return new Promise(function (res, rej) { setTimeout(function () { alive() ? res() : rej(STOP); }, ms); });
        },
        type: function (el, text, speed) {
          el.textContent = '';
          el.classList.add('is-typing');
          var i = 0;
          return new Promise(function (res, rej) {
            (function step() {
              if (!alive()) { rej(STOP); return; }
              if (i >= text.length) { el.classList.remove('is-typing'); res(); return; }
              el.textContent += text.charAt(i++);
              setTimeout(step, speed + Math.random() * speed);
            })();
          });
        }
      };
      pl.play(x).catch(function (e) { if (e !== STOP) throw e; });
    };

    var setLive = function (tile, on) {
      if (tile.classList.contains('is-live') === on) return;
      tile.classList.toggle('is-live', on);
      players.forEach(function (pl) {
        if (pl.tile !== tile) return;
        pl.gen++;
        pl.rest();
        if (on && !reduced) run(pl);
      });
    };
    var player = function (el, rest, play) {
      players.push({ tile: el.closest('.bt'), gen: 0, rest: rest, play: play });
    };
    var decode = function (str) { var t = document.createElement('textarea'); t.innerHTML = str; return t.value; };

    /* The checkout: two tickets, pay, paid, and the sale lands. */
    $$('[data-bento="checkout"]', bento).forEach(function (el) {
      var qty = $('[data-qty]', el), total = $('[data-total]', el), pay = $('[data-pay]', el), toast = $('.bx-co__toast', el);
      var set = function (n) { qty.textContent = n; total.innerHTML = n === '1' ? '&pound;13.20' : '&pound;26.40'; };
      player(el, function () {
        set('2'); pay.classList.remove('is-paid', 'is-press'); toast.classList.remove('is-on');
      }, function (x) {
        var cycle = function () {
          set('1'); pay.classList.remove('is-paid', 'is-press'); toast.classList.remove('is-on');
          return x.wait(450)
            .then(function () { set('2'); return x.wait(900); })
            .then(function () { pay.classList.add('is-press'); return x.wait(180); })
            .then(function () { pay.classList.remove('is-press'); pay.classList.add('is-paid'); return x.wait(450); })
            .then(function () { toast.classList.add('is-on'); });
        };
        return cycle();
      });
    });

    /* The inbox: three new enquiries arrive, then it holds. */
    $$('[data-bento="inbox"]', bento).forEach(function (el) {
      var list = $('.bx-inbox__list', el);
      var initial = list.innerHTML;
      var POOL = [
        ['assets/brands/whatsapp.svg', 'Sam Okafor', 'Any tables left for Saturday?'],
        ['assets/brands/instagram.svg', '@wearecapacity', 'What time do doors open?'],
        ['', 'Chris Lane', 'Leaving do for 14, next Friday'],
        ['assets/brands/gmail.svg', 'Nadia Rahman', 'Hen party, can you do a package?'],
        ['assets/brands/whatsapp.svg', 'Olly Grant', 'Is Rooftop open this weekend?'],
        ['assets/brands/whatsapp.svg', 'Dan Price', 'Guestlist for 4 please']
      ];
      var n = 0;
      player(el, function () { list.innerHTML = initial; }, function (x) {
        var cycle = function (ms) {
          return x.wait(ms).then(function () {
            var d = POOL[n++ % POOL.length];
            var row = document.createElement('div');
            row.className = 'bx-msg is-new';
            row.innerHTML = (d[0] ? (d[0].indexOf('whatsapp') > -1 ? '<i class="ui-wa" aria-hidden="true"></i>' : '<img src="' + d[0] + '" alt="" />')
              : '<span class="bx-msg__ic"><svg class="ic" aria-hidden="true"><use href="#i-globe"/></svg></span>') +
              '<span><b></b><small></small></span><em>now</em>';
            $('b', row).textContent = d[1];
            $('small', row).textContent = d[2];
            list.insertBefore(row, list.firstChild);
            $$('.bx-msg', list).forEach(function (r, i) {
              if (i > 0) { var t = $('em', r); if (t.textContent === 'now') t.textContent = '1m'; r.classList.remove('is-new'); }
              if (i > 4) r.remove();
            });
            return ++k < 3 ? cycle(1100) : null;
          });
        };
        var k = 0;
        return cycle(400);
      });
    });

    /* The form: somebody signs up, the count goes up. */
    $$('[data-bento="form"]', bento).forEach(function (el) {
      var fields = $$('[data-type]', el), count = $('[data-count-up]', el), wrap = $('.bx-form__count', el);
      var btn = $('.ui-btn', el), total = 1284;
      player(el, function () {
        fields.forEach(function (f) { f.classList.remove('is-typing'); f.textContent = f.getAttribute('data-type'); });
        btn.style.transform = '';
        wrap.classList.remove('is-bump');
      }, function (x) {
        var cycle = function () {
          fields.forEach(function (f) { f.textContent = ''; });
          wrap.classList.remove('is-bump');
          return x.wait(300)
            .then(function () { return x.type(fields[0], fields[0].getAttribute('data-type'), 38); })
            .then(function () { return x.type(fields[1], fields[1].getAttribute('data-type'), 32); })
            .then(function () { return x.wait(300); })
            .then(function () { btn.style.transform = 'scale(.96)'; return x.wait(160); })
            .then(function () {
              btn.style.transform = '';
              total += 1;
              count.textContent = total.toLocaleString('en-GB');
              wrap.classList.add('is-bump');
            });
        };
        return cycle();
      });
    });

    /* Intelligence: the question is typed, the answer arrives. */
    $$('[data-bento="ask"]', bento).forEach(function (el) {
      var q = $('[data-type]', el);
      var text = decode(q.getAttribute('data-type'));
      player(el, function () {
        q.classList.remove('is-typing'); q.textContent = text; el.classList.add('is-answered');
      }, function (x) {
        var cycle = function () {
          el.classList.remove('is-answered'); q.textContent = '';
          return x.wait(300)
            .then(function () { return x.type(q, text, 34); })
            .then(function () { return x.wait(500); })
            .then(function () { el.classList.add('is-answered'); });
        };
        return cycle();
      });
    });

    if (hoverable) {
      bts.forEach(function (tile) {
        tile.addEventListener('pointerenter', function () { tile.classList.add('is-hot'); setLive(tile, true); });
        tile.addEventListener('pointerleave', function () { tile.classList.remove('is-hot'); setLive(tile, false); });
      });
    } else if ('IntersectionObserver' in window) {
      var bio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { setLive(e.target, e.isIntersecting); });
      }, { threshold: 0.4 });
      bts.forEach(function (el) { bio.observe(el); });
    }
    /* The keyboard gets the same as a hover: the linked tiles take focus. */
    bts.forEach(function (tile) {
      tile.addEventListener('focusin', function () { tile.classList.add('is-hot'); setLive(tile, true); });
      tile.addEventListener('focusout', function () { tile.classList.remove('is-hot'); setLive(tile, false); });
    });

    /* The fit. Each card's type is sized so the card fills its stage height
       exactly, held under the size where anything would overflow its width.
       A phone stage takes its card's own height, so it needs none of this. */
    var fitted = false;
    var fit = function () {
      bts.forEach(function (tile) {
        var card = $('.bt__stage > .bx', tile);
        if (!card) return;
        card.classList.remove('is-fit');
        card.style.fontSize = '';
        card.style.height = '';
      });
      if (window.innerWidth <= 680) return;
      bts.forEach(function (tile) {
        var stage = $('.bt__stage', tile), card = $('.bx', stage);
        if (!card) return;
        var cs = getComputedStyle(stage);
        var H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        var W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var lo = 8, hi = 13.5;
        for (var i = 0; i < 8; i++) {
          var f = (lo + hi) / 2;
          card.style.fontSize = f + 'px';
          if (card.offsetHeight <= H && card.offsetWidth <= W + 0.5 && card.scrollWidth <= card.clientWidth + 1) lo = f; else hi = f;
        }
        card.style.fontSize = lo.toFixed(2) + 'px';
        card.style.height = H + 'px';
        card.classList.add('is-fit');
      });
      fitted = true;
    };
    var fitSoon = function () {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();
    };
    if ('IntersectionObserver' in window) {
      var fio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { fio.disconnect(); fitSoon(); }
      }, { rootMargin: '800px 0px' });
      fio.observe(bento);
    } else { fitSoon(); }
    var fitTimer = 0, lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (!fitted || window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fit, 150);
    }, { passive: true });
  }

  /* ------------------------------------------------------------- dusk ---- */
  /* The night panel opens as it climbs: --de runs 0 to 1 from its top edge
     entering at the bottom of the screen to reaching a quarter of the way
     down, easing its inset corners out to full bleed. The kinetic band inside
     (data-dusk-edge) drifts sideways against the scroll on the same pump. */

  $$('.dusk').forEach(function (dusk) {
    var edge = $(dusk.getAttribute('data-dusk-edge') || '.kinetic', dusk);
    var rail = $('.kinetic__rail', dusk);
    var lastDe = -1;
    drivers.push(function () {
      var vh = window.innerHeight;
      var box = dusk.getBoundingClientRect();
      var de = box.top > vh ? 0 : clamp((vh - box.top) / (vh * 0.75), 0, 1);
      de = 1 - Math.pow(1 - de, 2);
      if (reduced) de = 1;
      if (Math.abs(de - lastDe) > 0.001) { dusk.style.setProperty('--de', de.toFixed(3)); lastDe = de; }
      if (edge && rail && !reduced && box.top < vh * 2 && box.bottom > -vh) {
        rail.style.setProperty('--kx', ((edge.getBoundingClientRect().top - vh / 2) * 0.45).toFixed(1) + 'px');
      }
    });
  });

  /* ------------------------------------------------------------- rotator -- */
  /* The hero's last word changes on its own. Letter by letter the word on
     show rolls up and out of the line's mask, softening as it goes, while the
     next rises in beneath it. Once in, the letters are joined back into
     plain text, so the word keeps its kerning at rest. Every word is shown
     at full size: where one needs two lines (competitive socialising, on a
     phone) it wraps, and the line keeps the height of the tallest word so
     nothing under the heading moves as they change. */

  var rot = $('.rot[data-rot]');

  if (rot && !reduced) {
    var words = rot.getAttribute('data-rot').split('|');
    var title = rot.closest('.hero__title');
    var wi = 0, heroOn = true;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { heroOn = en[0].isIntersecting; }).observe(title);
    }

    /* Letters grouped by word, so a two word phrase still breaks at its space. */
    var letters = function (el, text) {
      el.textContent = '';
      var gap = Math.min(26, 420 / text.length), n = 0;
      text.split(' ').forEach(function (part, wIdx) {
        if (wIdx) el.appendChild(document.createTextNode(' '));
        var w = document.createElement('span');
        w.className = 'rot__w';
        for (var i = 0; i < part.length; i++) {
          var ch = document.createElement('span');
          ch.className = 'rot__ch';
          ch.textContent = part.charAt(i);
          ch.style.transitionDelay = Math.round(n++ * gap) + 'ms';
          w.appendChild(ch);
        }
        n++;
        el.appendChild(w);
      });
    };

    var reserve = function () {
      rot.style.minHeight = '';
      var probe = document.createElement('span');
      probe.className = 'rot__word rot__probe';
      rot.appendChild(probe);
      var tallest = 0;
      words.forEach(function (w) { probe.textContent = w; tallest = Math.max(tallest, probe.offsetHeight); });
      probe.remove();
      rot.style.minHeight = tallest + 'px';
    };

    /* Split letters lose the font's kerning, so the word would sit a touch
       wide while it rolls and then tighten when it is joined back. Each
       letter's box is sized to its kerned advance, read off the same text
       set whole, so the split word and the joined word land on the same
       pixels. Layout widths, not screen ones, so a scaled parent is fine. */
    var kern = function (el) {
      $$('.rot__w', el).forEach(function (w) {
        var chs = $$('.rot__ch', w);
        var probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre';
        probe.textContent = chs.map(function (c) { return c.textContent; }).join('');
        w.appendChild(probe);
        var node = probe.firstChild, range = document.createRange();
        var full = probe.getBoundingClientRect().width;
        var scale = full ? probe.offsetWidth / full : 1;
        var lefts = [];
        for (var i = 0; i < chs.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          lefts.push(range.getBoundingClientRect().left);
        }
        var right = probe.getBoundingClientRect().right;
        for (var j = 0; j < chs.length; j++) {
          var adv = ((j + 1 < chs.length ? lefts[j + 1] : right) - lefts[j]) * scale;
          chs[j].style.width = adv.toFixed(3) + 'px';
        }
        probe.remove();
      });
    };

    var current = $('.rot__word', rot);

    var roll = function (text) {
      var old = current;
      var next = document.createElement('span');
      next.className = 'rot__word is-next is-below';
      letters(next, text);
      rot.appendChild(next);
      letters(old, old.textContent);
      kern(next);
      kern(old);
      void next.offsetWidth;
      old.classList.add('is-out');
      next.classList.remove('is-below');
      current = next;
      setTimeout(function () {
        old.remove();
        next.classList.remove('is-next');
        next.textContent = text;
      }, 1500);
    };

    var cycle = function () {
      setTimeout(function () {
        if (heroOn && !document.hidden) {
          wi = (wi + 1) % words.length;
          roll(words[wi]);
        }
        cycle();
      }, 3200);
    };
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(reserve, 120); }, { passive: true });
    var startRot = function () { reserve(); cycle(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(startRot); else startRot();
  }

  /* ------------------------------------------------------ hero depth ---- */
  /* The object hero's layers follow the pointer, each by its own depth. */

  var pVisual = $('.phero__visual');

  if (pVisual && !reduced && !coarse) {
    var pHero = pVisual.closest('.pagehead') || pVisual;
    pHero.addEventListener('pointermove', function (e) {
      var r = pHero.getBoundingClientRect();
      pVisual.style.setProperty('--px', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
      pVisual.style.setProperty('--py', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
    }, { passive: true });
    pHero.addEventListener('pointerleave', function () {
      pVisual.style.setProperty('--px', 0);
      pVisual.style.setProperty('--py', 0);
    });
  }

  /* ------------------------------------------------------ horizon cta ---- */
  /* The wave rises over the first half of the track; the copy lands once it
     is most of the way up, and goes again if you scroll back above that. */

  var hcta = $('.hcta');

  if (hcta) {
    if (reduced) {
      hcta.classList.add('is-static', 'is-in');
    } else {
      var hIn = false;
      drivers.push(function () {
        var r = hcta.getBoundingClientRect();
        if (r.top > window.innerHeight || r.bottom < 0) return;
        /* 0 as the section's top enters at the bottom of the screen, 1 half
           way through the held stage. */
        var vh = window.innerHeight;
        var z = clamp((vh - r.top) / (vh + (r.height - vh) * 0.5), 0, 1);
        var e = 1 - Math.pow(1 - z, 3);
        hcta.style.setProperty('--h', e.toFixed(4));
        var on = z > 0.7;
        if (on !== hIn) { hcta.classList.toggle('is-in', on); hIn = on; }
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

  /* -------------------------------------------------------- scroll hero -- */
  /* The copy steps aside as the object takes the stage, then the band turns
     to paper under the finished screen. points.js reads the same track for
     the morph and the wave. */

  $$('.shero').forEach(function (hero) {
    if (reduced) { hero.classList.add('is-static'); return; }
    drivers.push(function () {
      var p = trackProgress(hero);
      hero.style.setProperty('--p', p.toFixed(4));
      hero.style.setProperty('--m', clamp((p - 0.04) / 0.16, 0, 1).toFixed(4));
      hero.style.setProperty('--f', clamp((p - 0.8) / 0.16, 0, 1).toFixed(4));
    });
  });

  /* ------------------------------------------------------------ ticks ---- */
  /* The coded product is live: counts on it creep up while it is on screen,
     a few at a time, the way a venue's numbers do on a busy night. */

  /* Not the bento's: its cards only move while they are hovered. */
  var ticks = $$('[data-tick]').filter(function (el) { return !el.closest('.bt'); });

  if (ticks.length && !reduced) {
    var onScreen = false;
    var host = ticks[0].closest('.hero') || document.body;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; }).observe(host);
    }
    var bump = function () {
      if (onScreen && !document.hidden) {
        var el = ticks[Math.floor(Math.random() * ticks.length)];
        var step = +(el.getAttribute('data-step') || 1);
        var v = +el.getAttribute('data-tick') + Math.ceil(Math.random() * step);
        /* A figure shown twice (the door count is) carries a key, so every
           copy of it moves together. */
        var key = el.getAttribute('data-tick-key');
        var group = key ? ticks.filter(function (o) { return o.getAttribute('data-tick-key') === key; }) : [el];
        group.forEach(function (o) {
          o.setAttribute('data-tick', v);
          o.textContent = v.toLocaleString('en-GB');
        });
      }
      setTimeout(bump, 900 + Math.random() * 1800);
    };
    setTimeout(bump, 2200);
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

    var pts = $('.expand__pts');
    var paint = function (shot, pitch) {
      /* points.js draws the WebGL relief; this is only the fallback. */
      if (pts && pts.classList.contains('points-on')) return;
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

  /* -------------------------------------------------------- waitlist form -- */
  /* The root page. Posts to /api/waitlist, which files the signup in Blob;
     the key never leaves the server. */

  var wform = $('#waitlistForm');
  if (wform) {
    var wdone = $('#waitlistDone');
    var wemail = $('#email', wform);
    var wcheck = $('#marketing', wform);
    var werror = $('#waitlistError');
    var wbutton = $('button[type="submit"]', wform);
    var wlabel = wbutton ? wbutton.innerHTML : '';

    wform.addEventListener('submit', function (e) {
      e.preventDefault();
      if (werror) werror.hidden = true;

      var value = wemail.value.trim();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      wemail.closest('.field').classList.toggle('is-invalid', !ok);
      if (!ok) { wemail.focus(); return; }

      if (wbutton) { wbutton.disabled = true; wbutton.textContent = 'Joining...'; }

      fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: value,
          marketing: !!(wcheck && wcheck.checked),
          company_website: ($('#company_website', wform) || {}).value || '',
          page: location.href
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('Endpoint responded ' + res.status);
        wform.hidden = true;
        wdone.hidden = false;
        wdone.setAttribute('tabindex', '-1');
        wdone.focus();
      }).catch(function (err) {
        if (wbutton) { wbutton.disabled = false; wbutton.innerHTML = wlabel; }
        if (werror) {
          werror.textContent = 'That did not save. Please try again in a moment.';
          werror.hidden = false;
        }
        console.error('[waitlist]', err);
      });
    });

    wform.addEventListener('input', function () {
      wemail.closest('.field').classList.remove('is-invalid');
    });
  }

  /* --------------------------------------------------------- nav menu ----- */
  /* Hover already opens the dropdown in CSS. This is for touch and keyboard,
     where there is no hover to rely on. */

  var navToggles = $$('.nav__toggle');

  if (navToggles.length) {
    var closeAll = function (except) {
      navToggles.forEach(function (t) { if (t !== except) t.setAttribute('aria-expanded', 'false'); });
    };
    navToggles.forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var open = t.getAttribute('aria-expanded') === 'true';
        closeAll(t);
        t.setAttribute('aria-expanded', String(!open));
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav__group')) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });
  }

  /* --------------------------------------------------- nav over surface -- */
  /* The pill is always dark, so the logomark flips to white while a light
     section is behind it and back to brand blue over a dark one. The switch is
     driven off the nav's own midline, so it lands exactly on the boundary. */

  /* Two bands are markup-light but paint black at some point in their scroll:
     the statement once it inverts, and the expand finale once its panel fills
     the screen. Both only count as dark surfaces while that is true. */
  var darkBands = $$('.on-dark').concat($$('.statement-track'), $$('.expand-track'), $$('.dusk'));

  if (nav && darkBands.length) {
    var wasDark = null;
    var isDark = function (el) {
      if (el.classList.contains('statement-track')) {
        return el.classList.contains('is-inverted');
      }
      /* The scroll hero turns to paper at the end, and the nav follows it. */
      if (el.classList.contains('shero')) {
        return parseFloat(el.style.getPropertyValue('--f') || 0) < 0.5;
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


  /* ------------------------------------------------------ button light -- */
  /* The hover light on a button follows the pointer. */

  if (!coarse && !reduced) {
    document.addEventListener('pointermove', function (e) {
      var b = e.target && e.target.closest && e.target.closest('.btn');
      if (!b) return;
      var r = b.getBoundingClientRect();
      b.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      b.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    }, { passive: true });
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

/* =========================================================================
   Feature pages. One self-contained block per page; each returns at once
   on any page that does not carry its piece.
   ========================================================================= */

/* ---- Enquiries (feature-enquiries) ---- */
/* ============================================================================
   Enquiries feature page: the working inbox.
   New enquiries drop into the list, one opens, its reply is drafted from the
   guest's history and sent. It plays only while on screen and loops calmly;
   any click takes over (open a thread, filter a channel, press Send) and the
   loop picks up again once the reader has left it alone for a few seconds.
   Under reduced motion nothing plays, and every click still works.
   ========================================================================== */

(function () {
  'use strict';

  var app = document.getElementById('fqApp');
  if (!app) return;

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var list = $('#fqList', app);
  var thread = $('#fqThread', app);
  var prof = $('#fqProf', app);
  var tabs = $$('.fq-tab', app);

  var CH = {
    wa:  { name: 'WhatsApp',  icon: '<i class="ui-wa fq-ch" aria-hidden="true"></i>' },
    ig:  { name: 'Instagram', icon: '<img class="fq-ch" src="assets/brands/instagram.svg" alt="" />' },
    em:  { name: 'Email',     icon: '<img class="fq-ch" src="assets/brands/gmail.svg" alt="" />' },
    web: { name: 'Website',   icon: '<span class="fq-ch fq-web"><svg class="ic" aria-hidden="true"><use href="#i-globe"/></svg></span>' }
  };
  var TAG = { Regular: 'ui-pill--violet', Returning: 'ui-pill--mute', New: 'ui-pill--cyan' };

  /* The guests. Ella's second message arrives on a different channel from her
     first and lands in the same thread, which is the point of the page. */
  var threads = [
    { id: 'jess', ch: 'wa', name: 'Jess Morgan', ini: 'JM', av: 'violet', tag: 'Regular', since: 'Customer since March',
      visits: '6', spend: '&pound;388', last: '3 wks', booking: 'Booth 2 &middot; Dirty Disco &middot; 6 guests', on: ['wa', 'em'], at: '2m',
      log: [{ sep: 'Aug &middot; by email' }, { them: 'Could we get Booth 2 for Dirty Disco on the 14th? Six of us.' },
            { me: 'Booth 2 is yours on the 14th. See you then, Jess.' }, { sep: 'Today &middot; on WhatsApp' },
            { them: 'Can we get a booth for 8 on Friday?' }],
      draft: 'Hi Jess, Booth 4 is free on Friday and seats 8. Shall I hold it for you until 6pm tomorrow?' },
    { id: 'ben', ch: 'ig', name: '@benhalll6', ini: 'B', av: '', tag: 'Returning', since: 'Customer since July',
      visits: '2', spend: '&pound;46', last: '1 wk', booking: '2 &times; Tier two &middot; Saturday Residency', on: ['ig'], at: '9m',
      log: [{ sep: 'Today &middot; on Instagram' }, { them: 'Is there a guestlist for Saturday?' }],
      draft: 'Hey! Saturday is ticketed rather than guestlist. Tier two is £12 and there are 88 left. Want the link?' },
    { id: 'tom', ch: 'web', name: 'Tom Hughes', ini: 'TH', av: 'cyan', tag: 'New', since: 'First time in touch',
      visits: '0', spend: '&pound;0', last: 'Never', booking: 'None yet', on: ['web'], at: '21m',
      log: [{ sep: 'Today &middot; website form' }, { them: 'Birthday for 20 people, 17 Oct. What can you do?' }],
      draft: 'Hi Tom, happy to help. For 20 on Saturday 17 Oct we would give you two booths side by side in Barcadia. Shall I send the options?' },
    { id: 'ella', ch: 'em', name: 'Ella Park', ini: 'EP', av: '', tag: 'Returning', since: 'Customer since May',
      visits: '3', spend: '&pound;1,120', last: '5 wks', booking: 'Rooftop Sessions &middot; 12 guests', on: ['em'], at: '1h', done: true,
      preview: 'You: Rooftop is yours on the 4th',
      log: [{ sep: 'Tue &middot; by email' }, { them: 'Corporate booking for 20 on the Rooftop, Sunday 4 Oct?' },
            { me: 'Rooftop is yours on the 4th. I will send the details over today.', meta: 'Sent by email' }],
      draft: '' },
    { id: 'priya', ch: 'wa', name: 'Priya Shah', ini: 'PS', av: 'violet', tag: 'Regular', since: 'Customer since 2024',
      visits: '9', spend: '&pound;417', last: '6 days', booking: '2 &times; Tier two &middot; Saturday Residency', on: ['wa', 'em'], at: '3h', done: true,
      preview: 'You: See you Saturday, Priya',
      log: [{ sep: 'Today &middot; on WhatsApp' }, { them: 'Are we OK to bring a birthday cake on Saturday?' },
            { me: 'Of course. Leave it with the door team and we will bring it out. See you Saturday, Priya.', meta: 'Sent on WhatsApp' }],
      draft: '' }
  ];

  /* What arrives while you watch, in turn. */
  var POOL = [
    { id: 'sam', ch: 'wa', name: 'Sam Okafor', ini: 'SO', av: 'violet', tag: 'Regular', since: 'Customer since 2023',
      visits: '11', spend: '&pound;640', last: '1 wk', booking: 'Booth 1 &middot; Saturday Residency &middot; 6 guests', on: ['wa'],
      text: 'Any tables left for Saturday?',
      draft: 'Hi Sam, Booth 1 is free again on Saturday, same as last time. Want me to put it in your name?' },
    { id: 'ella', ch: 'ig', text: 'Can we add five more to the Rooftop booking?',
      draft: 'Of course, Ella. Five more takes you to 25 on the Rooftop on the 4th. Shall I update the booking?' },
    { id: 'nadia', ch: 'em', name: 'Nadia Rahman', ini: 'NR', av: 'cyan', tag: 'New', since: 'First time in touch',
      visits: '0', spend: '&pound;0', last: 'Never', booking: 'None yet', on: ['em'],
      text: 'Hen party for 12 in November. Can you do a package?',
      draft: 'Hi Nadia, we can. For 12 we would put you in a booth in Disco Disco with entry together. Which Saturday are you thinking of?' },
    { id: 'olly', ch: 'ig', name: 'Olly Grant', ini: 'OG', av: '', tag: 'Returning', since: 'Customer since June',
      visits: '4', spend: '&pound;152', last: '2 wks', booking: '2 &times; Rooftop Sessions', on: ['ig'],
      text: 'Is Rooftop open this weekend?',
      draft: 'It is, Olly. Rooftop Sessions is on Sunday from 16:00 and tickets are £10. Want the link?' },
    { id: 'chris', ch: 'web', name: 'Chris Lane', ini: 'CL', av: 'cyan', tag: 'Returning', since: 'Customer since August',
      visits: '1', spend: '&pound;24', last: '4 wks', booking: '2 &times; Dirty Disco', on: ['web'],
      text: 'Leaving do for 14, next Friday',
      draft: 'Hi Chris, next Friday is Dirty Disco. For 14 I can hold two booths side by side. Shall I send the details?' },
    { id: 'dan', ch: 'wa', name: 'Dan Price', ini: 'DP', av: 'violet', tag: 'Regular', since: 'Customer since 2024',
      visits: '7', spend: '&pound;296', last: '2 wks', booking: 'Guestlist &middot; Dirty Disco &middot; 4', on: ['wa'],
      text: 'Guestlist for 4 on Friday please',
      draft: 'You are on it, Dan. Four on Friday’s guestlist, just give your name on the door.' }
  ];

  var state = { open: 'jess', filter: 'all' };
  var nextIn = 0;
  var counts = {};

  var find = function (id) { for (var i = 0; i < threads.length; i++) if (threads[i].id === id) return threads[i]; return null; };
  var el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  /* A website form has no chat to answer in, so its reply goes by email. */
  var via = function (ch) { return ch === 'web' || ch === 'em' ? 'by email' : 'on ' + CH[ch].name; };
  var ago = function (at) { return at === 'now' ? 'just now' : at + ' ago'; };

  /* ---- drawing ---- */

  var drawList = function (fresh) {
    list.textContent = '';
    threads.forEach(function (t) {
      var row = el('button', 'fq-row' + (t.id === state.open ? ' is-open' : '') + (t.done ? '' : ' is-unread') + (t.id === fresh ? ' is-new' : ''));
      row.type = 'button';
      row.setAttribute('data-id', t.id);
      row.innerHTML = CH[t.ch].icon + '<span class="fq-row__m"><b></b><small></small></span><span class="fq-row__r"><em>' + t.at + '</em>' +
        (t.done ? '<svg class="ic" aria-hidden="true"><use href="#i-check-check"/></svg>' : '<i class="fq-dot"></i>') + '</span>';
      $('b', row).textContent = t.name;
      $('small', row).textContent = t.done ? t.preview : lastThem(t);
      row.hidden = state.filter !== 'all' && t.ch !== state.filter;
      list.appendChild(row);
    });
  };

  var lastThem = function (t) {
    for (var i = t.log.length - 1; i >= 0; i--) if (t.log[i].them) return t.log[i].them;
    return '';
  };

  var drawCounts = function () {
    var waiting = { all: 0, wa: 0, ig: 0, em: 0, web: 0 };
    threads.forEach(function (t) { if (!t.done) { waiting.all++; waiting[t.ch]++; } });
    $$('[data-n]', app).forEach(function (b) {
      var k = b.getAttribute('data-n');
      set(b, waiting[k], k);
      b.classList.toggle('is-zero', waiting[k] === 0);
    });
    set($('[data-open]', app), waiting.all, 'open');
  };
  var set = function (b, n, key) {
    if (counts[key] !== undefined && counts[key] !== n && !reduced) {
      b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump');
    }
    counts[key] = n;
    b.textContent = n;
  };

  var drawThread = function (t, typing) {
    var head = $('.fq-thread__head', thread);
    head.innerHTML = '<span class="ui-av' + (t.av ? ' ui-av--' + t.av : '') + '"></span><span class="fq-thread__who"><b></b><small></small></span>';
    $('.ui-av', head).textContent = t.ini;
    $('b', head).textContent = t.name;
    $('small', head).textContent = CH[t.ch].name + ' · ' + ago(t.at);

    var box = $('.fq-msgs__in', thread);
    box.textContent = '';
    t.log.slice(-6).forEach(function (m) { box.appendChild(bubble(m)); });

    var draft = $('.fq-draft', thread);
    var txt = $('.fq-draft__t', draft);
    var send = $('.fq-send', draft);
    var k = $('.fq-draft__k', draft);
    draft.classList.toggle('is-done', !!t.done);
    if (t.done) {
      k.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-check-check"/></svg>Answered';
      txt.textContent = 'Nothing waiting. Anything ' + first(t) + ' sends next lands in this thread.';
      send.disabled = true;
    } else {
      k.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-sparkles"/></svg>Drafted reply';
      txt.textContent = typing ? '' : t.draft;
      send.disabled = !!typing;
    }
    $('.fq-draft__via', draft).textContent = 'Replies ' + via(t.ch);
  };
  var first = function (t) { return t.name.charAt(0) === '@' ? t.name : t.name.split(' ')[0]; };

  var bubble = function (m) {
    if (m.sep) return el('span', 'fq-sep' + (m.fresh ? ' is-new' : ''), m.sep);
    if (m.them) { var p = el('p', 'ui-bubble ui-bubble--them' + (m.fresh ? ' is-new' : '')); p.textContent = m.them; return p; }
    var wrap = document.createDocumentFragment();
    var me = el('p', 'ui-bubble ui-bubble--me' + (m.fresh ? ' is-new' : ''));
    me.textContent = m.me;
    wrap.appendChild(me);
    if (m.meta) wrap.appendChild(el('span', 'fq-meta' + (m.fresh ? ' is-new' : ''), '<svg class="ic" aria-hidden="true"><use href="#i-check-check"/></svg>' + m.meta));
    return wrap;
  };

  var drawProf = function (t, animate) {
    prof.classList.remove('is-new');
    var on = t.on.map(function (c) { return CH[c].name; }).join(', ');
    prof.innerHTML =
      '<div class="fq-prof__id"><span class="ui-av' + (t.av ? ' ui-av--' + t.av : '') + '"></span><span><b></b><small></small></span><span class="ui-pill ' + TAG[t.tag] + '">' + t.tag + '</span></div>' +
      '<div class="ui-stats"><div><span class="ui-lbl">Visits</span><b>' + t.visits + '</b></div><div><span class="ui-lbl">Spend</span><b>' + t.spend + '</b></div><div><span class="ui-lbl">Last in</span><b>' + t.last + '</b></div></div>' +
      '<div class="fq-prof__rows"><div class="ui-row"><div><b>Last booking</b><small>' + t.booking + '</small></div></div>' +
      '<div class="ui-row"><div><b>Talks to you on</b><small></small></div></div></div>';
    $('.fq-prof__id .ui-av', prof).textContent = t.ini;
    $('.fq-prof__id b', prof).textContent = t.name;
    $('.fq-prof__id small', prof).textContent = t.since;
    $('.fq-prof__rows .ui-row:last-child small', prof).textContent = on;
    if (animate && !reduced) { void prof.offsetWidth; prof.classList.add('is-new'); }
  };

  /* ---- actions ---- */

  var open = function (id, typing) {
    var t = find(id);
    if (!t) return null;
    var changed = state.open !== id;
    state.open = id;
    $$('.fq-row', list).forEach(function (r) { r.classList.toggle('is-open', r.getAttribute('data-id') === id); });
    drawThread(t, typing);
    if (changed) drawProf(t, true);
    return t;
  };

  var send = function (t) {
    if (!t || t.done) return;
    t.log.forEach(function (m) { m.fresh = false; });
    t.log.push({ me: t.draft, meta: 'Sent ' + via(t.ch) + ' · just now', fresh: true });
    t.done = true;
    t.preview = 'You: ' + t.draft;
    drawList();
    drawCounts();
    if (state.open === t.id) drawThread(t);
  };

  /* A new enquiry. A guest already in the list keeps their thread: it moves to
     the top with the new message on the end, whatever channel it came in on. */
  var arrive = function () {
    var d = POOL[nextIn++ % POOL.length];
    var t = find(d.id);
    threads.forEach(function (o) { if (o.at === 'now') o.at = '1m'; o.log.forEach(function (m) { m.fresh = false; }); });
    if (t) {
      threads.splice(threads.indexOf(t), 1);
      if (t.ch !== d.ch || t.done) t.log.push({ sep: 'Today &middot; ' + (d.ch === 'web' ? 'website form' : via(d.ch)), fresh: true });
      t.ch = d.ch;
      if (t.on.indexOf(d.ch) < 0) t.on.push(d.ch);
    } else {
      t = {};
      for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) t[k] = d[k];
      t.on = d.on.slice();
      t.log = [{ sep: 'Today &middot; ' + (d.ch === 'web' ? 'website form' : via(d.ch)) }];
    }
    t.log.push({ them: d.text, fresh: true });
    t.draft = d.draft;
    t.done = false;
    t.at = 'now';
    threads.unshift(t);
    if (threads.length > 7) threads.length = 7;
    drawList(t.id);
    drawCounts();
    return t;
  };

  var setFilter = function (ch) {
    state.filter = ch;
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-ch') === ch;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.fq-row', list).forEach(function (r) {
      var t = find(r.getAttribute('data-id'));
      r.hidden = ch !== 'all' && t.ch !== ch;
    });
  };

  /* ---- the loop ---- */
  /* Each run carries a generation, as the bento players in site.js do: bumping
     it stops a run wherever it is, mid-type included. */

  var STOP = {};
  var gen = 0, onScreen = false, held = false, holdTimer = null;

  var wait = function (ms, g) {
    return new Promise(function (res, rej) { setTimeout(function () { g === gen ? res() : rej(STOP); }, ms); });
  };
  var type = function (node, text, g) {
    node.textContent = '';
    node.classList.add('is-typing');
    var i = 0;
    return new Promise(function (res, rej) {
      (function step() {
        if (g !== gen) { node.classList.remove('is-typing'); rej(STOP); return; }
        if (i >= text.length) { node.classList.remove('is-typing'); res(); return; }
        node.textContent += text.charAt(i++);
        setTimeout(step, 16 + Math.random() * 22);
      })();
    });
  };

  var cycle = function (g) {
    var t, btn = $('.fq-send', thread);
    return wait(1800, g)
      .then(function () { t = arrive(); return wait(1300, g); })
      .then(function () { open(t.id, true); return wait(500, g); })
      .then(function () { return type($('.fq-draft__t', thread), t.draft, g); })
      .then(function () { btn.disabled = false; return wait(1000, g); })
      .then(function () { btn.classList.add('is-press'); return wait(170, g); })
      .then(function () { btn.classList.remove('is-press'); send(t); return wait(2600, g); })
      .then(function () { return cycle(g); });
  };

  var play = function () {
    if (reduced || held || !onScreen) return;
    var g = ++gen;
    cycle(g).catch(function (e) { if (e !== STOP) throw e; });
  };
  var stop = function () {
    gen++;
    var txt = $('.fq-draft__t', thread);
    if (txt.classList.contains('is-typing')) { txt.classList.remove('is-typing'); open(state.open); }
  };

  /* The reader has the inbox. Hand it back after a quiet spell, on All. */
  var hold = function () {
    stop();
    held = true;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () {
      held = false;
      if (state.filter !== 'all') setFilter('all');
      play();
    }, 9000);
  };

  list.addEventListener('click', function (e) {
    var row = e.target.closest('.fq-row');
    if (!row) return;
    hold();
    open(row.getAttribute('data-id'));
  });
  $('.fq-send', thread).addEventListener('click', function () {
    hold();
    send(find(state.open));
  });
  tabs.forEach(function (b) {
    b.addEventListener('click', function () { hold(); setFilter(b.getAttribute('data-ch')); });
  });

  drawList();
  drawCounts();
  open('jess');
  drawProf(find('jess'));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        onScreen = e.isIntersecting;
        if (onScreen) play(); else stop();
      });
    }, { threshold: 0.3 }).observe(app);
  }
})();

/* ---- Customer profiles (feature-profiles) ---- */
/* ------------------------------------------------------ feature-profiles -- */
/* One guest put together from five systems. The markup is the finished
   profile; while the piece is on screen this empties it and merges the records
   one at a time, then counts her in the segment she now belongs to, and loops.
   Off screen, or with reduced motion, it sits on the finished frame. The two
   tabs are real: choosing one stops the loop and shows that view. */

(function () {
  'use strict';

  var root = document.getElementById('fpMerge');
  if (!root) return;

  var $  = function (sel, el) { return (el || root).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var srcs = $$('.fp-src');
  var marks = $$('.fp-x');
  var tabs = $$('.fp-tab');
  var views = $$('.fp-view');
  var status = $('[data-fp-status]');
  var count = $('[data-fp-count]');
  var joiner = $('[data-fp-join]');
  var LAST = srcs.length; /* one step past the sources: the lapse is noticed */
  var DONE_TEXT = status.textContent;

  /* Each value that grows as records merge keeps its steps in data-vals. */
  var vals = marks.filter(function (el) { return el.hasAttribute('data-vals'); });
  vals.forEach(function (el) {
    var t = document.createElement('textarea');
    t.innerHTML = el.getAttribute('data-vals');
    el._vals = t.value.split('|');
  });

  var gen = 0, playing = false, paused = false;
  var STOP = {};

  var wait = function (ms, g) {
    return new Promise(function (res, rej) {
      setTimeout(function () { g === gen ? res() : rej(STOP); }, ms);
    });
  };

  var show = function (name) {
    views.forEach(function (v) { v.classList.toggle('is-on', v.getAttribute('data-view') === name); });
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-view') === name;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };

  /* Everything whose source has merged by step k is set; anything that has
     only just arrived gets the landing flash. */
  var apply = function (k, flash) {
    marks.forEach(function (el) {
      var on = +el.getAttribute('data-at') <= k;
      var was = el.classList.contains('is-set');
      el.classList.toggle('is-set', on);
      var changed = on && !was;
      if (el._vals && on) {
        var v = el._vals[Math.max(0, Math.min(k, el._vals.length - 1))];
        if (el.textContent !== v) { el.textContent = v; changed = true; }
      }
      if (flash && changed) {
        el.classList.remove('is-new');
        void el.offsetWidth;
        el.classList.add('is-new');
      }
    });
  };

  /* The finished frame: all five merged, the lapse noted, Leah counted. */
  var rest = function () {
    gen++;
    playing = false;
    root.classList.remove('is-play', 'is-busy', 'is-take');
    srcs.forEach(function (s) { s.classList.remove('is-on'); s.classList.add('is-done'); });
    marks.forEach(function (el) { el.classList.remove('is-new'); });
    apply(LAST, false);
    status.textContent = DONE_TEXT;
    count.textContent = '412';
    count.classList.remove('is-bump');
    joiner.classList.add('is-in');
  };

  var play = function () {
    if (playing || reduced || paused) return;
    playing = true;
    var g = ++gen;

    var cycle = function () {
      show('profile');
      root.classList.add('is-play', 'is-busy');
      srcs.forEach(function (s) { s.classList.remove('is-on', 'is-done'); });
      apply(-1, false);
      joiner.classList.remove('is-in');
      status.textContent = 'Matching 0 of ' + srcs.length;

      var step = function (i) {
        if (i >= srcs.length) return Promise.resolve();
        var s = srcs[i];
        s.classList.add('is-on');
        return wait(750, g)
          .then(function () {
            s.classList.add('is-done');
            root.classList.add('is-take');
            apply(i, true);
            status.textContent = 'Matching ' + (i + 1) + ' of ' + srcs.length;
            return wait(1250, g);
          })
          .then(function () {
            s.classList.remove('is-on');
            root.classList.remove('is-take');
            return wait(250, g);
          })
          .then(function () { return step(i + 1); });
      };

      return wait(900, g)
        .then(function () { return step(0); })
        .then(function () {
          root.classList.remove('is-busy');
          status.textContent = DONE_TEXT;
          return wait(700, g);
        })
        .then(function () { apply(LAST, true); return wait(2400, g); })
        .then(function () {
          count.textContent = '411';
          show('segment');
          return wait(1100, g);
        })
        .then(function () { joiner.classList.add('is-in'); return wait(450, g); })
        .then(function () {
          count.textContent = '412';
          count.classList.add('is-bump');
          return wait(4200, g);
        })
        .then(function () { count.classList.remove('is-bump'); return cycle(); });
    };

    cycle().catch(function (e) { if (e !== STOP) throw e; });
  };

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      paused = true;
      rest();
      show(t.getAttribute('data-view'));
    });
  });

  rest();

  if (reduced) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { play(); return; }
        /* Leaving hands the loop back, so a return visit plays from the top. */
        paused = false;
        rest();
        show('profile');
      });
    }, { threshold: 0.35 }).observe(root);
  } else {
    play();
  }
})();

/* ---- Till and POS (feature-till) ---- */
/* ============================================================================
   Till and POS page
   A finished Saturday you can scrub through. The night plays from 21:00 to
   04:00 on its own while it is on screen, rests a moment on the close, and
   starts again. Dragging the slider or pressing pause hands it to the reader.
   With reduced motion it sits on the finished night and only the slider moves
   it. The markup already shows 04:00, so it reads the same with this blocked.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.getElementById('ftNight');
  if (!root) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (key) { return root.querySelector('[data-ft="' + key + '"]'); };

  /* The night, hour by hour from 21:00. Bars take a share of their total in
     each hour: the Rooftop is busy early and closes at 02:00, Onyx builds late. */
  var END = 420;
  var CAPACITY = 600;
  var bars = [
    { total: 5180, w: [2, 6, 14, 22, 26, 20, 10] },
    { total: 3620, w: [4, 10, 20, 24, 22, 14, 6] },
    { total: 2560, w: [12, 22, 28, 22, 12, 4, 0] },
    { total: 2060, w: [8, 16, 24, 24, 16, 8, 4] }
  ].map(function (b) {
    return b.w.map(function (w) { return b.total * w / 100; });
  });
  var door = [70, 150, 170, 120, 55, 17, 0];
  var drinks = [
    { price: 6.2, n: [6, 24, 54, 72, 66, 48, 20] },
    { price: 8.5, n: [3, 12, 27, 42, 48, 36, 16] },
    { price: 6, n: [0, 3, 12, 30, 48, 45, 18] },
    { price: 11, n: [7, 18, 30, 33, 24, 13, 3] },
    { price: 10, n: [24, 36, 30, 15, 5, 1, 0] },
    { price: 8, n: [15, 24, 18, 9, 4, 0, 0] }
  ];

  /* Running total of an hourly series at a minute of the night, spreading
     each hour evenly across its sixty minutes. */
  var upTo = function (series, m) {
    var h = m / 60, whole = Math.floor(h), sum = 0;
    for (var i = 0; i < whole && i < series.length; i++) sum += series[i];
    if (whole < series.length) sum += series[whole] * (h - whole);
    return sum;
  };
  var hourly = bars[0].map(function (_, i) {
    return bars.reduce(function (s, b) { return s + b[i]; }, 0);
  });
  var busiest = bars[0].reduce(function (s, v) { return s + v; }, 0);

  var gbp = function (v, dp) {
    return '£' + v.toLocaleString('en-GB', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  };
  var clockAt = function (m) {
    var mins = (21 * 60 + Math.round(m)) % (24 * 60);
    var hh = Math.floor(mins / 60), mm = mins % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  };

  var range = $('range'), clock = $('clock'), play = $('play');
  var elTakings = $('takings'), elVs = $('vs'), elDoor = $('door'), elDoorBar = $('doorbar'), elSph = $('sph');
  var barRows = Array.prototype.slice.call($('bars').children);
  var topRows = Array.prototype.slice.call($('top').children);
  var histBars = Array.prototype.slice.call($('hist').children);

  /* Rank order carries over between frames so a tie never flickers. */
  var order = topRows.map(function (_, i) { return i; });
  var lastRank = order.slice();

  var render = function (m) {
    var takings = 0;
    barRows.forEach(function (row, i) {
      var v = upTo(bars[i], m);
      takings += v;
      row.querySelector('i').style.setProperty('--v', (v / busiest * 100).toFixed(2) + '%');
      row.querySelector('b').textContent = gbp(Math.round(v));
    });
    var inside = Math.round(upTo(door, m));

    clock.textContent = clockAt(m);
    elTakings.textContent = gbp(Math.round(takings));
    /* Last week ran a little behind all night, more so as it got late. */
    elVs.textContent = '+' + Math.round(6 + 3 * m / END) + '%';
    elDoor.textContent = inside.toLocaleString('en-GB');
    elDoorBar.style.setProperty('--v', (inside / CAPACITY * 100).toFixed(1) + '%');
    elSph.textContent = gbp(inside ? takings / inside : 0, 2);

    var sold = drinks.map(function (d) { return Math.floor(upTo(d.n, m)); });
    order.sort(function (a, b) { return sold[b] - sold[a] || lastRank[a] - lastRank[b]; });
    order.forEach(function (d, rank) {
      var row = topRows[d];
      row.style.setProperty('--r', rank);
      row.classList.toggle('is-first', rank === 0);
      row.classList.toggle('is-out', rank > 4);
      row.querySelector('i').textContent = rank + 1;
      row.querySelector('b').textContent = sold[d];
      row.querySelector('em').textContent = gbp(Math.round(sold[d] * drinks[d].price));
      lastRank[d] = rank;
    });

    histBars.forEach(function (bar, i) {
      bar.style.setProperty('--fill', Math.max(0, Math.min(1, m / 60 - i)).toFixed(3));
    });

    var frac = m / END;
    range.value = Math.round(m);
    range.style.setProperty('--p', 'calc(var(--thumb) / 2 + ' + frac.toFixed(4) + ' * (100% - var(--thumb)))');
    range.setAttribute('aria-valuetext', clockAt(m));
  };

  /* Heights are set from the data so the histogram always matches it. */
  var peak = Math.max.apply(null, hourly);
  histBars.forEach(function (bar, i) { bar.style.setProperty('--h', (hourly[i] / peak * 100).toFixed(1) + '%'); });

  if (reduced) {
    root.classList.add('is-still');
    render(END);
    range.addEventListener('input', function () { render(+range.value); });
    return;
  }

  /* ---- playback ---- */
  var NIGHT_MS = 16000;   /* 21:00 to 04:00 */
  var HOLD_MS = 3200;     /* resting on the close before it goes round again */
  var at = 0, playing = false, onScreen = false, heldBy = null, raf = 0, last = 0, hold = 0;

  var setPlaying = function (on) {
    playing = on;
    root.classList.toggle('is-playing', on);
    play.setAttribute('aria-label', on ? 'Pause' : 'Play');
    cancelAnimationFrame(raf);
    clearTimeout(hold);
    if (on) { last = 0; raf = requestAnimationFrame(tick); }
  };

  var tick = function (now) {
    if (!playing) return;
    if (last) at = Math.min(END, at + (now - last) / NIGHT_MS * END);
    last = now;
    render(at);
    if (at >= END) {
      /* Rest on the finished night, then go round again from doors. */
      hold = setTimeout(function () {
        if (!playing) return;
        at = 0; last = 0; render(at);
        raf = requestAnimationFrame(tick);
      }, HOLD_MS);
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  /* Dragging hands the night to the reader; play hands it back. */
  range.addEventListener('input', function () {
    heldBy = 'reader';
    setPlaying(false);
    at = +range.value;
    render(at);
  });
  play.addEventListener('click', function () {
    if (playing) { heldBy = 'reader'; setPlaying(false); return; }
    heldBy = null;
    if (at >= END) at = 0;
    setPlaying(true);
  });

  render(at);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        onScreen = e.isIntersecting;
        if (onScreen && !heldBy && !document.hidden) setPlaying(true);
        else if (!onScreen && playing) setPlaying(false);
      });
    }, { threshold: 0.35 }).observe(root);
  } else {
    setPlaying(true);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && playing) setPlaying(false);
    else if (!document.hidden && onScreen && !heldBy) setPlaying(true);
  });
})();

/* ---- WhatsApp (feature-whatsapp) ---- */
/* ============================================================================
   WhatsApp feature page: the community and the guestlist, live.
   The broadcast is typed and sent, the ticks go to read, replies come in, and
   each IN becomes a name on the guestlist while the counts beside it rise. It
   plays only while on screen and loops calmly; under reduced motion the
   finished state in the markup stays as it is.
   ========================================================================== */

(function () {
  'use strict';

  var stage = document.getElementById('fwStage');
  if (!stage) return;

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  var chat = $('#fwChat', stage);
  var typeEl = $('#fwType', stage);
  var sendBtn = $('.fw-comp__send', stage);
  var list = $('#fwList', stage);
  var bar = $('#fwBar', stage);
  var stateEl = $('#fwState', stage);
  var qRow = $('.fw-q', stage);
  var qText = $('#fwQ', stage);
  var num = {};
  $$('[data-fw]', stage).forEach(function (el) { num[el.getAttribute('data-fw')] = el; });

  var MESSAGE = 'Friday guestlist is open for Dirty Disco. Reply IN and you’re on it.';
  var CAP = 250;
  /* Where the send ends up, as the hero shows it. */
  var FINAL = { read: 91, replies: 164, guests: 212, q: 9 };

  /* The replies you can see. Everyone else's arrive off screen and only move
     the counts, as they would on a list of 2,418. */
  var REPLIES = [
    { n: 'Leah', full: 'Leah Carter', ini: 'LC', av: 'violet', t: 'IN, plus two!', plus: 2, at: '18:03' },
    { n: 'Marcus', full: 'Marcus Reid', ini: 'MR', av: 'cyan', t: 'IN', at: '18:03' },
    { n: 'Aisha', full: 'Aisha Khan', ini: 'AK', av: '', t: 'IN, see you there', at: '18:04' },
    { n: 'Josh', full: 'Josh Bennett', t: 'What time do doors open?', q: true },
    { n: 'Priya', full: 'Priya Shah', ini: 'PS', av: 'violet', t: 'IN', at: '18:05' },
    { n: 'Tom', full: 'Tom Hughes', ini: 'TH', av: 'cyan', t: 'IN plus one', plus: 1, at: '18:06' }
  ];

  var el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  /* ---- numbers ---- */

  var shown = { read: 0, replies: 0, guests: 0, q: 0 };
  var paint = function (k, v) {
    shown[k] = v;
    num[k].textContent = k === 'read' ? v + '%' : v.toLocaleString('en-GB');
    if (k === 'guests') bar.style.setProperty('--v', (v / CAP * 100).toFixed(1) + '%');
  };
  /* Counts ease to their new value rather than jumping, and pulse once. */
  var tween = function (k, to, g) {
    var from = shown[k], t0 = performance.now(), dur = 700;
    if (to === from) return;
    num[k].classList.remove('is-bump'); void num[k].offsetWidth; num[k].classList.add('is-bump');
    (function frame(now) {
      if (g !== gen) return;
      var p = Math.min(1, (now - t0) / dur);
      paint(k, Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(frame);
    })(t0);
  };

  /* ---- the loop ---- */
  /* A generation per run, as the bento players in site.js do: bumping it
     stops the run wherever it is. */

  var STOP = {};
  var gen = 0;

  var wait = function (ms, g) {
    return new Promise(function (res, rej) { setTimeout(function () { g === gen ? res() : rej(STOP); }, ms); });
  };
  var type = function (node, text, g) {
    node.textContent = '';
    node.classList.add('is-text', 'is-typing');
    var i = 0;
    return new Promise(function (res, rej) {
      (function step() {
        if (g !== gen) { node.classList.remove('is-typing'); rej(STOP); return; }
        if (i >= text.length) { node.classList.remove('is-typing'); res(); return; }
        node.textContent += text.charAt(i++);
        setTimeout(step, 22 + Math.random() * 30);
      })();
    });
  };

  var reset = function () {
    chat.innerHTML = '<span class="fw-day">Today</span>';
    list.textContent = '';
    typeEl.classList.remove('is-text', 'is-typing');
    typeEl.textContent = 'Message';
    qText.textContent = 'Nothing yet';
    qRow.classList.remove('is-flash');
    stateEl.textContent = 'Ready';
    ['read', 'replies', 'guests', 'q'].forEach(function (k) { paint(k, 0); });
  };

  var sendOut = function () {
    typeEl.classList.remove('is-text');
    typeEl.textContent = 'Message';
    var p = el('p', 'fw-out is-new');
    p.innerHTML = 'Friday guestlist is open for Dirty Disco. Reply <b>IN</b> and you&rsquo;re on it.' +
      '<em class="fw-ticks">18:02 <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg></em>';
    chat.appendChild(p);
    stateEl.textContent = 'Filling';
    return p;
  };

  var reply = function (r, i, g) {
    var p = el('p', 'fw-in is-new');
    p.appendChild(el('b')).textContent = r.n;
    p.appendChild(document.createTextNode(r.t));
    chat.appendChild(p);
    /* Older bubbles scroll off the top: keep the chat to what fits. */
    var bubbles = $$('.fw-in, .fw-out', chat);
    if (bubbles.length > 7) bubbles[0].remove();

    if (r.q) {
      qText.textContent = r.full + ' · ' + r.t;
      qRow.classList.add('is-flash');
    } else {
      qRow.classList.remove('is-flash');
      var row = el('div', 'ui-row is-new');
      row.innerHTML = '<span class="ui-av' + (r.av ? ' ui-av--' + r.av : '') + '"></span><div><b></b><small></small></div>' +
        (r.plus ? '<span class="ui-pill ui-pill--violet">+' + r.plus + '</span>' : '');
      $('.ui-av', row).textContent = r.ini;
      $('b', row).textContent = r.full;
      $('small', row).textContent = 'Replied IN · ' + r.at;
      list.insertBefore(row, list.firstChild);
      $$('.ui-row', list).forEach(function (o, n) { if (n > 0) o.classList.remove('is-new'); if (n > 4) o.remove(); });
    }

    /* The whole list is replying, not just the six on screen. */
    var f = (i + 1) / REPLIES.length;
    tween('read', Math.round(FINAL.read * (0.55 + 0.45 * f)), g);
    tween('replies', Math.round(FINAL.replies * f), g);
    tween('guests', Math.round(FINAL.guests * f), g);
    tween('q', Math.max(r.q ? shown.q + 1 : shown.q, Math.round(FINAL.q * f)), g);
  };

  var cycle = function (g) {
    var out;
    reset();
    return wait(900, g)
      .then(function () { return type(typeEl, MESSAGE, g); })
      .then(function () { return wait(500, g); })
      .then(function () { sendBtn.classList.add('is-press'); return wait(160, g); })
      .then(function () { sendBtn.classList.remove('is-press'); out = sendOut(); return wait(900, g); })
      .then(function () {
        var ticks = $('.fw-ticks', out);
        ticks.innerHTML = '18:02 <svg class="ic" aria-hidden="true"><use href="#i-check-check"/></svg>';
        return wait(900, g);
      })
      .then(function () {
        $('.fw-ticks', out).classList.add('is-read');
        tween('read', Math.round(FINAL.read * 0.4), g);
        return wait(1000, g);
      })
      .then(function () {
        return REPLIES.reduce(function (p, r, i) {
          return p.then(function () { reply(r, i, g); return wait(1500, g); });
        }, Promise.resolve());
      })
      .then(function () { stateEl.textContent = 'Filling'; return wait(5200, g); })
      .then(function () { return cycle(g); });
  };

  var play = function () {
    var g = ++gen;
    cycle(g).catch(function (e) { if (e !== STOP) throw e; });
  };

  /* Off screen it stops, and it restarts from the top when it comes back, so
     the reader never arrives partway through. Until then the finished state
     from the markup stands. */
  var playing = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !playing) { playing = true; play(); }
        else if (!e.isIntersecting && playing) { playing = false; gen++; }
      });
    }, { threshold: 0.3 }).observe(stage);
  }
})();

/* ---- Social media (feature-social) ---- */
/* ------------------------------------------------------- social page --- */
/* The week that ranks itself. Posts drop into their days, go live one after
   another, and count up the tickets and profile visits each one brings in;
   the ranking beside the calendar re-sorts as the counts climb, so the post
   that sold most rises to the top. Plays only while the board is on screen,
   and rests on the finished week (which is also what the markup holds). */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var board = $('#fsBoard');
  if (!board) return;

  var posts = $$('.fs-post', board);
  var status = $('[data-fs-status]', board);
  var totalEl = $('[data-fs-total]', board);
  var visitsEl = $('[data-fs-visits]', board);
  var fmt = function (n) { return Math.round(n).toLocaleString('en-GB'); };

  /* One record per post that goes live, joined to its row in the ranking. */
  var live = posts.filter(function (p) { return p.hasAttribute('data-p'); }).map(function (p) {
    var i = p.getAttribute('data-p');
    return {
      post: p,
      row: $('.fs-row[data-p="' + i + '"]', board),
      t: +p.getAttribute('data-t'),
      v: +p.getAttribute('data-v'),
      d: +p.getAttribute('data-d'),
      /* The clip is a slow burn: it starts behind and overtakes late, which
         is the point the ranking is there to make. */
      slow: p.hasAttribute('data-slow'),
      at: -1,
      now: 0,
      vis: 0
    };
  });
  var max = live.reduce(function (m, r) { return Math.max(m, r.t); }, 1);

  var setCounts = function (r) {
    $('[data-k="t"]', r.post).textContent = fmt(r.now);
    $('[data-k="v"]', r.post).textContent = fmt(r.vis);
    $('.fs-row__v', r.row).textContent = fmt(r.now);
    r.row.style.setProperty('--v', (r.now / max * 100).toFixed(1) + '%');
  };

  /* Ranks the live posts by tickets, ties to the earlier post, and slides
     every row to its place. Posts not yet live wait, hidden, in the next free
     slot, so each one fades in where it lands. */
  var rank = function () {
    var on = live.filter(function (r) { return r.at >= 0; });
    on.sort(function (a, b) { return (b.now - a.now) || (live.indexOf(a) - live.indexOf(b)); });
    live.forEach(function (r) {
      var k = on.indexOf(r);
      r.row.style.setProperty('--r', k < 0 ? on.length : k);
      r.row.classList.toggle('is-on', k >= 0);
      $('.fs-row__n', r.row).textContent = k < 0 ? '' : k + 1;
      var top = k === 0 && r.now > 0;
      r.row.classList.toggle('is-top', top);
      r.post.classList.toggle('is-top', top);
    });
    var t = 0, v = 0;
    on.forEach(function (r) { t += r.now; v += r.vis; });
    totalEl.textContent = fmt(t);
    visitsEl.textContent = fmt(v);
  };

  var setStatus = function (nLive, nSched) {
    status.innerHTML = nLive ? nLive + ' live &middot; ' + nSched + ' scheduled' : nSched + ' scheduled';
    status.classList.toggle('ui-pill--live', nLive > 0);
    status.classList.toggle('ui-pill--mute', nLive === 0);
  };

  /* The finished week. */
  var rest = function () {
    board.classList.remove('is-clear');
    posts.forEach(function (p) { p.classList.add('is-in'); });
    live.forEach(function (r) { r.at = 0; r.now = r.t; r.vis = r.v; r.post.classList.add('is-live'); setCounts(r); });
    rank();
    setStatus(live.length, posts.length - live.length);
  };

  /* An empty week, ready to fill. */
  var clear = function () {
    posts.forEach(function (p) { p.classList.remove('is-in', 'is-live', 'is-top'); });
    live.forEach(function (r) { r.at = -1; r.now = 0; r.vis = 0; setCounts(r); });
    rank();
    setStatus(0, 0);
  };

  /* Each run carries a generation; leaving the screen bumps it, which stops
     the run wherever it is, the same way the home page's bento tiles do. */
  var gen = 0;
  var STOP = {};
  var wait = function (g, ms) {
    return new Promise(function (res, rej) {
      setTimeout(function () { g === gen ? res() : rej(STOP); }, ms);
    });
  };
  var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
  var easeSlow = function (x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };

  /* Counts every live post towards its total on one frame loop, re-ranking
     as it goes. Resolves once the last one has landed. */
  var count = function (g) {
    return new Promise(function (res, rej) {
      (function frame() {
        if (g !== gen) { rej(STOP); return; }
        var now = performance.now(), done = true;
        live.forEach(function (r) {
          if (r.at < 0) { done = false; return; }
          var x = Math.min(1, (now - r.at) / r.d);
          var e = r.slow ? easeSlow(x) : ease(x);
          r.now = Math.round(r.t * e);
          r.vis = Math.round(r.v * Math.min(1, ease(Math.min(1, (now - r.at) / (r.d * .8)))));
          if (x < 1) done = false;
          setCounts(r);
        });
        rank();
        if (done) res(); else requestAnimationFrame(frame);
      })();
    });
  };

  var play = function () {
    var g = ++gen;
    var cycle = function () {
      board.classList.add('is-clear');
      clear();
      return wait(g, 700)
        .then(function () {
          board.classList.remove('is-clear');
          /* Scheduled, one after another, in day order. */
          return posts.reduce(function (p, el, i) {
            return p.then(function () { el.classList.add('is-in'); setStatus(0, i + 1); return wait(g, 240); });
          }, Promise.resolve());
        })
        .then(function () { return wait(g, 900); })
        .then(function () {
          /* Live, one after another, while the counts run underneath. */
          var counting = count(g);
          var going = live.reduce(function (p, r, i) {
            return p.then(function () {
              r.at = performance.now();
              r.post.classList.add('is-live');
              setStatus(i + 1, posts.length - i - 1);
              return wait(g, 700);
            });
          }, Promise.resolve());
          return Promise.all([counting, going]);
        })
        .then(function () { return wait(g, 4600); })
        .then(cycle);
    };
    cycle().catch(function (e) { if (e !== STOP) throw e; });
  };
  var stop = function () { gen++; rest(); };

  rest();
  if (reduced) return;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? play() : stop(); });
    }, { threshold: 0.3 }).observe(board);
  } else {
    play();
  }
})();

/* ---- Website analytics (feature-analytics) ---- */
/* ============================================================================
   Website analytics page
   One weekend's visit-to-booking funnel. The source buttons re-flow the
   stages and the revenue; the feed beside them shows single visits moving
   through the same stages, and only plays while it is on screen. With reduced
   motion the feed holds still and the buttons still work, instantly. The
   markup already shows "All", so it reads the same with this blocked.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.getElementById('faFun');
  if (!root) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); };

  /* Fri 25 to Sun 27 Sep: visits, event page, checkout, booked, revenue.
     Email is the smallest source and the best at turning a visit into a
     booking; Direct is the reverse. */
  var DATA = {
    instagram: [1480, 960, 150, 92, 2350],
    google: [880, 450, 72, 47, 1230],
    email: [430, 330, 84, 61, 1590],
    direct: [570, 260, 38, 23, 600]
  };
  DATA.all = [0, 1, 2, 3, 4].map(function (i) {
    return DATA.instagram[i] + DATA.google[i] + DATA.email[i] + DATA.direct[i];
  });

  var n = function (v) { return v.toLocaleString('en-GB'); };
  var gbp = function (v) { return '£' + n(Math.round(v)); };
  var pct = function (a, b) { var p = a / b * 100; return (p < 10 ? p.toFixed(1).replace(/\.0$/, '') : Math.round(p)) + '%'; };

  var stages = $$('.fa-stage');
  var elRev = $('[data-fa="rev"]'), elRevK = $('[data-fa="revk"]');
  var buttons = $$('.fa-fun__src button');
  var RATE = ['Everyone who arrived', 'of visits', 'of event page views', 'of checkouts'];

  /* ---- the funnel ---- */
  var shownRev = DATA.all[4], revRaf = 0;
  var countRev = function (to) {
    cancelAnimationFrame(revRaf);
    if (reduced) { shownRev = to; elRev.textContent = gbp(to); return; }
    var from = shownRev, t0 = 0;
    (function step(now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3);
      shownRev = from + (to - from) * e;
      elRev.textContent = gbp(shownRev);
      if (k < 1) revRaf = requestAnimationFrame(step);
    })(performance.now());
  };

  var showFunnel = function (src) {
    var d = DATA[src];
    stages.forEach(function (st, i) {
      $('[data-fa="n"]', st).textContent = n(d[i]);
      $('.fa-stage__bar s', st).style.width = (i ? d[i - 1] / d[0] * 100 : 100).toFixed(1) + '%';
      $('.fa-stage__bar i', st).style.width = (d[i] / d[0] * 100).toFixed(1) + '%';
      $('[data-fa="rate"]', st).textContent = i ? pct(d[i], d[i - 1]) + ' ' + RATE[i] : RATE[0];
    });
    countRev(d[4]);
    elRevK.textContent = n(d[3]) + ' bookings · ' + pct(d[3], d[0]) + ' of visits booked';
  };

  /* ---- the feed ---- */
  var SOURCES = {
    instagram: { img: 'assets/brands/instagram.svg', via: ['story link', 'bio link', 'post link'] },
    google: { img: 'assets/brands/google.svg', via: ['search'] },
    email: { icon: 'i-mail', via: ['Friday email', 'line-up email'] },
    direct: { icon: 'i-globe', via: ['typed in'] }
  };
  var PAGES = [
    { name: 'Saturday Residency', paid: '£24.00' },
    { name: 'Dirty Disco', paid: '£16.00' },
    { name: 'Rooftop Sessions', paid: '£20.00' }
  ];
  var NAMES = ['Priya Shah', 'Jess Morgan', 'Tom Hughes', 'Ella Park', 'Sam Okafor', 'Leah Turner', 'Marcus Bell', 'Aisha Khan', 'Chloe Reid', 'Dan Walsh'];
  var STAGE = ['Visit', 'Event page', 'Checkout', 'Booked'];
  var list = $('[data-fa="feed"]');
  var current = 'all', nameAt = 0;
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  /* How far a visit gets follows that source's own step rates, nudged up so
     the feed shows the later stages often enough to read. */
  var plan = function (src) {
    var d = DATA[src], s = 0;
    if (Math.random() < d[1] / d[0]) s = 1;
    if (s === 1 && Math.random() < Math.min(.9, d[2] / d[1] * 2.4)) s = 2;
    if (s === 2 && Math.random() < d[3] / d[2]) s = 3;
    return s;
  };

  var paint = function (v) {
    var st = v.el.querySelector('.fa-v__st');
    st.className = 'fa-v__st is-' + v.at;
    st.textContent = v.at === 3 ? 'Booked ' + v.page.paid : STAGE[v.at];
    /* Everyone lands on the home page first; the event shows once they reach it. */
    v.el.querySelector('small').textContent = (v.at ? v.page.name : 'Home page') + ' \u00b7 ' + v.via;
    /* A booking puts a name to the visit. */
    if (v.at === 3) v.el.querySelector('b').textContent = v.name;
  };

  var make = function (src, at) {
    var s = src === 'all' ? pick(['instagram', 'instagram', 'google', 'email', 'direct']) : src;
    var meta = SOURCES[s];
    var v = { page: pick(PAGES), goal: plan(s), at: at || 0, name: NAMES[nameAt++ % NAMES.length] };
    if (at != null) v.goal = at;
    var li = document.createElement('li');
    li.className = 'fa-v';
    var mark;
    if (meta.img) {
      mark = document.createElement('img');
      mark.src = meta.img; mark.alt = '';
    } else {
      mark = document.createElement('span');
      mark.className = 'fa-v__ic';
      mark.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#' + meta.icon + '"/></svg>';
    }
    var txt = document.createElement('span');
    var b = document.createElement('b'); b.textContent = 'Visitor';
    var small = document.createElement('small');
    v.via = pick(meta.via);
    txt.appendChild(b); txt.appendChild(small);
    var st = document.createElement('em');
    st.className = 'fa-v__st';
    li.appendChild(mark); li.appendChild(txt); li.appendChild(st);
    v.el = li;
    paint(v);
    return v;
  };

  var visits = [];
  var seed = function (src) {
    list.innerHTML = '';
    visits = [3, 1, 2, 0, 3].map(function (at) { return make(src, at); });
    visits.forEach(function (v) { list.appendChild(v.el); });
  };

  var arrive = function () {
    var v = make(current);
    v.el.classList.add('is-new');
    list.insertBefore(v.el, list.firstChild);
    visits.unshift(v);
    /* The oldest goes once the new one has slid in. */
    while (visits.length > 6) visits.pop().el.remove();
  };

  var beat = 0, timer = null;
  var step = function () {
    beat++;
    /* Each visit on screen clicks on a stage at a time, until it stops where
       its plan says it does. */
    visits.forEach(function (v) {
      if (v.at < v.goal && Math.random() < .6) { v.at++; paint(v); }
    });
    if (beat % 2 === 0) arrive();
  };
  var start = function () { if (!timer && !reduced) timer = setInterval(step, 1100); };
  var stop = function () { clearInterval(timer); timer = null; };

  /* ---- the source buttons ---- */
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = btn.getAttribute('data-src');
      if (src === current) return;
      current = src;
      buttons.forEach(function (o) { o.setAttribute('aria-pressed', o === btn ? 'true' : 'false'); });
      showFunnel(src);
      seed(src);
    });
  });

  showFunnel('all');
  seed('all');

  if (reduced) return;
  var onScreen = !('IntersectionObserver' in window);
  if (onScreen) {
    start();
  } else {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        onScreen = e.isIntersecting;
        onScreen && !document.hidden ? start() : stop();
      });
    }, { threshold: 0.3 }).observe(root);
  }
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : onScreen && start();
  });
})();

/* ---- Signup forms (feature-forms) ---- */
/* --------------------------------------------------------- feature-forms -- */
/* One form, three places. The form is a single element: it moves into
   whichever place is showing, gets filled in and sent, and the sign-up lands
   at the top of the list beside it with the count ticking up. It plays only
   while on screen; off screen, or with reduced motion, it sits on the finished
   frame. The switch is real: choosing a place plays that one next. */

(function () {
  'use strict';

  var demo = document.getElementById('ffDemo');
  if (!demo) return;

  var $  = function (sel, el) { return (el || demo).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || demo).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var form = $('.ff-form');
  var places = $$('.ff-place');
  var sws = $$('.ff-sw');
  var boxes = $$('[data-c]', form);
  var go = $('.ff-go', form);
  var f = {
    name: $('[data-f="name"]', form),
    email: $('[data-f="email"]', form),
    mobile: $('[data-f="mobile"]', form),
    first: $('[data-f="first"]', form)
  };
  var rows = $('.ff-rows');
  var count = $('[data-ff-count]');
  var ORDER = ['web', 'bio', 'qr'];

  /* Who signs up where. The finished list already holds all three, so a run
     starts from the two older rows and the count three lower. */
  var PEOPLE = {
    web: { name: 'Maya Collins', email: 'maya@example.com', mobile: '07700 900461', c: ['email', 'sms'] },
    bio: { name: 'Callum Brooks', email: 'callum.b@example.com', mobile: '07700 900187', c: ['email', 'wa'] },
    qr:  { name: 'Aisha Khan', email: 'aisha.khan@example.com', mobile: '07700 900752', c: ['email', 'sms', 'wa'] }
  };
  var TOTAL = 46;
  var finished = {};
  ORDER.forEach(function (k) { finished[k] = $('.ff-row[data-who="' + k + '"]', rows); });
  var older = $$('.ff-row:not([data-who])', rows);

  var gen = 0, playing = false, at = 0, total = TOTAL;
  var STOP = {};

  var wait = function (ms, g) {
    return new Promise(function (res, rej) {
      setTimeout(function () { g === gen ? res() : rej(STOP); }, ms);
    });
  };
  var type = function (el, text, speed, g) {
    el.textContent = '';
    el.classList.add('is-typing');
    var i = 0;
    return new Promise(function (res, rej) {
      (function step() {
        if (g !== gen) { el.classList.remove('is-typing'); rej(STOP); return; }
        if (i >= text.length) { el.classList.remove('is-typing'); res(); return; }
        el.textContent += text.charAt(i++);
        setTimeout(step, speed + Math.random() * speed);
      })();
    });
  };

  var place = function (key) {
    places.forEach(function (p) {
      var on = p.getAttribute('data-place') === key;
      p.classList.toggle('is-on', on);
      if (on) $('.ff-slot', p).appendChild(form);
    });
    sws.forEach(function (b) {
      var on = b.getAttribute('data-place') === key;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };

  var fill = function (p) {
    f.name.textContent = p ? p.name : '';
    f.email.textContent = p ? p.email : '';
    f.mobile.textContent = p ? p.mobile : '';
    if (p) f.first.textContent = p.name.split(' ')[0];
    boxes.forEach(function (b) { b.classList.toggle('is-on', !!p && p.c.indexOf(b.getAttribute('data-c')) > -1); });
  };

  var setCount = function (n, bump) {
    total = n;
    count.textContent = n.toLocaleString('en-GB');
    count.classList.toggle('is-bump', !!bump);
  };

  /* The list as it was before tonight's three: the two older rows. */
  var resetList = function () {
    ORDER.forEach(function (k) { if (finished[k].parentNode) finished[k].remove(); });
    older.forEach(function (r) { r.classList.remove('is-new', 'is-closed'); rows.appendChild(r); });
    setCount(TOTAL - 3, false);
  };

  var land = function (key) {
    var row = finished[key];
    if (row.parentNode) row.remove();
    $$('.ff-row.is-new', rows).forEach(function (r) { r.classList.remove('is-new'); });
    row.classList.add('is-new', 'is-closed');
    rows.insertBefore(row, rows.firstChild);
    void row.offsetWidth;
    row.classList.remove('is-closed');
    setCount(total + 1, true);
  };

  /* The finished frame: the website form filled in, all three in the list. */
  var rest = function () {
    gen++;
    playing = false;
    form.classList.remove('is-sent');
    go.classList.remove('is-press');
    place('web');
    fill(PEOPLE.web);
    ORDER.slice().reverse().forEach(function (k) {
      finished[k].classList.remove('is-new', 'is-closed');
      rows.insertBefore(finished[k], rows.firstChild);
    });
    older.forEach(function (r) { rows.appendChild(r); });
    rows.classList.remove('is-fade');
    setCount(TOTAL, false);
  };

  var play = function (from, keepList) {
    if (reduced) return;
    var g = ++gen;
    playing = true;
    at = from || 0;

    var one = function () {
      var key = ORDER[at];
      var p = PEOPLE[key];
      form.classList.remove('is-sent');
      fill(null);
      place(key);
      count.classList.remove('is-bump');
      return wait(900, g)
        .then(function () { return type(f.name, p.name, 55, g); })
        .then(function () { return type(f.email, p.email, 38, g); })
        .then(function () { return type(f.mobile, p.mobile, 45, g); })
        .then(function () { return wait(250, g); })
        .then(function () {
          /* Ticks go on one at a time, the way a person does them. */
          return p.c.reduce(function (chain, c) {
            return chain.then(function () {
              $('[data-c="' + c + '"]', form).classList.add('is-on');
              return wait(320, g);
            });
          }, Promise.resolve());
        })
        .then(function () { return wait(300, g); })
        .then(function () { go.classList.add('is-press'); return wait(170, g); })
        .then(function () {
          go.classList.remove('is-press');
          form.classList.add('is-sent');
          f.first.textContent = p.name.split(' ')[0];
          return wait(500, g);
        })
        .then(function () { land(key); return wait(2600, g); })
        .then(function () {
          at++;
          if (at < ORDER.length) return one();
          /* Round again: the list quietly goes back to before. */
          rows.classList.add('is-fade');
          return wait(450, g).then(function () {
            resetList();
            rows.classList.remove('is-fade');
            at = 0;
            return one();
          });
        });
    };

    if (!keepList) resetList();
    one().catch(function (e) { if (e !== STOP) throw e; });
  };

  sws.forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-place');
      if (!playing) {
        /* Still: show that place with its sign-up filled in. */
        rest();
        place(key);
        fill(PEOPLE[key]);
        return;
      }
      /* Playing: that place plays now, and the list carries on as it is. */
      play(ORDER.indexOf(key), true);
    });
  });

  rest();

  if (reduced) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { if (!playing) play(0); return; }
        rest();
      });
    }, { threshold: 0.3 }).observe(demo);
  } else {
    play(0);
  }
})();

/* ---- Files (feature-files) ---- */
/* -------------------------------------------------------- files page --- */
/* The library at work. Four files upload at once and each flies into its
   event's folder as it finishes; the new flyer is picked and carried into a
   scheduled post and the event page, which both take it; then a view-only
   link is made for the promoter. Plays only while the library is on screen,
   and rests on the finished state, which is also what the markup holds. */

(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var lib = $('#flLib');
  if (!lib) return;

  var drop = $('.fl-drop', lib);
  var rows = $$('.fl-q', lib);
  var folder = function (id) { return $('.fl-folder[data-f="' + id + '"]', lib); };
  var counts = $$('[data-n]', lib);
  var fresh = $$('.fl-tile[data-new]', lib);
  var flyer = fresh[0];
  var post = $('.fl-post', lib);
  var page = $('.fl-page', lib);
  var share = $('.fl-share', lib);
  var view = $('[data-acc="view"]', lib);
  var up = $('[data-acc="up"]', lib);
  var btn = $('.fl-link__btn', lib);

  /* Each folder's count before this batch, plus what the batch adds. */
  var adds = {};
  rows.forEach(function (r) { var f = r.getAttribute('data-to'); adds[f] = (adds[f] || 0) + 1; });
  var setCounts = function (done) {
    counts.forEach(function (c) {
      var f = c.closest('.fl-folder').getAttribute('data-f');
      c.textContent = +c.getAttribute('data-n') + (done ? (adds[f] || 0) : 0);
    });
  };

  /* The finished state. */
  var rest = function () {
    $$('.fl-fly', lib).forEach(function (el) { el.remove(); });
    rows.forEach(function (r) { r.classList.remove('is-on', 'is-up', 'is-done'); });
    drop.classList.remove('is-busy');
    setCounts(true);
    fresh.forEach(function (t) { t.classList.add('is-in'); });
    flyer.classList.remove('is-picked');
    post.classList.add('is-set');
    page.classList.add('is-set');
    view.classList.add('is-on');
    up.classList.remove('is-on');
    btn.classList.remove('is-press');
    share.classList.add('is-made');
  };

  /* Before the batch arrives. */
  var clear = function () {
    rest();
    setCounts(false);
    fresh.forEach(function (t) { t.classList.remove('is-in'); });
    post.classList.remove('is-set');
    page.classList.remove('is-set');
    view.classList.remove('is-on');
    share.classList.remove('is-made');
  };

  /* Generations, as on the home page's bento: leaving the screen bumps it,
     and every pending step of the old run rejects instead of carrying on. */
  var gen = 0;
  var STOP = {};
  var wait = function (g, ms) {
    return new Promise(function (res, rej) {
      setTimeout(function () { g === gen ? res() : rej(STOP); }, ms);
    });
  };

  /* Carries a copy of `from` onto `to`, scaled evenly and centred on it, as
     a positioned clone inside the library. Measured at the moment it leaves,
     so it follows whatever layout the library has at that width. */
  var fly = function (g, from, to, fade) {
    var b = lib.getBoundingClientRect(), f = from.getBoundingClientRect(), t = to.getBoundingClientRect();
    var el = from.cloneNode(true);
    $$('.fl-cursor, .fl-tile__v', el).forEach(function (n) { n.remove(); });
    el.classList.add('fl-fly');
    el.style.left = (f.left - b.left) + 'px';
    el.style.top = (f.top - b.top) + 'px';
    el.style.width = f.width + 'px';
    el.style.height = f.height + 'px';
    lib.appendChild(el);
    var s = Math.min(t.width / f.width, t.height / f.height);
    var dx = t.left + t.width / 2 - f.left - f.width * s / 2;
    var dy = t.top + t.height / 2 - f.top - f.height * s / 2;
    void el.offsetWidth;
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')';
    if (fade) el.style.opacity = '0';
    return wait(g, 780).then(function () { return el; });
  };

  var hit = function (el) {
    el.classList.remove('is-hit');
    void el.offsetWidth;
    el.classList.add('is-hit');
  };

  /* One file: it appears in the drop zone, fills its bar, flies into its
     folder, and if that is the open folder, shows up in the grid. */
  var upload = function (g, row, i) {
    var to = folder(row.getAttribute('data-to'));
    var ms = +row.getAttribute('data-ms');
    return wait(g, i * 260)
      .then(function () { row.classList.add('is-on'); return wait(g, 350); })
      .then(function () { row.style.setProperty('--ms', ms + 'ms'); row.classList.add('is-up'); return wait(g, ms + 150); })
      .then(function () {
        row.classList.add('is-done');
        return fly(g, $('.fl-q__ic', row), $('.ic', to), true);
      })
      .then(function (el) {
        el.remove();
        var c = $('[data-n]', to);
        c.textContent = +c.textContent + 1;
        hit(to);
        var n = rows.filter(function (r) { return r.getAttribute('data-to') === 'res'; }).indexOf(row);
        if (n > -1 && fresh[n]) fresh[n].classList.add('is-in');
      });
  };

  /* The picked flyer lands on a slot, which takes it as the copy fades. */
  var place = function (g, host) {
    return fly(g, $('.fl-tile__art', flyer), $('.fl-slot', host), false)
      .then(function (el) {
        host.classList.add('is-set');
        el.style.transition = 'opacity .4s';
        el.style.opacity = '0';
        return wait(g, 420).then(function () { el.remove(); });
      });
  };

  var play = function () {
    var g = ++gen;
    var cycle = function () {
      clear();
      return wait(g, 800)
        .then(function () {
          drop.classList.add('is-busy');
          return Promise.all(rows.map(function (r, i) { return upload(g, r, i); }));
        })
        .then(function () { drop.classList.remove('is-busy'); return wait(g, 700); })
        .then(function () { flyer.classList.add('is-picked'); return wait(g, 900); })
        .then(function () { return place(g, post); })
        .then(function () { return wait(g, 250); })
        .then(function () { return place(g, page); })
        .then(function () { flyer.classList.remove('is-picked'); return wait(g, 900); })
        .then(function () { view.classList.add('is-on'); return wait(g, 800); })
        .then(function () { btn.classList.add('is-press'); return wait(g, 170); })
        .then(function () { btn.classList.remove('is-press'); share.classList.add('is-made'); return wait(g, 4200); })
        .then(cycle);
    };
    cycle().catch(function (e) { if (e !== STOP) throw e; });
  };
  var stop = function () { gen++; rest(); };

  rest();
  if (reduced) return;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? play() : stop(); });
    }, { threshold: 0.25 }).observe(lib);
  } else {
    play();
  }
})();

/* ---- Reports (feature-reports) ---- */
/* ============================================================================
   Feature page: Reports
   The report in the dark band writes itself: the figures count up, the chart
   draws, then the write-up arrives a word at a time with its numbers
   highlighted. The Weekly / Monthly switch rewrites it for the other period,
   and left alone it alternates between the two. It only plays while it is on
   screen; with reduced motion it shows the finished report and the switch
   swaps it in place.
   ========================================================================== */

(function () {
  'use strict';

  var doc = document.getElementById('frDoc');
  if (!doc) return;

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var lines = $('[data-f="lines"]', doc);
  var segs = $$('.fr-seg button', doc);
  var bars = $$('.fr-bar', doc);

  /* One set of figures per period. They agree with each other and with the
     rest of the site: Saturday's bar took £6,240, Thursday is up 34% on the
     month, 412 regulars have not been back since August. The month's
     write-up is read from the markup, so it lives in one place. */
  var P = {
    m: {
      title: 'September report',
      range: '1 to 30 September · Labyrinth Nightclub',
      vs: 'on August', now: 'September', was: 'August',
      k: { rev: 84240, tix: 5318, wet: 41380, 'new': 1902 },
      d: { rev: '+12%', tix: '+9%', wet: '+8%', 'new': '+14%' },
      bars: [[9.8, 7.3], [24.1, 22.6], [41.6, 37.4], [8.7, 7.9]],
      lines: $$('p', lines).map(function (p) { return p.innerHTML; })
    },
    w: {
      title: 'Week to 20 September',
      range: '14 to 20 September · Labyrinth Nightclub',
      vs: 'on the week before', now: 'This week', was: 'Week before',
      k: { rev: 19600, tix: 1241, wet: 9840, 'new': 446 },
      d: { rev: '+6%', tix: '+4%', wet: '+5%', 'new': '+11%' },
      bars: [[2.6, 2.1], [5.4, 5.6], [9.7, 9.2], [1.9, 1.6]],
      lines: [
        'Last week took <mark>&pound;19,600</mark>, <mark>6% more</mark> than the week before. Saturday did half of it, and the bar alone took <mark>&pound;6,240</mark> from 486 people through the door.',
        'Thursday is still climbing: <mark>&pound;2,600</mark>, up <mark>24%</mark> on the week before. Friday was the only night down, by <mark>&pound;200</mark>.',
        '<mark>446</mark> new guests came in, and <mark>61%</mark> of the crowd had been before.',
        '<b>What worked.</b> Dirty Disco sold out its early bird in <mark>two days</mark>, and the Friday guestlist went out to <mark>2,418</mark> Insiders on WhatsApp.',
        '<b>Next.</b> Saturday Residency has <mark>88</mark> tier two tickets left. Send your list a reminder on Thursday.'
      ]
    }
  };

  var money = { rev: true, wet: true };
  var shown = { rev: 0, tix: 0, wet: 0, 'new': 0 };
  var period = 'm';

  var fmt = function (key, v) { return (money[key] ? '£' : '') + Math.round(v).toLocaleString('en-GB'); };
  var setText = function (f, text) { $$('[data-f="' + f + '"]', doc).forEach(function (el) { el.textContent = text; }); };

  /* The labels, the switch and the deltas change at once; only the figures,
     the bars and the words take time. */
  var frame = function (p) {
    var d = P[p];
    setText('title', d.title); setText('range', d.range);
    setText('vs', d.vs); setText('now', d.now); setText('was', d.was);
    segs.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-p') === p ? 'true' : 'false'); });
    Object.keys(d.d).forEach(function (k) { $('[data-d="' + k + '"]', doc).textContent = d.d[k]; });
  };

  var chart = function (p) {
    var d = P[p];
    var max = 0;
    d.bars.forEach(function (b) { max = Math.max(max, b[0], b[1]); });
    bars.forEach(function (el, i) {
      $('.fr-bar__now', el).style.setProperty('--h', (d.bars[i][0] / max * 100).toFixed(1) + '%');
      $('.fr-bar__was', el).style.setProperty('--h', (d.bars[i][1] / max * 100).toFixed(1) + '%');
      $('em', el).textContent = '£' + d.bars[i][0].toFixed(1) + 'k';
    });
  };

  var figures = function (p) {
    Object.keys(P[p].k).forEach(function (k) {
      shown[k] = P[p].k[k];
      $('[data-k="' + k + '"]', doc).textContent = fmt(k, shown[k]);
    });
  };

  /* Every word and every figure becomes its own unit, so the write-up can
     arrive in reading order. A highlighted figure or a bold lead-in stays
     whole. */
  var wrap = function (html) {
    var p = document.createElement('p');
    p.innerHTML = html;
    Array.prototype.slice.call(p.childNodes).forEach(function (n) {
      if (n.nodeType === 1) { n.classList.add('fr-w'); return; }
      if (n.nodeType !== 3) return;
      var frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var s = document.createElement('span');
        s.className = 'fr-w';
        s.textContent = part;
        frag.appendChild(s);
      });
      p.replaceChild(frag, n);
    });
    return p;
  };

  var settle = function (p) {
    period = p;
    frame(p); chart(p); figures(p);
    doc.classList.remove('is-flat');
    lines.innerHTML = P[p].lines.map(function (h) { return '<p>' + h + '</p>'; }).join('');
  };

  /* The write-up box is held to the taller of the two, measured off screen at
     the current width, so the page never shifts while it writes. */
  var measure = function () {
    var probe = lines.cloneNode(false);
    probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;min-height:0;width:' + lines.clientWidth + 'px';
    lines.parentNode.appendChild(probe);
    var h = 0;
    ['m', 'w'].forEach(function (p) {
      probe.innerHTML = P[p].lines.map(function (x) { return '<p>' + x + '</p>'; }).join('');
      h = Math.max(h, probe.offsetHeight);
    });
    probe.remove();
    lines.style.minHeight = h + 'px';
  };
  lines.parentNode.style.position = 'relative';
  measure();
  var lastW = window.innerWidth, rt = 0;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rt);
    rt = setTimeout(measure, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---- playback ---- */
  /* Same pattern as the bento players in site.js: every step checks its
     generation, so leaving the screen or pressing the switch stops a run
     wherever it is. */
  var gen = 0, STOP = {};
  var ctl = function () {
    var g = gen;
    var alive = function () { return g === gen; };
    return {
      wait: function (ms) {
        return new Promise(function (res, rej) { setTimeout(function () { alive() ? res() : rej(STOP); }, ms); });
      },
      count: function (to, ms) {
        var from = {}; Object.keys(to).forEach(function (k) { from[k] = shown[k]; });
        return new Promise(function (res, rej) {
          var t0 = null;
          (function step(now) {
            if (!alive()) { rej(STOP); return; }
            if (t0 === null) t0 = now;
            var t = Math.min((now - t0) / ms, 1), e = 1 - Math.pow(1 - t, 3);
            Object.keys(to).forEach(function (k) {
              shown[k] = from[k] + (to[k] - from[k]) * e;
              $('[data-k="' + k + '"]', doc).textContent = fmt(k, shown[k]);
            });
            if (t < 1) requestAnimationFrame(step); else res();
          })(performance.now());
        });
      }
    };
  };

  var write = function (x, p) {
    period = p;
    frame(p);
    lines.innerHTML = '';
    var paras = P[p].lines.map(wrap);
    paras.forEach(function (el) { lines.appendChild(el); });
    var words = paras.map(function (el) { return $$('.fr-w', el); });
    /* A frame's pause so the flat bars have painted before they grow. */
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      doc.classList.remove('is-flat');
      chart(p);
    }); });
    var counting = x.count(P[p].k, 1300);
    var i = 0, j = 0;
    var next = function () {
      if (i >= words.length) return Promise.resolve();
      if (j >= words[i].length) { i++; j = 0; return x.wait(260).then(next); }
      words[i][j++].classList.add('is-on');
      return x.wait(32).then(next);
    };
    return x.wait(700).then(next).then(function () { return counting; });
  };

  var loop = function (x, first) {
    return write(x, first)
      .then(function () { return x.wait(7000); })
      .then(function () { return loop(x, period === 'm' ? 'w' : 'm'); });
  };

  var start = function (p, delay) {
    gen++;
    var x = ctl();
    x.wait(delay || 0)
      .then(function () { return loop(x, p); })
      .catch(function (e) { if (e !== STOP) throw e; });
  };
  var stop = function () { gen++; settle(period); };

  segs.forEach(function (b) {
    b.addEventListener('click', function () {
      var p = b.getAttribute('data-p');
      if (reduced || !onScreen) { gen++; settle(p); return; }
      start(p);
    });
  });

  var onScreen = false, played = false;

  if (reduced || !('IntersectionObserver' in window)) {
    settle('m');
    return;
  }

  /* Blank until the first time it is seen, so it is never caught finished
     and then wiped. */
  doc.classList.add('is-flat');
  Object.keys(shown).forEach(function (k) { $('[data-k="' + k + '"]', doc).textContent = fmt(k, 0); });
  lines.innerHTML = '';
  frame('m'); chart('m');

  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      onScreen = e.isIntersecting;
      if (onScreen) {
        /* First time in it writes the month; after that it picks up with
           the other period once the reader has had a moment on this one. */
        if (!played) { played = true; start('m', 300); }
        else {
          gen++;
          var x = ctl(), other = period === 'm' ? 'w' : 'm';
          x.wait(4000).then(function () { return loop(x, other); })
            .catch(function (err) { if (err !== STOP) throw err; });
        }
      } else if (played) {
        stop();
      }
    });
  }, { threshold: 0.3 }).observe(doc);
})();

/* ---- Intelligence (feature-intelligence) ---- */
/* ============================================================================
   Feature page: Intelligence
   A conversation with the venue. Pressing a suggested question types it into
   the ask box and sends it; a moment later the answer arrives with its
   figure, a small chart or list, the takeaway and the next step. Left alone
   it works through the three questions on its own. It only plays while it
   is on screen; with reduced motion the chips swap the answer in place.
   ========================================================================== */

(function () {
  'use strict';

  var chat = document.getElementById('fiChat');
  if (!chat) return;

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var log = $('.fi-log', chat);
  var chips = $$('.fi-chip', chat);
  var field = $('.fi-in__t', chat);
  var send = $('.fi-send', chat);
  var HINT = field.textContent;

  /* The first answer is in the markup, so the page reads without script; the
     other two wait in templates beside it. */
  var first = $('.fi-a', log);
  first.classList.remove('is-in');
  var answers = [first.outerHTML];
  ['fiA1', 'fiA2'].forEach(function (id) {
    var t = document.getElementById(id);
    answers.push(t ? t.innerHTML.trim() : '');
  });
  var questions = chips.map(function (c) { return c.textContent; });
  var at = 0;

  var bubble = function (i) {
    var p = document.createElement('p');
    p.className = 'ui-bubble ui-bubble--me fi-q';
    p.textContent = questions[i];
    return p;
  };
  var answer = function (i) {
    var d = document.createElement('div');
    d.innerHTML = answers[i];
    return d.firstElementChild;
  };
  var row = $('.fi-chips', chat);
  var pick = function (i) {
    at = i;
    chips.forEach(function (c, n) {
      c.classList.toggle('is-on', n === i);
      c.setAttribute('aria-pressed', n === i ? 'true' : 'false');
    });
    /* On a phone the chips scroll in their own row: bring the chosen one
       into it without moving the page. */
    if (row.scrollWidth > row.clientWidth) {
      var c = chips[i];
      row.scrollTo({ left: c.offsetLeft - row.offsetLeft - 16, behavior: reduced ? 'auto' : 'smooth' });
    }
  };
  var hint = function () {
    field.textContent = HINT;
    field.classList.remove('is-typed', 'is-typing');
  };

  /* Finished frame: the question and its answer, still. */
  var rest = function (i) {
    pick(i);
    hint();
    log.classList.remove('is-old');
    log.innerHTML = '';
    log.appendChild(bubble(i));
    var a = answer(i);
    a.classList.add('is-in');
    log.appendChild(a);
  };

  /* The log is held to its tallest exchange, measured off screen at the
     current width, so the chips and the ask box never move. */
  var measure = function () {
    var probe = log.cloneNode(false);
    probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;min-height:0;width:' + log.offsetWidth + 'px';
    chat.appendChild(probe);
    var h = 0;
    answers.forEach(function (_, i) {
      probe.innerHTML = '';
      probe.appendChild(bubble(i));
      var a = answer(i);
      a.classList.add('is-in');
      probe.appendChild(a);
      h = Math.max(h, probe.offsetHeight);
    });
    probe.remove();
    log.style.minHeight = h + 'px';
  };
  chat.style.position = 'relative';
  measure();
  var lastW = window.innerWidth, rt = 0;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rt);
    rt = setTimeout(measure, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---- playback ---- */
  /* The bento players' pattern from site.js: every step checks its
     generation, so a new question or leaving the screen stops a run
     wherever it is. */
  var gen = 0, STOP = {};
  var ctl = function () {
    var g = gen;
    var alive = function () { return g === gen; };
    return {
      wait: function (ms) {
        return new Promise(function (res, rej) { setTimeout(function () { alive() ? res() : rej(STOP); }, ms); });
      },
      type: function (el, text, speed) {
        el.textContent = '';
        el.classList.add('is-typing', 'is-typed');
        var i = 0;
        return new Promise(function (res, rej) {
          (function step() {
            if (!alive()) { rej(STOP); return; }
            if (i >= text.length) { el.classList.remove('is-typing'); res(); return; }
            el.textContent += text.charAt(i++);
            setTimeout(step, speed + Math.random() * speed);
          })();
        });
      }
    };
  };

  /* The last exchange stays up, dimmed, while the next question is typed,
     and clears the moment it is sent. */
  var ask = function (x, i) {
    pick(i);
    log.classList.add('is-old');
    var think = null;
    return x.wait(250)
      .then(function () { return x.type(field, questions[i], 30); })
      .then(function () { return x.wait(350); })
      .then(function () { send.classList.add('is-press'); return x.wait(160); })
      .then(function () {
        send.classList.remove('is-press');
        hint();
        log.innerHTML = '';
        log.classList.remove('is-old');
        var q = bubble(i);
        q.classList.add('is-new');
        log.appendChild(q);
        return x.wait(380);
      })
      .then(function () {
        think = document.createElement('span');
        think.className = 'fi-think';
        think.setAttribute('aria-label', 'Working it out');
        think.innerHTML = '<i></i><i></i><i></i>';
        log.appendChild(think);
        return x.wait(1100);
      })
      .then(function () {
        think.remove();
        var a = answer(i);
        log.appendChild(a);
        void a.offsetWidth;
        a.classList.add('is-in');
      });
  };

  var loop = function (x, i, dwell) {
    return ask(x, i)
      .then(function () { return x.wait(dwell || 6500); })
      .then(function () { return loop(x, (i + 1) % answers.length); });
  };

  var begin = function (i, delay, dwell) {
    gen++;
    var x = ctl();
    x.wait(delay || 0)
      .then(function () { return loop(x, i, dwell); })
      .catch(function (e) { if (e !== STOP) throw e; });
  };

  var onScreen = false, played = false;

  /* A question somebody chose gets longer on screen before the loop moves on. */
  chips.forEach(function (c, n) {
    c.addEventListener('click', function () {
      if (reduced || !onScreen) { gen++; rest(n); return; }
      played = true;
      begin(n, 0, 11000);
    });
  });

  if (reduced || !('IntersectionObserver' in window)) {
    rest(0);
    return;
  }

  /* Empty until the first time it is seen, so the first question is asked
     in front of the reader rather than found already answered. */
  pick(0);
  log.innerHTML = '';

  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      onScreen = e.isIntersecting;
      if (onScreen) {
        if (!played) { played = true; begin(0, 400); }
        else begin((at + 1) % answers.length, 3500);
      } else if (played) {
        gen++;
        rest(at);
      }
    });
  }, { threshold: 0.3 }).observe(chat);
})();

/* =========================================================================
   Audience pages. Each block returns at once on any other page.
   ========================================================================= */

/* ---- Festivals (for-festivals) ---- */
/* ---------------------------------------------------------- festivals --- */
/* for-festivals.html: replays one edition's on-sale, announcement to sold
   out, against the year before. The markup is the finished edition, so with
   script blocked or reduced motion nothing moves and nothing is missing.
   Every figure is read back out of the two paths in the page, so the chart
   and the numbers beside it cannot disagree. */
(function () {
  'use strict';

  var run = document.getElementById('xfRun');
  if (!run || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PLAY = 11000;   // announcement to sold out
  var HOLD = 4200;    // the finished edition, before it goes round again

  var cap = +run.getAttribute('data-cap');
  var days = +run.getAttribute('data-days');
  var start = new Date(run.getAttribute('data-start') + 'T12:00:00');
  var plot = run.querySelector('.xf-plot');

  /* "M0,96.00L1,91.32..." holds one point per day; y maps back to tickets. */
  function sold(path) {
    return path.getAttribute('d').slice(1).split('L').map(function (p) {
      return Math.round((96 - parseFloat(p.split(',')[1])) / 90 * cap);
    });
  }
  var now = sold(run.querySelector('.xf-plot__line'));
  var last = sold(run.querySelector('.xf-plot__last path'));
  var end = now.length - 1;

  var phases = Array.prototype.map.call(run.querySelectorAll('.xf-ph'), function (el) {
    return {
      el: el,
      pill: el.querySelector('.ui-pill'),
      from: +el.getAttribute('data-from'),
      to: +el.getAttribute('data-to'),
      ret: +el.getAttribute('data-ret'),
      date: el.getAttribute('data-date'),
      name: el.querySelector('b').textContent
    };
  });
  /* The day each release went on sale: the day the one before it sold out. */
  phases.forEach(function (p) {
    for (p.open = 0; now[p.open] < p.from; p.open++) {}
  });
  var outs = run.querySelectorAll('.xf-plot__out');
  var x = {};
  Array.prototype.forEach.call(run.querySelectorAll('[data-x]'), function (el) {
    x[el.getAttribute('data-x')] = el;
  });
  var back = run.querySelector('.xf-who__back');
  var fresh = run.querySelector('.xf-who__new');

  function fmt(v) { return v.toLocaleString('en-GB'); }
  function day(d) {
    var t = new Date(start.getTime() + d * 864e5);
    return t.getDate() + ' ' + t.toLocaleString('en-GB', { month: 'short' });
  }
  function set(el, text) { if (el.textContent !== text) el.textContent = text; }

  function render(d) {
    var s = now[d];
    var gap = s - last[d];
    set(x.sold, fmt(s));
    set(x.gap, (gap < 0 ? '−' : '+') + fmt(Math.abs(gap)));
    x.gap.classList.toggle('is-down', gap < 0);
    set(x.left, (days - d) + ' days');

    var cur = null, ret = 0;
    phases.forEach(function (p, i) {
      var inTier = Math.max(0, Math.min(s, p.to) - p.from);
      ret += inTier * p.ret;
      var out = s >= p.to, on = !out && s >= p.from;
      if (on) cur = p;
      p.el.classList.toggle('is-now', on);
      p.pill.className = 'ui-pill ' + (on ? 'ui-pill--live' : 'ui-pill--mute');
      set(p.pill, out ? 'Sold out ' + p.date : on ? 'On sale' : 'Queued');
      outs[i].classList.toggle('is-on', out);
    });
    set(x.phase, cur ? cur.name : 'Sold out');
    set(x.when, cur ? 'since ' + day(cur.open) : phases[phases.length - 1].date);

    ret = Math.round(ret);
    set(x.back, fmt(ret));
    set(x.new, fmt(s - ret));
    back.style.setProperty('--v', (ret / cap * 100) + '%');
    fresh.style.setProperty('--v', ((s - ret) / cap * 100) + '%');

    plot.style.setProperty('--p', d / days);
    plot.style.setProperty('--hx', (d / days * 100) + '%');
    plot.style.setProperty('--hy', (96 - s / cap * 90) + '%');
  }

  /* Plays only while it is on screen, and picks up where it left off. */
  var t0 = 0, held = 0, visible = false, raf = 0, started = false;

  function frame(ts) {
    if (!t0) t0 = ts - held;
    var t = ts - t0;
    if (t >= PLAY + HOLD) { t0 = ts; t = 0; }
    held = t;
    /* Eased gently at both ends, so the announcement and the sell-out each
       get a beat rather than the line setting off at full speed. */
    var k = Math.min(1, t / PLAY);
    k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    render(Math.round(k * end));
    raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver(function (en) {
    visible = en[0].isIntersecting;
    if (visible && !raf) {
      if (!started) { started = true; run.classList.add('is-live'); held = 0; }
      t0 = 0;
      raf = requestAnimationFrame(frame);
    } else if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }, { threshold: 0.35 }).observe(run);
})();

/* ---- Event promoters (for-promoters) ---- */
/* ---------------------------------------------------------- promoters --- */
/* for-promoters.html: replays a month of four nights, one after another,
   while the list underneath grows and the people who come back light up in
   the place they already hold. The markup is the finished month, so with
   script blocked or reduced motion nothing moves and nothing is missing. */
(function () {
  'use strict';

  var tour = document.getElementById('xpTour');
  if (!tour || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STEP = 2900;    // one night selling
  var GAP = 500;      // a beat between nights
  var HOLD = 4200;    // the finished month, before it goes round again

  var rate = +tour.getAttribute('data-rate');
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || tour).querySelectorAll(sel)); };
  var one = function (el, key) { return el.querySelector('[data-x="' + key + '"]'); };

  var dates = $$('.xp-date').map(function (el) {
    return {
      el: el, cap: +el.getAttribute('data-cap'), sold: +el.getAttribute('data-sold'), back: +el.getAttribute('data-back'),
      n: one(el, 'sold'), b: one(el, 'back'), pill: one(el, 'state'), bar: el.querySelector('.ui-bar i')
    };
  });
  var reps = $$('.xp-rep').map(function (el) {
    return { el: el, s: el.getAttribute('data-s').split(',').map(Number), n: one(el, 'n'), c: one(el, 'c') };
  });
  /* Each date's dots, in page order: the new faces it adds, and the earlier
     faces who came back for it. */
  var dots = $$('.xp-dots i');
  var joins = dates.map(function (d, i) { return dots.filter(function (el) { return +el.getAttribute('data-d') === i; }); });
  var backs = dates.map(function (d, i) { return dots.filter(function (el) { return el.getAttribute('data-b') === String(i); }); });
  var people = one(tour, 'people'), tickets = one(tour, 'tickets'), backTotal = one(tour, 'backs'), total = one(tour, 'total');

  function fmt(v) { return v.toLocaleString('en-GB'); }
  function money(v) { return '£' + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function set(el, text) { if (el.textContent !== text) el.textContent = text; }

  /* i is the date selling now, f how far through it is. Earlier dates are
     done, later ones have not started. */
  function render(i, f) {
    var sumPeople = 0, sumTickets = 0, sumBack = 0, owed = 0;
    dates.forEach(function (d, j) {
      var k = j < i ? 1 : j === i ? f : 0;
      var s = Math.round(d.sold * k), b = Math.round(d.back * k);
      sumTickets += s; sumBack += b; sumPeople += s - b;
      set(d.n, fmt(s));
      set(d.b, fmt(b));
      d.bar.style.setProperty('--v', (s / d.cap * 100) + '%');
      d.el.classList.toggle('is-now', j === i && f < 1);
      d.el.classList.toggle('is-next', j > i);
      var done = j < i || (j === i && f >= 1);
      d.pill.className = 'ui-pill ' + (j === i && !done ? 'ui-pill--live' : 'ui-pill--mute');
      set(d.pill, done ? (s === d.cap ? 'Sold out' : Math.round(s / d.cap * 100) + '% sold') : j === i ? 'On sale' : 'Next');

      var join = joins[j], came = backs[j];
      join.forEach(function (el, n) { el.classList.toggle('is-on', n < Math.round(join.length * k)); });
      came.forEach(function (el, n) { el.classList.toggle('is-back', n < Math.round(came.length * k)); });
    });
    reps.forEach(function (r) {
      var n = r.s.reduce(function (a, v, j) { return a + Math.round(v * (j < i ? 1 : j === i ? f : 0)); }, 0);
      owed += n * rate;
      set(r.n, fmt(n));
      set(r.c, money(n * rate));
      r.el.classList.toggle('is-now', r.s[i] > 0 && f < 1);
    });
    set(people, fmt(sumPeople));
    set(tickets, fmt(sumTickets));
    set(backTotal, fmt(sumBack));
    set(total, money(owed));
  }

  /* Plays only while it is on screen, and picks up where it left off. */
  var LOOP = dates.length * (STEP + GAP) + HOLD;
  var t0 = 0, held = 0, raf = 0, started = false;

  function frame(ts) {
    if (!t0) t0 = ts - held;
    var t = ts - t0;
    if (t >= LOOP) { t0 = ts; t = 0; }
    held = t;
    var i = Math.min(dates.length - 1, Math.floor(t / (STEP + GAP)));
    var f = Math.min(1, (t - i * (STEP + GAP)) / STEP);
    /* Sales come in quickly after the announcement and tail off towards the
       night, which is how a date actually sells. */
    render(i, 1 - Math.pow(1 - f, 2.2));
    raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver(function (en) {
    var on = en[0].isIntersecting;
    if (on && !raf) {
      if (!started) { started = true; tour.classList.add('is-live'); held = 0; }
      t0 = 0;
      raf = requestAnimationFrame(frame);
    } else if (!on && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }, { threshold: 0.3 }).observe(tour);
})();

/* ---- Bars (for-bars) ---- */
/* ------------------------------------------------------------- for bars -- */
/* A typical week at The Botanic, played out. The markup is the finished
   state, which is what reduced motion and no-JS get. Otherwise, while the
   chart is on screen, it empties and rebuilds: the nights one by one,
   Tuesday flagged, the message sent, and this Tuesday's bookings arriving.
   Off screen it stops, and starts again from empty next time it is in view. */

(function () {
  'use strict';

  var root = document.getElementById('xbWeek');
  if (!root || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var days = [].slice.call(root.querySelectorAll('.xb-day'));
  var rows = [].slice.call(root.querySelectorAll('.xb-feed__row'));
  var flagDay = root.querySelector('.xb-day.is-flag');
  var state = root.querySelector('[data-xb="state"]');
  var sent = root.querySelector('[data-xb="sent"]');
  var read = root.querySelector('[data-xb="read"]');
  var booked = root.querySelector('[data-xb="booked"]');
  var covers = root.querySelector('[data-xb="covers"]');

  var SCALE = 260;
  var timers = [];
  var running = false;

  function total(day, x) {
    return +day.getAttribute('data-b') + +day.getAttribute('data-w') + x;
  }

  /* A figure counting up to its value, the way a live screen settles. */
  function count(el, to, fmt, ms) {
    var from = parseFloat(el.textContent) || 0;
    var t0 = null;
    (function step(now) {
      if (!running) return;
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / (ms || 700), 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  var plain = function (v) { return String(v); };

  function setPill(text, cls) {
    state.textContent = text;
    state.className = 'ui-pill ' + cls;
  }

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function reset() {
    timers.forEach(clearTimeout);
    timers = [];
    root.classList.remove('is-flag', 'is-msg', 'is-feed', 'is-fade');
    root.classList.add('is-live');
    days.forEach(function (d) { d.classList.remove('is-on'); });
    rows.forEach(function (r) { r.classList.remove('is-on'); });
    flagDay.style.setProperty('--x', 0);
    days.forEach(function (d) { d.querySelector('.xb-day__n').textContent = '0'; });
    setPill('Draft', 'ui-pill--mute');
    sent.textContent = '0';
    read.textContent = '0%';
    booked.textContent = '0';
    covers.textContent = '+0 guests';
  }

  function play() {
    reset();
    var t = 500;

    /* The typical week, a night at a time. */
    days.forEach(function (d) {
      at(t, function () {
        d.classList.add('is-on');
        count(d.querySelector('.xb-day__n'), total(d, 0), plain, 800);
      });
      t += 480;
    });

    t += 900;
    at(t, function () { root.classList.add('is-flag'); });

    t += 1800;
    at(t, function () { root.classList.add('is-msg'); });

    t += 1400;
    at(t, function () { setPill('Sending', 'ui-pill--blue'); count(sent, 186, plain, 900); });

    t += 1200;
    at(t, function () {
      setPill('Sent', 'ui-pill--live');
      count(read, 88, function (v) { return v + '%'; }, 2600);
      root.classList.add('is-feed');
    });

    /* This Tuesday's bookings, one after another, each one adding to the
       night that was empty. */
    var x = 0, n = 0;
    t += 900;
    rows.forEach(function (r) {
      at(t, function () {
        x += +r.getAttribute('data-g');
        n += +(r.getAttribute('data-n') || 1);
        r.classList.add('is-on');
        flagDay.style.setProperty('--x', (x / SCALE * 100).toFixed(1));
        count(flagDay.querySelector('.xb-day__n'), total(flagDay, x), plain, 600);
        count(booked, n, plain, 400);
        covers.textContent = '+' + x + ' guests';
      });
      t += 950;
    });

    /* Hold the finished week, fade, and go again. */
    t += 5200;
    at(t, function () { root.classList.add('is-fade'); });
    at(t + 700, play);
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  new IntersectionObserver(function (entries) {
    var on = entries[0].isIntersecting;
    if (on && !running) { running = true; play(); }
    else if (!on && running) { running = false; stop(); }
  }, { threshold: 0.25 }).observe(root);

})();

/* ---- Competitive socialising (for-competitive-socialising) ---- */
/* ------------------------------------------ for competitive socialising -- */
/* One Saturday at Labyrinth Social, played out. The markup is the finished
   Saturday, which is what reduced motion and no-JS get. Otherwise, while the
   board is on screen, it runs in two acts: the bookings land in the order
   they were made, then the board turns to Wednesday and the quiet afternoon
   fills from the offer to the weekend-only bookers. Off screen it stops, and
   starts again from the top next time it is in view. */

(function () {
  'use strict';

  var root = document.getElementById('xcBoard');
  if (!root || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function $$(sel) { return [].slice.call(root.querySelectorAll(sel)); }
  function one(key) { return root.querySelector('[data-xc="' + key + '"]'); }
  /* Blocks carry the order they were booked in, so the board fills the way a
     real day does rather than left to right. */
  function byOrder(a, b) { return a.getAttribute('data-o') - b.getAttribute('data-o'); }

  var sat = $$('.xc-bk[data-day="sat"]').sort(byOrder);
  var fresh = $$('.xc-bk--new').sort(byOrder);
  var wedBase = $$('.xc-bk[data-day="wed"]:not(.xc-bk--new)');
  var tabSat = one('tab-sat'), tabWed = one('tab-wed');
  var countPill = one('count'), state = one('state');
  var sent = one('sent'), read = one('read'), booked = one('booked');
  var sumDay = one('sumday'), sumState = one('sumstate');
  var sumBk = one('bk'), sumGs = one('gs'), sumFree = one('free');

  var TOTAL = 70;
  var WED_BASE = cells(wedBase);
  var timers = [];
  var running = false;

  /* How many hour slots a set of blocks covers, read from its grid span. */
  function cells(list) {
    return list.reduce(function (n, el) {
      var m = /span (\d+)\s*$/.exec(el.getAttribute('style'));
      return n + (m ? +m[1] : 1);
    }, 0);
  }
  function span(el) { return cells([el]); }
  /* Party size, from the number printed on the block. */
  function size(el) { return parseInt(el.textContent, 10) || 0; }
  function guestsIn(list) { return list.reduce(function (n, el) { return n + size(el); }, 0); }

  function count(el, to, fmt, ms) {
    var from = parseFloat(el.textContent) || 0;
    var t0 = null;
    (function step(now) {
      if (!running) return;
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / (ms || 700), 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  var plain = function (v) { return String(v); };
  var pct = function (v) { return v + '%'; };

  function pill(el, text, cls) { el.textContent = text; el.className = 'ui-pill ' + cls; }
  function booking(n) {
    countPill.textContent = n + ' of ' + TOTAL + ' booked';
    sumFree.textContent = String(TOTAL - n);
  }
  function totals(b, g) { sumBk.textContent = String(b); sumGs.textContent = String(g); }
  function day(wed) {
    root.classList.toggle('is-wed', wed);
    tabSat.classList.toggle('is-on', !wed);
    tabWed.classList.toggle('is-on', wed);
  }
  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function stop() { timers.forEach(clearTimeout); timers = []; }

  function reset() {
    stop();
    root.classList.remove('is-offer', 'is-fade');
    root.classList.add('is-live');
    day(false);
    sat.concat(fresh).forEach(function (b) { b.classList.remove('is-on'); });
    booking(0);
    totals(0, 0);
    sumDay.textContent = 'Saturday';
    pill(sumState, 'Filling', 'ui-pill--blue');
    pill(state, 'Draft', 'ui-pill--mute');
    sent.textContent = '0';
    read.textContent = '0%';
    booked.textContent = '0';
  }

  function play() {
    reset();
    var t = 400, n = 0, nb = 0, ng = 0;

    /* Act one: Saturday books up. */
    sat.forEach(function (b) {
      at(t, function () {
        b.classList.add('is-on');
        n += span(b); nb += 1; ng += size(b);
        booking(n); totals(nb, ng);
      });
      t += 110;
    });
    at(t + 200, function () { pill(sumState, 'Busy', 'ui-pill--live'); });

    /* Act two: Wednesday, quiet, with the afternoon offered to the bookers
       who only ever come at the weekend. */
    t += 2600;
    var wb = wedBase.length, wg = guestsIn(wedBase);
    at(t, function () {
      day(true); booking(WED_BASE); totals(wb, wg);
      sumDay.textContent = 'Wednesday';
      pill(sumState, 'Quiet', 'ui-pill--amber');
    });
    t += 1300;
    at(t, function () { root.classList.add('is-offer'); });
    t += 1100;
    at(t, function () { pill(state, 'Sending', 'ui-pill--blue'); count(sent, 214, plain, 900); });
    t += 1200;
    at(t, function () { pill(state, 'Sent', 'ui-pill--live'); count(read, 81, pct, 2400); });
    t += 900;
    var w = WED_BASE, k = 0;
    fresh.forEach(function (b) {
      at(t, function () {
        b.classList.add('is-on');
        w += span(b); k += 1; wb += 1; wg += size(b);
        booking(w); totals(wb, wg);
        count(booked, k, plain, 300);
      });
      t += 650;
    });
    at(t, function () { pill(sumState, '+' + fresh.length + ' from the offer', 'ui-pill--live'); });

    /* Hold on the filled Wednesday, then back to Saturday and round again. */
    t += 4800;
    at(t, function () { root.classList.add('is-fade'); });
    at(t + 700, play);
  }

  new IntersectionObserver(function (entries) {
    var on = entries[0].isIntersecting;
    if (on && !running) { running = true; play(); }
    else if (!on && running) { running = false; stop(); }
  }, { threshold: 0.25 }).observe(root);
})();

