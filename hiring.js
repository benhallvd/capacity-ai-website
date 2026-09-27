/* =====================================================================
   Hiring: the application dialog
   =====================================================================

   Three short steps in one <dialog>:
     1. Contact     name and email required; phone, city, LinkedIn optional
     2. Experience  a CV, a portfolio link or a LinkedIn: at least one
     3. Video       optional; record it here, upload a file, or paste a link

   WHERE IT GOES
   The CV and the video go straight from the browser to private Vercel Blob
   storage, using URLs signed by /api/cv-url (a Vercel function body tops out
   at 4.5MB). The application itself is a small JSON post to /api/apply, which
   posts it into the hiring Slack channel, threads the files under it, and
   deletes them from storage. Secrets are Vercel environment variables:

     SLACK_BOT_TOKEN        xoxb- token with chat:write and files:write
     SLACK_HIRING_CHANNEL   channel id for #hiring
     BLOB_READ_WRITE_TOKEN  set when the private Blob store is connected

   OPENING A ROLE
   Add an <article class="role" data-role="Title"> to hiring.html with a
   <button data-apply="Title">. Nothing here needs to change.
   ===================================================================== */

(function () {
  'use strict';

  var dlg = document.getElementById('apply');
  var form = document.getElementById('applyForm');
  if (!dlg || !form || typeof dlg.showModal !== 'function') return;

  var ENDPOINT = '/api/apply';
  var SIGNER = '/api/cv-url';
  var MAX_CV = 10 * 1024 * 1024;
  var MAX_VIDEO = 100 * 1024 * 1024;
  var MAX_SECONDS = 120;
  var CV_MIME = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  var $ = function (id) { return document.getElementById(id); };
  var steps = Array.prototype.slice.call(form.querySelectorAll('.apply__step'));
  var dots = Array.prototype.slice.call(form.querySelectorAll('.apply__steps li'));
  var bar = $('applyBar');
  var barWrap = bar.parentNode;
  var nextBtn = $('applyNext');
  var backBtn = $('applyBack');
  var errBox = $('applyError');
  var upBox = $('applyUpload');
  var at = 0;
  var sending = false;
  var recorded = null;          /* Blob from the camera, if any */
  var mode = 'record';          /* which video tab is showing */

  /* ---------------------------------------------------------- open/close */

  function open(role) {
    $('applyRole').textContent = role || 'General application';
    form.setAttribute('data-role', role || 'General application');
    document.documentElement.classList.add('is-locked');
    dlg.showModal();
    show(at);
    var first = steps[at].querySelector('input, textarea');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function close() {
    stopCamera();
    dlg.close();
  }

  dlg.addEventListener('close', function () {
    document.documentElement.classList.remove('is-locked');
    stopCamera();
  });

  /* A click on the backdrop lands on the dialog itself, not on its form. */
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg && !sending) close();
  });

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-apply]');
    if (trigger) { e.preventDefault(); open(trigger.getAttribute('data-apply')); return; }
    if (e.target.closest('[data-close]') && dlg.open && !sending) close();
  });

  /* A shared link to #apply opens straight onto the form. */
  if (location.hash === '#apply') {
    var only = document.querySelector('[data-apply]');
    open(only ? only.getAttribute('data-apply') : '');
  }

  /* ------------------------------------------------------------- steps */

  function show(i) {
    at = i;
    steps.forEach(function (s, n) {
      s.hidden = n !== i;
      s.classList.toggle('is-on', n === i);
    });
    dots.forEach(function (d, n) {
      d.classList.toggle('is-on', n === i);
      d.classList.toggle('is-done', n < i);
    });
    bar.style.width = ((i + 1) / steps.length * 100) + '%';
    barWrap.setAttribute('aria-valuenow', String(i + 1));
    backBtn.hidden = i === 0;
    var last = i === steps.length - 1;
    nextBtn.innerHTML = (last ? (hasVideo() ? 'Send application' : 'Send without a video') : 'Continue') +
      ' <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>';
    hideError();
  }

  function hasVideo() {
    if (mode === 'record') return !!recorded;
    if (mode === 'upload') return !!($('a_video').files && $('a_video').files[0]);
    return !!$('a_video_link').value.trim();
  }

  function refreshLabel() { if (at === steps.length - 1) show(at); }

  /* ---------------------------------------------------------- validation */

  function flag(name, bad) {
    var f = form.querySelector('.field[data-name="' + name + '"]');
    if (f) f.classList.toggle('is-invalid', !!bad);
    return !bad;
  }

  var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };
  /* A link is anything that looks like an address. The scheme is optional:
     people type linkedin.com/in/them, not https://www.linkedin.com/in/them. */
  var isUrl = function (v) { return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v.trim()); };
  var asUrl = function (v) { v = v.trim(); return !v || /^https?:\/\//i.test(v) ? v : 'https://' + v; };
  var val = function (id) { return $(id).value.trim(); };

  function cvFile() { return $('a_cv').files && $('a_cv').files[0] ? $('a_cv').files[0] : null; }

  function cvOk(file) {
    return file.size > 0 && file.size <= MAX_CV && /\.(pdf|doc|docx)$/i.test(file.name);
  }

  function check(i) {
    if (i === 0) {
      var ok = flag('name', !val('a_name'));
      ok = flag('email', !isEmail(val('a_email'))) && ok;
      ok = flag('linkedin', val('a_linkedin') && !isUrl(val('a_linkedin'))) && ok;
      return ok;
    }
    if (i === 1) {
      var file = cvFile();
      var ok1 = flag('cv', file && !cvOk(file));
      var link = val('a_portfolio');
      /* Any one of the three will do; LinkedIn from step one counts. */
      var some = !!file || !!link || !!val('a_linkedin');
      ok1 = flag('portfolio', (link && !isUrl(link)) || !some) && ok1;
      return ok1;
    }
    if (mode === 'link') return flag('video_link', val('a_video_link') && !isUrl(val('a_video_link')));
    if (mode === 'upload') {
      var v = $('a_video').files && $('a_video').files[0];
      if (v && v.size > MAX_VIDEO) { showError('That video is over 100MB. A link to it works just as well.'); return false; }
    }
    return true;
  }

  form.addEventListener('input', function (e) {
    var f = e.target.closest('.field.is-invalid');
    if (f) f.classList.remove('is-invalid');
    hideError();
    if (e.target.id === 'a_video_link') refreshLabel();
  });

  function showError(msg) { errBox.textContent = msg; errBox.hidden = false; }
  function hideError() { errBox.hidden = true; }

  backBtn.addEventListener('click', function () { if (at > 0 && !sending) show(at - 1); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (!check(at)) {
      var bad = steps[at].querySelector('.field.is-invalid input, .field.is-invalid textarea');
      if (bad) bad.focus();
      return;
    }
    if (at < steps.length - 1) {
      show(at + 1);
      if (at === steps.length - 1) stopCamera();
      return;
    }
    send();
  });

  /* ------------------------------------------------------- file pickers */

  function dropLabel(input) {
    var text = input.parentNode.querySelector('.drop__text b');
    var file = input.files && input.files[0];
    input.parentNode.classList.toggle('has-file', !!file);
    if (text) text.textContent = file ? file.name : (input.id === 'a_cv' ? 'Choose a file' : 'Choose a video');
  }

  ['a_cv', 'a_video'].forEach(function (id) {
    var input = $(id);
    input.addEventListener('change', function () { dropLabel(input); refreshLabel(); });
    var zone = input.parentNode;
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        input.files = e.dataTransfer.files;
        dropLabel(input);
        refreshLabel();
      }
    });
  });

  /* --------------------------------------------------------- video tabs */

  var tabs = Array.prototype.slice.call(form.querySelectorAll('[data-vtab]'));
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      mode = t.getAttribute('data-vtab');
      tabs.forEach(function (o) {
        var on = o === t;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      Array.prototype.forEach.call(form.querySelectorAll('[data-vpane]'), function (p) {
        var on = p.getAttribute('data-vpane') === mode;
        p.hidden = !on;
        p.classList.toggle('is-on', on);
      });
      if (mode !== 'record') stopCamera();
      refreshLabel();
    });
  });

  /* ------------------------------------------------------------ camera */

  var cam = $('vcam');
  var idle = $('vcamIdle');
  var timeEl = $('vcamTime');
  var startBtn = $('vcamStart'), recBtn = $('vcamRec'), stopBtn = $('vcamStop'), retakeBtn = $('vcamRetake');
  var stream = null, recorder = null, chunks = [], clock = null, started = 0;

  var canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  if (!canRecord) {
    /* No camera API here, so the tab that needs one steps aside. */
    tabs[0].hidden = true;
    tabs[1].click();
  }

  function pickType() {
    var types = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    return '';
  }

  function fmt(s) { return Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2); }

  function buttons(state) {
    startBtn.hidden = state !== 'off';
    recBtn.hidden = state !== 'ready';
    stopBtn.hidden = state !== 'rec';
    retakeBtn.hidden = state !== 'done';
    timeEl.hidden = state === 'off';
    form.querySelector('.vcam').classList.toggle('is-rec', state === 'rec');
  }

  function live() {
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: true
    }).then(function (s) {
      stream = s;
      cam.srcObject = s;
      cam.muted = true;
      cam.controls = false;
      idle.hidden = true;
      return cam.play();
    });
  }

  startBtn.addEventListener('click', function () {
    hideError();
    live().then(function () {
      timeEl.textContent = '0:00 / ' + fmt(MAX_SECONDS);
      buttons('ready');
    }).catch(function () {
      showError('We could not reach your camera. You can upload a video or paste a link instead.');
    });
  });

  recBtn.addEventListener('click', function () {
    chunks = [];
    var type = pickType();
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 1500000 } : undefined);
    } catch (err) {
      showError('Recording is not supported in this browser. Try uploading a video instead.');
      return;
    }
    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = function () {
      clearInterval(clock);
      var blobType = (recorder.mimeType || type || 'video/webm').split(';')[0];
      recorded = new Blob(chunks, { type: blobType });
      stopTracks();
      cam.srcObject = null;
      cam.src = URL.createObjectURL(recorded);
      cam.muted = false;
      cam.controls = true;
      buttons('done');
      refreshLabel();
    };
    recorder.start(1000);
    started = Date.now();
    buttons('rec');
    clock = setInterval(function () {
      var s = (Date.now() - started) / 1000;
      timeEl.textContent = fmt(s) + ' / ' + fmt(MAX_SECONDS);
      if (s >= MAX_SECONDS && recorder.state === 'recording') recorder.stop();
    }, 250);
  });

  stopBtn.addEventListener('click', function () {
    if (recorder && recorder.state === 'recording') recorder.stop();
  });

  retakeBtn.addEventListener('click', function () {
    recorded = null;
    if (cam.src) { URL.revokeObjectURL(cam.src); cam.removeAttribute('src'); }
    refreshLabel();
    startBtn.click();
  });

  function stopTracks() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
  }

  function stopCamera() {
    if (recorder && recorder.state === 'recording') recorder.stop();
    if (stream) {
      stopTracks();
      cam.srcObject = null;
      if (!recorded) { idle.hidden = false; buttons('off'); }
    }
  }

  /* ------------------------------------------------------------ sending */

  /* Signs an upload, then PUTs the file with progress, so a 60MB video does
     not look like a hung button. */
  function upload(file, kind, type, label) {
    return fetch(SIGNER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: kind, filename: file.name || label, contentType: type, size: file.size })
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (b) {
        throw new Error(b.error || ('Could not prepare the ' + label));
      });
      return res.json();
    }).then(function (out) {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', out.uploadUrl);
        xhr.setRequestHeader('content-type', type);
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) progress(label, e.loaded / e.total);
        };
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) resolve(out.pathname);
          else reject(new Error('The ' + label + ' did not upload'));
        };
        xhr.onerror = function () { reject(new Error('The ' + label + ' did not upload')); };
        xhr.send(file);
      });
    });
  }

  function progress(label, p) {
    upBox.hidden = false;
    upBox.querySelector('i').style.width = Math.round(p * 100) + '%';
    upBox.lastChild.textContent = 'Uploading ' + label + ' ' + Math.round(p * 100) + '%';
  }

  function send() {
    if ($('a_company_website').value) return;       /* a bot filled the hidden field */
    sending = true;
    nextBtn.disabled = true;
    backBtn.disabled = true;
    hideError();

    var payload = {
      role: form.getAttribute('data-role') || 'General application',
      name: val('a_name'),
      email: val('a_email'),
      phone: val('a_phone'),
      location: val('a_location'),
      linkedin: asUrl(val('a_linkedin')),
      portfolio: asUrl(val('a_portfolio')),
      extra: val('a_extra'),
      video_link: mode === 'link' ? asUrl(val('a_video_link')) : '',
      submitted_at: new Date().toISOString(),
      page: location.href
    };

    var chain = Promise.resolve();
    var cv = cvFile();
    if (cv) {
      var ext = (cv.name.split('.').pop() || '').toLowerCase();
      chain = chain.then(function () { return upload(cv, 'cv', CV_MIME[ext] || cv.type, 'CV'); })
                   .then(function (p) { payload.cvPathname = p; });
    }
    var video = mode === 'record' ? recorded : (mode === 'upload' && $('a_video').files ? $('a_video').files[0] : null);
    if (video) {
      var vtype = (video.type || 'video/mp4').split(';')[0];
      if (!video.name) video.name = 'intro.' + (vtype === 'video/webm' ? 'webm' : 'mp4');
      chain = chain.then(function () { return upload(video, 'video', vtype, 'video'); })
                   .then(function (p) { payload.videoPathname = p; });
    }

    nextBtn.textContent = 'Sending...';
    chain.then(function () {
      upBox.lastChild.textContent = 'Sending';
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }).then(function (res) {
      if (!res.ok) throw new Error('Could not send');
      $('applyDoneName').textContent = (payload.name.split(' ')[0]) || 'there';
      steps.forEach(function (s) { s.hidden = true; });
      $('applyDone').hidden = false;
      $('applyFoot').hidden = true;
      form.querySelector('.apply__progress').hidden = true;
      sending = false;
    }).catch(function (err) {
      sending = false;
      nextBtn.disabled = false;
      backBtn.disabled = false;
      upBox.hidden = true;
      show(at);
      showError((err && err.message && err.message.indexOf('Could not send') === -1 ? err.message + '. ' : '') +
        'That did not send. Please try again in a moment.');
      /* eslint-disable-next-line no-console */
      console.error('[hiring]', err);
    });
  }

  show(0);
})();
