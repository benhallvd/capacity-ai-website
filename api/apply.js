/* POST /api/apply - a job application from hiring.html.

   Posts a formatted message into the hiring channel, then uploads the CV into
   that message's thread so the file sits with the application rather than in a
   separate post.

   The CV never travels through this function's request body: the browser has
   already PUT it to Vercel Blob using a URL signed by /api/cv-url, and sends
   only the pathname here. This function reads those bytes back, hands them to
   Slack, then deletes the blob, so no CVs accumulate in storage.

   Slack's files.upload was retired, so the CV goes up in three steps:
   getUploadURLExternal, POST the bytes, completeUploadExternal with thread_ts.

   Environment variables (Vercel project settings, all server-side):
     SLACK_BOT_TOKEN         xoxb- token with chat:write and files:write
     SLACK_HIRING_CHANNEL    channel id, e.g. C0123ABC, for #hiring
     BLOB_READ_WRITE_TOKEN   set when a Blob store is connected to the project
     ALLOWED_ORIGIN          optional, only while the site is served off-platform */

import { issueSignedToken, presignUrl } from '@vercel/blob';
import { cors, json, clean, escapeSlack, validEmail, rateLimited } from './_lib.js';
import { isCvPathname, MAX_CV_BYTES } from './cv-url.js';

/* Order here is the order in the Slack message. */
const FIELDS = [
  ['role', 'Role', 120],
  ['name', 'Name', 120],
  ['email', 'Email', 200],
  ['phone', 'Phone', 60],
  ['location', 'Based', 120],
  ['links', 'Links', 400],
  ['notice', 'Notice', 60],
  ['right_to_work', 'Right to work in the UK', 10],
  ['why', 'Why this, and why now', 1200],
  ['proud', 'Proud of', 1200]
];

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request) {
  const headers = cors(request);
  if (rateLimited(request, 60000, 5, 'apply')) {
    return json({ error: 'Too many requests' }, 429, headers);
  }

  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_HIRING_CHANNEL;
  if (!token || !channel) {
    console.error('[apply] SLACK_BOT_TOKEN or SLACK_HIRING_CHANNEL is not set');
    return json({ error: 'Not configured' }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: 'Expected JSON' }, 400, headers);
  }

  /* Honeypot: a real person never fills a hidden field. Answer 200 so a bot
     learns nothing from the response. */
  if (clean(body.company_website, 200)) return json({ ok: true }, 200, headers);

  const data = {};
  FIELDS.forEach(function (f) { data[f[0]] = clean(body[f[0]], f[2]); });

  if (!data.name || !data.email) {
    return json({ error: 'Name and email are required' }, 400, headers);
  }
  if (!validEmail(data.email)) return json({ error: 'That email is not valid' }, 400, headers);

  /* Only a path this deployment minted is ever read back. */
  const cvPath = typeof body.cvPathname === 'string' ? body.cvPathname : '';
  const hasCv = cvPath !== '';
  if (hasCv && !isCvPathname(cvPath)) {
    return json({ error: 'That CV reference is not valid' }, 400, headers);
  }

  try {
    const ts = await postApplication(token, channel, data, hasCv);
    if (hasCv) await attachCv(token, channel, ts, cvPath, data.name);
  } catch (err) {
    console.error('[apply]', err && err.message);
    return json({ error: 'Could not send' }, 502, headers);
  }

  return json({ ok: true }, 200, headers);
}

function slack(token, method, body) {
  return fetch('https://slack.com/api/' + method, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  }).then(function (res) {
    return res.json();
  }).then(function (out) {
    if (!out.ok) throw new Error(method + ' failed: ' + out.error);
    return out;
  });
}

function postApplication(token, channel, data, hasCv) {
  const headline = (data.role || 'General application') + ' - ' + data.name;

  /* Short answers as a two-column field grid, long prose as its own block. */
  const short = FIELDS
    .filter(function (f) { return ['why', 'proud', 'role', 'name'].indexOf(f[0]) === -1; })
    .filter(function (f) { return data[f[0]]; })
    .map(function (f) {
      return { type: 'mrkdwn', text: '*' + f[1] + '*\n' + escapeSlack(data[f[0]]) };
    });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'New application: ' + (data.role || 'General'), emoji: true }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*' + escapeSlack(data.name) + '*  <mailto:' + data.email + '|' + escapeSlack(data.email) + '>'
      }
    }
  ];

  /* Slack caps a section at ten fields. */
  for (let i = 0; i < short.length; i += 10) {
    blocks.push({ type: 'section', fields: short.slice(i, i + 10) });
  }

  ['why', 'proud'].forEach(function (key) {
    if (!data[key]) return;
    const label = FIELDS.filter(function (f) { return f[0] === key; })[0][1];
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*' + label + '*\n' + escapeSlack(data[key]).slice(0, 2900) }
    });
  });

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: hasCv ? 'CV attached in thread' : 'No CV attached' }]
  });

  return slack(token, 'chat.postMessage', {
    channel: channel,
    text: headline,          /* fallback for notifications and screen readers */
    blocks: blocks
  }).then(function (out) { return out.ts; });
}

/* Read the blob back, hand it to Slack, then delete it. The delete runs even if
   the Slack upload fails, so a failed application leaves no CV behind. */
async function attachCv(slackToken, channel, threadTs, pathname, applicantName) {
  const signed = await issueSignedToken({
    pathname: pathname,
    operations: ['get', 'delete'],
    validUntil: Date.now() + 10 * 60 * 1000
  });

  try {
    const read = await presignUrl(signed, {
      operation: 'get',
      pathname: pathname,
      access: 'private',
      useCache: false
    });

    const res = await fetch(read.presignedUrl);
    if (!res.ok) throw new Error('Blob read responded ' + res.status);

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_CV_BYTES) throw new Error('Blob larger than the CV limit');

    await uploadToSlack(slackToken, channel, threadTs, bytes, pathname, applicantName);
  } finally {
    await deleteBlob(signed, pathname);
  }
}

async function uploadToSlack(token, channel, threadTs, bytes, pathname, applicantName) {
  const original = pathname.split('/').pop();
  const who = String(applicantName).replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 40).trim();
  const filename = (who ? who + ' - ' : '') + original;

  const params = new URLSearchParams({ filename: filename, length: String(bytes.byteLength) });
  const ticket = await fetch('https://slack.com/api/files.getUploadURLExternal?' + params, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token }
  }).then(function (res) { return res.json(); });

  if (!ticket.ok) throw new Error('getUploadURLExternal failed: ' + ticket.error);

  const put = await fetch(ticket.upload_url, { method: 'POST', body: bytes });
  if (!put.ok) throw new Error('CV upload responded ' + put.status);

  return slack(token, 'files.completeUploadExternal', {
    files: [{ id: ticket.file_id, title: filename }],
    channel_id: channel,
    thread_ts: threadTs
  });
}

async function deleteBlob(signed, pathname) {
  try {
    const gone = await presignUrl(signed, {
      operation: 'delete',
      pathname: pathname,
      access: 'private'
    });
    await fetch(gone.presignedUrl, { method: 'DELETE' });
  } catch (err) {
    /* A CV left in the store is a retention problem, not a failed application,
       so this is logged rather than surfaced to the applicant. */
    console.error('[apply] could not delete blob', pathname, err && err.message);
  }
}
