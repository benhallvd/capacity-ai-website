/* ============================================================================
   Capacity landing — interactions & animations (vanilla)
   ============================================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Icons ----------------------------------------------------------- */
  function icons() { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); }
  icons();

  /* ---- Nav scroll state + mobile menu ---------------------------------- */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = document.getElementById('burger');
  if (burger) burger.addEventListener('click', function () { nav.classList.toggle('menu-open'); });
  var navLinks = document.getElementById('navLinks');
  if (navLinks) navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') nav.classList.remove('menu-open');
  });

  /* ---- Reveal on scroll ------------------------------------------------ */
  var revealEls = [].slice.call(document.querySelectorAll('.reveal:not(.in)'));
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { ro.observe(el); });
  }

  /* ---- Count-up -------------------------------------------------------- */
  function fmt(n, dec) {
    if (dec) return n.toFixed(dec);
    return Math.round(n).toLocaleString('en-GB');
  }
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var pre = el.getAttribute('data-prefix') || '';
    var suf = el.getAttribute('data-suffix') || '';
    if (reduce) { el.textContent = pre + fmt(target, dec) + suf; return; }
    var dur = 1500, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + fmt(target * eased, dec) + suf;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = pre + fmt(target, dec) + suf;
    }
    requestAnimationFrame(step);
  }
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  if (!('IntersectionObserver' in window)) {
    counters.forEach(countUp);
  } else {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { countUp(en.target); co.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---- Spark line draw-in (hero) --------------------------------------- */
  var line = document.querySelector('.spark path.line');
  if (line && !reduce) {
    var len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.16,1,.3,1)';
    var area = document.querySelector('.spark path.area');
    if (area) { area.style.opacity = 0; area.style.transition = 'opacity 1.2s ease .6s'; }
    setTimeout(function () { line.style.strokeDashoffset = 0; if (area) area.style.opacity = 0.9; }, 350);
  }

  /* ---- Feature showcase: tabs (auto-rotate + click) -------------------- */
  var showcase = document.getElementById('showcase');
  if (showcase) {
    var tabs = [].slice.call(showcase.querySelectorAll('.showcase__tabs button'));
    var panes = [].slice.call(showcase.querySelectorAll('.showcase__pane'));
    var cur = 0, autoTimer = null;
    function setTab(i) {
      cur = i;
      tabs.forEach(function (t, k) { t.classList.toggle('on', k === i); });
      panes.forEach(function (p, k) { p.classList.toggle('on', k === i); });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { setTab(i); restart(); });
    });
    function rotate() { setTab((cur + 1) % tabs.length); }
    function restart() { if (autoTimer) clearInterval(autoTimer); if (!reduce) autoTimer = setInterval(rotate, 3200); }
    // Animate bars when first seen
    var barsAnimated = false;
    function animateBars() {
      if (barsAnimated) return; barsAnimated = true;
      var bars = [].slice.call(document.querySelectorAll('#featBars .bar'));
      var heights = ['28%','52%','40%','74%','58%','92%','78%'];
      bars.forEach(function (b, i) {
        var h = b.style.height; b.style.height = '0%';
        setTimeout(function () { b.style.height = heights[i] || h; }, 120 + i * 90);
      });
    }
    if ('IntersectionObserver' in window) {
      var so = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { animateBars(); restart(); so.unobserve(en.target); }
        });
      }, { threshold: 0.3 });
      so.observe(showcase);
    } else { animateBars(); restart(); }
  }

  /* ---- Donut draw (audience pane) -------------------------------------- */
  var donut = document.querySelector('.donut .seg1');
  if (donut && !reduce) {
    donut.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)';
    var full = 301.6;
    donut.setAttribute('stroke-dashoffset', full);
    if ('IntersectionObserver' in window) {
      var dobs = new IntersectionObserver(function (e) {
        e.forEach(function (en) { if (en.isIntersecting) { setTimeout(function(){ donut.setAttribute('stroke-dashoffset', 90); }, 250); dobs.unobserve(en.target); } });
      }, { threshold: 0.4 });
      dobs.observe(donut);
    }
  }

  /* ---- FAQ accordion --------------------------------------------------- */
  var faq = document.getElementById('faq');
  if (faq) {
    faq.addEventListener('click', function (e) {
      var btn = e.target.closest('.qa__q'); if (!btn) return;
      var qa = btn.parentElement;
      var open = qa.classList.contains('open');
      [].slice.call(faq.querySelectorAll('.qa')).forEach(function (x) {
        x.classList.remove('open'); x.querySelector('.qa__a').style.maxHeight = null;
      });
      if (!open) { qa.classList.add('open'); var a = qa.querySelector('.qa__a'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
    window.addEventListener('resize', function () {
      var openQa = faq.querySelector('.qa.open'); if (openQa) { var a = openQa.querySelector('.qa__a'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  }

  /* ---- Logo wall: build duplicated marquee ----------------------------- */
  var track = document.getElementById('logoTrack');
  if (track) {
    var names = ['Neon Rooms', 'Coastline Festival', 'Azure Beach Club', 'The Pavilion', 'Velvet Underground', 'Pulse Arena', 'Skyline Rooftop', 'Harbour Sessions'];
    function pill(n) {
      var d = document.createElement('div'); d.className = 'logo-pill';
      var g = document.createElement('span'); g.className = 'g'; d.appendChild(g);
      var s = document.createElement('span'); s.textContent = n; d.appendChild(s);
      return d;
    }
    // two copies for seamless -50% loop
    names.concat(names).forEach(function (n) { track.appendChild(pill(n)); });
  }

  /* ---- Hero word cycler (clarity direction) ---------------------------- */
  var cycler = document.getElementById('cycler');
  if (cycler) {
    var words = ['marketing', 'enquiries', 'campaigns', 'socials', 'sign-ups', 'reports'];
    var ci = 0;
    var cw = cycler.querySelector('.cycler__word');
    if (!reduce) {
      setInterval(function () {
        if (document.body.getAttribute('data-hero') !== 'clarity') return;
        var old = cw;
        old.classList.add('out');
        ci = (ci + 1) % words.length;
        var next = document.createElement('span');
        next.className = 'cycler__word in';
        next.textContent = words[ci];
        cycler.appendChild(next);
        cw = next;
        setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 460);
      }, 2200);
    }
  }

  /* ---- Intelligence chat demo (hardcoded, clickable questions) --------- */
  var chatBody = document.getElementById('chatBody');
  var chatDemo = document.getElementById('chatDemo');
  var chatQs = document.getElementById('chatQs');
  var chatBusy = false;

  // Each answer: a lead line, optional KPI tiles, and a takeaway note.
  var ANSWERS = {
    weekend: {
      q: 'How are we looking for this weekend?',
      thinking: 'Checking sales, enquiries and pace across both nights…',
      lead: "Friday is in good shape, Saturday needs a nudge. Here's where both nights stand right now:",
      kpis: [
        { c: 78, dec: 0, s: '%', l: 'Friday sold' },
        { c: 54, dec: 0, s: '%', l: 'Saturday sold' },
        { c: 8, dec: 0, s: '', l: 'Enquiries to reply' }
      ],
      note: 'Friday is tracking 22% ahead of last week. Saturday is a little behind, and you have 8 enquiries from the last 3 days still waiting on a reply. Clearing those would likely close most of the gap.'
    },
    campaigns: {
      q: 'Which campaign performed best?',
      thinking: 'Comparing every campaign from the last 30 days…',
      lead: "Your Friday Reels push is the standout this month. The numbers behind it:",
      kpis: [
        { c: 312, dec: 0, s: '', l: 'Tickets sold' },
        { c: 9.1, dec: 1, s: 'x', l: 'Return on spend' },
        { c: 31, dec: 0, s: '%', l: 'Lower cost / sale' }
      ],
      note: 'The retargeting set aimed at recent enquiries and lapsed buyers did the heavy lifting. Repeating that structure for Saturday is the obvious next move.'
    },
    socials: {
      q: 'How are our socials doing?',
      thinking: 'Pulling reach and engagement across your channels…',
      lead: "Reach is up sharply and Instagram is leading the way. The headline numbers:",
      kpis: [
        { c: 44, dec: 0, s: '%', l: 'Reach this month' },
        { c: 62, dec: 0, s: '%', l: 'From Instagram' },
        { c: 3.4, dec: 1, s: 'x', l: 'Reels vs static' }
      ],
      note: 'Short-form video is clearly outperforming static posts. Leaning further into Reels and Stories for the weekend would carry that momentum.'
    }
  };

  function setActiveQ(key) {
    if (!chatQs) return;
    [].slice.call(chatQs.querySelectorAll('button')).forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-q') === key);
    });
  }

  function buildChat(key) {
    if (!chatBody) return;
    var data = ANSWERS[key] || ANSWERS.weekend;
    chatBusy = true;
    setActiveQ(key);
    chatBody.innerHTML = '';

    var u = document.createElement('div'); u.className = 'msg user capacity-fade-up';
    chatBody.appendChild(u);

    if (reduce) { u.textContent = data.q; renderAnswer(data, true); chatBusy = false; return; }

    var i = 0;
    (function typeQ() {
      u.textContent = data.q.slice(0, i);
      var cur = document.createElement('span'); cur.className = 'cursor'; u.appendChild(cur);
      i++;
      if (i <= data.q.length) setTimeout(typeQ, 22);
      else { u.textContent = data.q; setTimeout(showThinking, 420); }
    })();

    function showThinking() {
      var t = document.createElement('div'); t.className = 'msg ai capacity-fade-up';
      t.innerHTML = '<span class="thinking capacity-shimmer">' + data.thinking + '</span>';
      chatBody.appendChild(t);
      setTimeout(function () { chatBody.removeChild(t); renderAnswer(data, false); }, 1500);
    }
  }

  function renderAnswer(data, instant) {
    var ai = document.createElement('div'); ai.className = 'msg ai' + (instant ? '' : ' capacity-fade-up');
    ai.style.maxWidth = '94%';
    var kpiHtml = '<div class="ai-kpis">' + data.kpis.map(function (k) {
      return '<div class="k"><div class="kv" data-c="' + k.c + '" data-s="' + k.s + '" data-dec="' + k.dec + '">0</div><div class="kl">' + k.l + '</div></div>';
    }).join('') + '</div>';
    ai.innerHTML = '<div class="ans-lead"></div>' + kpiHtml +
      '<div class="ai-rec"><i data-lucide="sparkles" class="ic"></i><span><b>Takeaway:</b> ' + data.note + '</span></div>';
    chatBody.appendChild(ai);

    var lead = ai.querySelector('.ans-lead');
    icons();

    function afterText() {
      [].slice.call(ai.querySelectorAll('.kv')).forEach(function (el) {
        var target = parseFloat(el.getAttribute('data-c'));
        var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
        var suf = el.getAttribute('data-s') || '';
        if (reduce) { el.textContent = (dec ? target.toFixed(dec) : target) + suf; return; }
        var dur = 850, start = null;
        (function st(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var e = 1 - Math.pow(1 - p, 3);
          var v = target * e;
          el.textContent = (dec ? v.toFixed(dec) : Math.round(v)) + suf;
          if (p < 1) requestAnimationFrame(st);
          else el.textContent = (dec ? target.toFixed(dec) : target) + suf;
        })(0);
      });
      icons();
      chatBusy = false;
    }

    if (instant) { lead.textContent = data.lead; afterText(); return; }

    var j = 0;
    (function typeA() {
      lead.textContent = data.lead.slice(0, j);
      var cur = document.createElement('span'); cur.className = 'cursor'; lead.appendChild(cur);
      j++;
      if (j <= data.lead.length) setTimeout(typeA, 16);
      else { lead.textContent = data.lead; afterText(); }
    })();
  }

  if (chatDemo) {
    if (!('IntersectionObserver' in window)) buildChat('weekend');
    else {
      var played = false;
      var cobs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !played) { played = true; buildChat('weekend'); }
        });
      }, { threshold: 0.35 });
      cobs.observe(chatDemo);
    }
    if (chatQs) chatQs.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || chatBusy) return;
      buildChat(b.getAttribute('data-q'));
    });
  }

  /* ---- Tweaks bridge: apply hero direction + accent -------------------- */
  window.applyCapacityTweaks = function (t) {
    if (!t) return;
    if (t.headline) {
      var hh = document.getElementById('heroHeading');
      var HEADLINES = {
        platform: 'The marketing platform<br><span class="grad">built for venues</span>',
        fill: 'Everything you need<br>to <span class="grad">fill your venue</span>'
      };
      if (hh && HEADLINES[t.headline]) hh.innerHTML = HEADLINES[t.headline];
    }
    if (t.accent) {
      var de = document.documentElement.style;
      // .band--dark sets --brand: var(--capacity-blue), so override the base too
      de.setProperty('--capacity-blue', t.accent);
      de.setProperty('--brand', t.accent);
      de.setProperty('--primary', t.accent);
      de.setProperty('--ring', t.accent);
    }
    if (typeof t.motion === 'boolean') {
      document.documentElement.style.scrollBehavior = t.motion ? 'smooth' : 'auto';
    }
  };
})();
