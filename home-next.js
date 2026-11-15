(function () {
  'use strict';
  var root = document.documentElement, KEY = 'capacity-theme';

  var cta = document.querySelector('.band.cta-photo');
  if (cta) {
    var prev = cta.previousElementSibling;
    while (prev && !prev.classList.contains('band')) prev = prev.previousElementSibling;
    if (prev && prev.classList.contains('on-light')) { cta.classList.remove('on-dark'); cta.classList.add('on-light'); }
  }
  var flips = Array.prototype.slice.call(document.querySelectorAll('header.on-dark, section.on-dark, article.on-dark, div.band.on-dark')).filter(function (el) { return !el.closest('footer'); });

  var btns = Array.prototype.slice.call(document.querySelectorAll('#themeBtn, [data-theme-btn]'));
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function device() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
  function apply(t) {
    root.setAttribute('data-nx-theme', t);
    flips.forEach(function (el) { el.classList.toggle('on-dark', t === 'dark'); el.classList.toggle('on-light', t === 'light'); });
    btns.forEach(function (btn) {
      btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      var l = btn.querySelector('.nx-theme__l');
      if (l) l.textContent = t === 'light' ? 'Dark mode' : 'Light mode';
    });
  }
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = root.getAttribute('data-nx-theme') === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(KEY, t); } catch (e) {}
      apply(t);
    });
  });
  apply(saved() || device());
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (!saved()) apply(device()); });

  var dn = document.querySelector('.dn'), dnp = document.querySelector('.dn__panels');
  if (dn && dnp) {
    var ts = Array.prototype.slice.call(dn.querySelectorAll('.dn__t')), closeT = 0;
    var panelOf = function (t) { return document.getElementById(t.getAttribute('aria-controls')); };
    var place = function (t, p) {

      var wrap = dnp.parentNode.getBoundingClientRect(), b = t.getBoundingClientRect();
      p.style.left = Math.max(0, b.left - wrap.left - 8) + 'px';
    };
    var shut = function (except) {
      ts.forEach(function (t) {
        if (t === except) return;
        t.setAttribute('aria-expanded', 'false');
        panelOf(t).classList.remove('is-open');
      });
    };
    var open = function (t) {
      clearTimeout(closeT);
      var p = panelOf(t);
      shut(t);
      place(t, p);
      t.setAttribute('aria-expanded', 'true');
      p.classList.add('is-open');
    };
    var later = function () { clearTimeout(closeT); closeT = setTimeout(function () { shut(); }, 160); };
    ts.forEach(function (t) {
      t.addEventListener('click', function () { if (t.getAttribute('aria-expanded') === 'true') shut(); else open(t); });
      t.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') open(t); });
      t.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') later(); });
    });
    Array.prototype.forEach.call(dnp.children, function (p) {
      p.addEventListener('pointerenter', function () { clearTimeout(closeT); });
      p.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') later(); });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.dn__t, .dn__panels')) shut(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
    dnp.addEventListener('click', function (e) { if (e.target.closest('a')) shut(); });
    dnp.addEventListener('focusout', function (e) { if (!dnp.contains(e.relatedTarget) && !dn.contains(e.relatedTarget)) shut(); });
    window.addEventListener('resize', function () { shut(); });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.mp__col .mp__k'), function (k) {
    k.addEventListener('click', function () {
      var col = k.parentNode, open = !col.classList.contains('is-open');
      Array.prototype.forEach.call(document.querySelectorAll('.mp__col'), function (c) { c.classList.remove('is-open'); });
      col.classList.toggle('is-open', open);
    });
  });

  var hw = document.querySelector('.nx-hw');
  if (hw) {
    var list = hw.querySelector('.nx-hw__list'), stage = hw.querySelector('.nx-hw__stage');
    var items = Array.prototype.slice.call(list.children), panels = Array.prototype.slice.call(stage.children), tick = 0;
    var narrow = function () { return window.innerWidth <= 1000; };
    var place = function () {
      var n = narrow();
      panels.forEach(function (p, i) { var want = n ? items[i] : stage; if (want && p.parentNode !== want) want.appendChild(p); });
    };
    var pick = function () {
      tick = 0;
      if (narrow()) return;
      var mid = window.innerHeight * 0.4, cur = 0;
      items.forEach(function (li, i) { if (li.getBoundingClientRect().top < mid) cur = i; });
      items.forEach(function (li, i) { li.classList.toggle('is-on', i === cur); });
      panels.forEach(function (p, i) { p.classList.toggle('is-on', i === cur); });
    };
    list.classList.add('is-live');
    place(); pick();
    window.addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(pick); }, { passive: true });
    window.addEventListener('resize', function () { place(); pick(); });
  }

  var cyc = document.querySelector('.nx-cycle');
  if (cyc && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var words = (cyc.getAttribute('data-words') || '').split('|').filter(Boolean), at = 0;
    var cur = cyc.querySelector('.nx-cycle__w');
    var probe = document.createElement('span'); probe.className = 'nx-cycle__w'; probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0';
    cyc.appendChild(probe);
    var fit = function (w) {
      probe.textContent = w; cyc.style.fontSize = ''; cyc.classList.remove('is-wrap');
      var pw = probe.getBoundingClientRect().width, avail = cyc.parentNode.getBoundingClientRect().width;
      if (pw > avail) {
        var k = avail / pw;
        if (k >= 0.72) { cyc.style.fontSize = (k * 100).toFixed(1) + '%'; pw = avail; }
        else { cyc.classList.add('is-wrap'); pw = avail; }
      }
      cyc.style.width = pw + 'px';
    };
    fit(cur.textContent);
    window.addEventListener('resize', function () { fit(cur.textContent); });
    setInterval(function () {
      at = (at + 1) % words.length;
      var next = document.createElement('span'); next.className = 'nx-cycle__w is-in'; next.textContent = words[at];
      cur.classList.add('is-out');
      var old = cur; cur = next;
      cyc.insertBefore(next, probe);
      fit(words[at]);
      setTimeout(function () { old.remove(); next.classList.remove('is-in'); }, 600);
    }, 2600);
  }

  var lib = document.querySelector('[data-lib]');
  if (lib) {
    var pills = Array.prototype.slice.call(document.querySelectorAll('[data-lib-filter]'));
    var tiles = Array.prototype.slice.call(lib.children);
    pills.forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-lib-filter');
        pills.forEach(function (o) { var on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', String(on)); });
        tiles.forEach(function (t) { t.classList.toggle('is-dim', k !== 'all' && t.getAttribute('data-cat') !== k); });
      });
    });
  }

  var ilib = document.querySelector('[data-ilib]');
  if (ilib) {
    var icards = Array.prototype.slice.call(ilib.children);
    var ipills = Array.prototype.slice.call(document.querySelectorAll('[data-ilib-f]'));
    var iq = document.querySelector('[data-ilib-q]'), inone = document.querySelector('.nx-ilib__none'), ikind = 'all';
    var inarrow = function () {
      var s = iq ? iq.value.trim().toLowerCase() : '', shown = 0;
      icards.forEach(function (c) {
        var on = (ikind === 'all' || c.getAttribute('data-cat') === ikind) && (!s || c.getAttribute('data-q').indexOf(s) > -1);
        c.hidden = !on;
        if (on) shown++;
      });
      if (inone) inone.hidden = shown > 0;
    };
    ipills.forEach(function (b) {
      b.addEventListener('click', function () {
        ikind = b.getAttribute('data-ilib-f');
        ipills.forEach(function (o) { var on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', String(on)); });
        inarrow();
      });
    });
    if (iq) iq.addEventListener('input', inarrow);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.nx-dots'), function (dots) {
    var rail = dots.previousElementSibling;
    if (!rail) return;
    var marks = Array.prototype.slice.call(dots.children), cards = Array.prototype.slice.call(rail.children), t = 0;
    var mark = function () {
      t = 0;
      var x = rail.getBoundingClientRect().left, best = 0, d = 1e9;
      cards.forEach(function (c, i) { var dd = Math.abs(c.getBoundingClientRect().left - x - 20); if (dd < d) { d = dd; best = i; } });
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4) best = cards.length - 1;
      marks.forEach(function (m, i) { m.classList.toggle('is-on', i === best); });
    };
    rail.addEventListener('scroll', function () { if (!t) t = requestAnimationFrame(mark); }, { passive: true });
  });
})();
