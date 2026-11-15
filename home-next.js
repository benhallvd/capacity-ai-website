/* The shared behaviour for the new look: the light and dark switch in the
   menu, the phone menu's sections, and How we work's lit step. */
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'capacity-theme';
  /* the close takes the scheme of the section before it */
  var cta = document.querySelector('.band.cta-photo');
  if (cta) {
    var prev = cta.previousElementSibling;
    while (prev && !prev.classList.contains('band')) prev = prev.previousElementSibling;
    if (prev && prev.classList.contains('on-light')) { cta.classList.remove('on-dark'); cta.classList.add('on-light'); }
  }
  var flips = Array.prototype.slice.call(document.querySelectorAll('header.on-dark, section.on-dark, article.on-dark, div.band.on-dark')).filter(function (el) { return !el.closest('footer'); });
  var btn = document.getElementById('themeBtn');
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function device() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
  function apply(t) {
    root.setAttribute('data-nx-theme', t);
    flips.forEach(function (el) { el.classList.toggle('on-dark', t === 'dark'); el.classList.toggle('on-light', t === 'light'); });
    if (btn) {
      btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      var l = btn.querySelector('.nx-theme__l');
      if (l) l.textContent = t === 'light' ? 'Dark mode' : 'Light mode';
    }
  }
  if (btn) btn.addEventListener('click', function () {
    var t = root.getAttribute('data-nx-theme') === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t);
  });
  apply(saved() || device());
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (!saved()) apply(device()); });

  /* phone menu: a heading opens its list */
  Array.prototype.forEach.call(document.querySelectorAll('.mp__col .mp__k'), function (k) {
    k.addEventListener('click', function () {
      var col = k.parentNode, open = !col.classList.contains('is-open');
      Array.prototype.forEach.call(document.querySelectorAll('.mp__col'), function (c) { c.classList.remove('is-open'); });
      col.classList.toggle('is-open', open);
    });
  });

  /* how we work: the step nearest the middle of the screen is lit, and the
     card beside the heading changes with it; on narrow screens each card
     sits inside its own step instead */
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
  /* the line: one word turns over, the slot easing to the next word's width */
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
  /* the integrations library: a pill dims every tile outside its group */
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
  /* the integrations page: a type to show and a search, both narrowing the cards */
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
  /* dots under a swiping row: the card nearest the start is lit */
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
