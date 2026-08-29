/* POST /api/demo - a demo request from signup.html.

   Emails the lead to whoever LEAD_TO_EMAIL points at. Deliberately simple:
   this is the placeholder until a real funnel exists.

   Environment variables (Vercel project settings, all server-side):
     RESEND_API_KEY    Resend API key
     LEAD_FROM_EMAIL   sender, must be on a domain verified in Resend
     LEAD_TO_EMAIL     where leads land
     ALLOWED_ORIGIN    optional, only while the site is served off-platform */

import { cors, json, clean, escapeHtml, validEmail, rateLimited, sendEmail } from './_lib.js';

const FIELDS = [
  ['venue', 'Venue', 120],
  ['name', 'Name', 120],
  ['role', 'Role', 120],
  ['email', 'Email', 200],
  ['phone', 'Phone', 60],
  ['type', 'Venue type', 80],
  ['msg', 'What they want to fix', 2000]
];

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request) {
  const headers = cors(request);
  if (rateLimited(request, 60000, 5, 'demo')) return json({ error: 'Too many requests' }, 429, headers);

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

  if (!data.venue || !data.name || !data.email) {
    return json({ error: 'Venue, name and email are required' }, 400, headers);
  }
  if (!validEmail(data.email)) return json({ error: 'That email is not valid' }, 400, headers);

  const rows = FIELDS
    .filter(function (f) { return data[f[0]]; })
    .map(function (f) {
      return '<tr>' +
        '<td style="padding:6px 16px 6px 0;color:#666;vertical-align:top;white-space:nowrap">' +
        escapeHtml(f[1]) + '</td>' +
        '<td style="padding:6px 0"><b>' + escapeHtml(data[f[0]]) + '</b></td></tr>';
    })
    .join('');

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#171717">' +
    '<h2 style="margin:0 0 4px">Lead submitted</h2>' +
    '<p style="margin:0 0 16px;color:#666">' + escapeHtml(data.venue) + ' via the demo form</p>' +
    '<table style="border-collapse:collapse">' + rows + '</table>' +
    '<p style="margin:20px 0 0;color:#999;font-size:13px">' +
    escapeHtml(clean(body.page, 300) || 'getcapacity.co/signup') + '</p></div>';

  try {
    await sendLead(data, html);
  } catch (err) {
    console.error('[demo]', err && err.message);
    return json({ error: 'Could not send' }, 502, headers);
  }

  return json({ ok: true }, 200, headers);
}

function sendLead(data, html) {
  const to = process.env.LEAD_TO_EMAIL;
  if (!to) throw new Error('LEAD_TO_EMAIL is not set');
  return sendEmail({
    to: to,
    subject: 'Lead submitted: ' + data.venue,
    html: html,
    replyTo: data.email
  });
}
