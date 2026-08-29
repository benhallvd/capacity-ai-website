/* =====================================================================
   Hiring form
   =====================================================================

   ---------------------------------------------------------------------
   1. WHERE APPLICATIONS GO
   ---------------------------------------------------------------------
   The form posts to /api/apply, a Vercel Edge function. That function
   posts a formatted message into the hiring Slack channel and uploads the
   CV into that message's thread.

   Nothing sensitive lives in this file. The Slack token and channel id are
   Vercel environment variables, read server-side only:

     SLACK_BOT_TOKEN       xoxb- token with chat:write and files:write
     SLACK_HIRING_CHANNEL  channel id for #hiring, e.g. C0123ABC

   ---------------------------------------------------------------------
   2. CHANGING THE QUESTIONS
   ---------------------------------------------------------------------
   Everything the form asks lives in the QUESTIONS array. Add, remove or
   reorder the entries and the form rebuilds itself. Keys:

     name        field name sent to the endpoint. Lower case, no spaces.
     label       what the applicant reads
     type        text | email | tel | url | textarea | select | checkbox | file
     required    true blocks submit until it is answered
     placeholder greyed-out example text (inputs and textareas)
     help        one line of guidance under the field
     options     array of strings, for `select`
     accept      file only: the extensions the picker offers
     half        true puts this field beside the next `half` one
     roles       select only: fills the options from the roles on the page

   A worked example of each type:

     { name: 'name',    label: 'Your name',  type: 'text',     required: true, half: true }
     { name: 'email',   label: 'Email',      type: 'email',    required: true, half: true }
     { name: 'role',    label: 'Role',       type: 'select',   roles: true }
     { name: 'links',   label: 'Links',      type: 'url',      help: 'CV, portfolio or LinkedIn' }
     { name: 'why',     label: 'Why here?',  type: 'textarea', max: 900 }
     { name: 'rtw',     label: 'I can work in the UK', type: 'checkbox', required: true }

   ===================================================================== */

(function () {
  'use strict';

  var ENDPOINT = '/api/apply';    /* the application itself */
  var CV_ENDPOINT = '/api/cv-url'; /* mints the presigned URL the CV is PUT to */

  var QUESTIONS = [
    {
      name: 'role',
      label: 'Which role',
      type: 'select',
      roles: true,
      required: true
    },
    {
      name: 'name',
      label: 'Your name',
      type: 'text',
      placeholder: 'Full name',
      required: true,
      half: true
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'you@example.com',
      required: true,
      half: true
    },
    {
      name: 'phone',
      label: 'Phone',
      type: 'tel',
      placeholder: 'Optional',
      half: true
    },
    {
      name: 'location',
      label: 'Where you are based',
      type: 'text',
      placeholder: 'City',
      half: true
    },
    {
      name: 'cv',
      label: 'Your CV',
      type: 'file',
      accept: '.pdf,.doc,.docx',
      help: 'PDF or Word, up to 10MB.',
      required: true
    },
    {
      name: 'links',
      label: 'Portfolio, LinkedIn or anything else',
      type: 'url',
      placeholder: 'https://',
      help: 'Optional. Anything we can open.'
    },
    {
      name: 'why',
      label: 'Why this, and why now',
      type: 'textarea',
      placeholder: 'A few lines is plenty.',
      max: 900,
      required: true
    },
    {
      name: 'proud',
      label: 'Something you built or ran that you are proud of',
      type: 'textarea',
      placeholder: 'What it was, what you did, what happened.',
      max: 900
    },
    {
      name: 'notice',
      label: 'Notice period',
      type: 'select',
      options: ['Available now', 'Two weeks', 'One month', 'Two months', 'Three months or more']
    },
    {
      name: 'right_to_work',
      label: 'I have the right to work in the UK',
      type: 'checkbox',
      required: true
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Nothing below here needs editing to change the questions.          */
  /* ------------------------------------------------------------------ */

  var form = document.getElementById('hiringForm');
  var mount = document.getElementById('hiringFields');
  if (!form || !mount) return;

  var errorBox = document.getElementById('hiringError');
  var doneBox = document.getElementById('hiringDone');

  /* Roles come from the page rather than a second list, so closing a role in
     the markup also takes it out of the dropdown. */
  function pageRoles() {
    return Array.prototype.map.call(
      document.querySelectorAll('.role[data-role]'),
      function (el) { return el.getAttribute('data-role'); }
    );
  }

  function roleOptions() {
    return pageRoles().concat(['Something else']);
  }

  /* With no roles on the page there is nothing to pick, so the question is
     dropped and every application is filed as a general one. */
  var GENERAL = 'General application';

  function activeQuestions() {
    if (pageRoles().length) return QUESTIONS;
    return QUESTIONS.filter(function (q) { return !q.roles; });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function errorFor(q) {
    if (q.type === 'email') return 'Please enter a valid email address.';
    if (q.type === 'file') return 'Please attach a PDF or Word file under 10MB.';
    return 'Please fill this in.';
  }

  function fieldHTML(q) {
    var id = 'q_' + q.name;
    var req = q.required ? ' <span class="req">*</span>' : '';
    var help = q.help ? '<span class="field__help">' + esc(q.help) + '</span>' : '';
    var aria = q.required ? ' required aria-required="true"' : '';
    var ph = q.placeholder ? ' placeholder="' + esc(q.placeholder) + '"' : '';
    var control;

    if (q.type === 'checkbox') {
      /* The label wraps the box, so the whole line is a target. */
      return '<div class="field field--check" data-name="' + esc(q.name) + '">' +
        '<label for="' + id + '"><input id="' + id + '" name="' + esc(q.name) + '" type="checkbox"' + aria + ' />' +
        '<span>' + esc(q.label) + req + '</span></label>' + help +
        '<span class="field__err">Please confirm this to continue.</span></div>';
    }

    if (q.type === 'select') {
      var opts = (q.roles ? roleOptions() : (q.options || [])).map(function (o) {
        return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
      }).join('');
      control = '<select id="' + id + '" name="' + esc(q.name) + '"' + aria + '>' +
        '<option value="" selected>Choose one</option>' + opts + '</select>';
    } else if (q.type === 'textarea') {
      control = '<textarea id="' + id + '" name="' + esc(q.name) + '"' + ph + aria +
        (q.max ? ' maxlength="' + q.max + '"' : '') + '></textarea>';
    } else if (q.type === 'file') {
      control = '<input id="' + id + '" name="' + esc(q.name) + '" type="file"' +
        (q.accept ? ' accept="' + esc(q.accept) + '"' : '') + aria + ' />';
    } else {
      var type = ['text', 'email', 'tel', 'url'].indexOf(q.type) > -1 ? q.type : 'text';
      control = '<input id="' + id + '" name="' + esc(q.name) + '" type="' + type + '"' + ph + aria + ' />';
    }

    return '<div class="field" data-name="' + esc(q.name) + '">' +
      '<label for="' + id + '">' + esc(q.label) + req + '</label>' +
      control + help +
      '<span class="field__err">' + errorFor(q) + '</span></div>';
  }

  /* `half` fields pair up into a row; anything else takes the full width. */
  function render() {
    var html = '', i = 0;
    var qs = activeQuestions();
    while (i < qs.length) {
      var q = qs[i];
      var next = qs[i + 1];
      if (q.half && next && next.half) {
        html += '<div class="field-row">' + fieldHTML(q) + fieldHTML(next) + '</div>';
        i += 2;
      } else {
        html += fieldHTML(q);
        i += 1;
      }
    }
    /* Bots fill in everything they can see, including what people cannot. */
    html += '<div class="hp" aria-hidden="true">' +
      '<label for="q_company_website">Company website</label>' +
      '<input id="q_company_website" name="company_website" type="text" tabindex="-1" autocomplete="off" /></div>';
    mount.innerHTML = html;
  }

  var MAX_CV_BYTES = 10 * 1024 * 1024;
  var CV_EXT = /\.(pdf|doc|docx)$/i;

  /* Some browsers report an empty type for .doc and .docx, so fall back to the
     extension. The signed upload URL only accepts these three. */
  var CV_MIME = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  function cvType(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    return CV_MIME[ext] || file.type;
  }

  function valueOf(q) {
    var el = document.getElementById('q_' + q.name);
    if (!el) return '';
    if (q.type === 'checkbox') return el.checked ? 'Yes' : '';
    if (q.type === 'file') return el.files && el.files[0] ? el.files[0] : '';
    return el.value.trim();
  }

  function validate(q) {
    var el = document.getElementById('q_' + q.name);
    if (!el) return true;
    var wrap = el.closest('.field');
    var value = valueOf(q);
    var ok = true;

    if (q.required && !value) ok = false;
    if (ok && value && q.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (ok && value && q.type === 'url') ok = /^(https?:\/\/|www\.)\S+\.\S+/i.test(value);
    if (ok && value && q.type === 'file') {
      ok = value.size > 0 && value.size <= MAX_CV_BYTES && CV_EXT.test(value.name);
    }

    if (wrap) wrap.classList.toggle('is-invalid', !ok);
    return ok;
  }

  function fail(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  /* The CV goes straight to Blob storage, because a Vercel function request
     body tops out at 4.5MB. The application itself then carries only the
     pathname, so it stays a small JSON post. */
  function uploadCv(file) {
    return fetch(CV_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: cvType(file),
        size: file.size
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('cv-url responded ' + res.status);
      return res.json();
    }).then(function (out) {
      return fetch(out.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': cvType(file) },
        body: file
      }).then(function (res) {
        if (!res.ok) throw new Error('CV upload responded ' + res.status);
        return out.pathname;
      });
    });
  }

  function send(payload) {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  render();

  /* Clicking Apply on a role selects that role and puts the cursor in the form. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.role__apply');
    if (!link) return;
    var role = link.closest('.role');
    var select = document.getElementById('q_role');
    if (role && select) {
      var wanted = role.getAttribute('data-role');
      Array.prototype.forEach.call(select.options, function (o) {
        if (o.value === wanted) select.value = wanted;
      });
    }
  });

  form.addEventListener('input', function (e) {
    var field = e.target.closest('.field.is-invalid');
    if (field) field.classList.remove('is-invalid');
    if (errorBox) errorBox.hidden = true;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (errorBox) errorBox.hidden = true;

    var ok = activeQuestions().map(validate).every(Boolean);
    if (!ok) {
      var bad = form.querySelector('.field.is-invalid input, .field.is-invalid select, .field.is-invalid textarea');
      if (bad) bad.focus();
      fail('Some answers are missing. They are marked above.');
      return;
    }

    var hp = document.getElementById('q_company_website');
    if (hp && hp.value) return;      /* a bot filled the hidden field */

    var payload = { submitted_at: new Date().toISOString(), page: location.href };
    activeQuestions().forEach(function (q) { payload[q.name] = valueOf(q); });
    if (!payload.role) payload.role = GENERAL;

    /* The file is uploaded separately, so it never goes in the JSON body. */
    var file = payload.cv;
    delete payload.cv;

    var button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = file ? 'Uploading...' : 'Sending...';
    }

    var ready = file
      ? uploadCv(file).then(function (pathname) {
          payload.cvPathname = pathname;
          if (button) button.textContent = 'Sending...';
        })
      : Promise.resolve();

    ready.then(function () { return send(payload); }).then(function (res) {
      if (!res.ok) throw new Error('Endpoint responded ' + res.status);
      var first = (payload.name || '').split(' ')[0];
      document.getElementById('hiringDoneName').textContent = first || 'there';
      form.hidden = true;
      doneBox.hidden = false;
      doneBox.setAttribute('tabindex', '-1');
      doneBox.focus();
    }).catch(function (err) {
      if (button) { button.disabled = false; button.innerHTML = 'Send application'; }
      fail('That did not send. Please try again in a moment.');
      /* eslint-disable-next-line no-console */
      console.error('[hiring]', err);
    });
  });
})();
