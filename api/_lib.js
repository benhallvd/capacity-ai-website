/* Shared helpers for the two form endpoints.

   Both run on the Edge runtime, so there is no Node API here: fetch, FormData
   and Response only. Secrets live in Vercel project environment variables and
   never reach the browser. */

/* The site and the API sit on the same Vercel deployment, so same-origin
   requests need no CORS at all. ALLOWED_ORIGIN is only for the window where
   the site is still served from GitHub Pages. */
export function cors(request) {
  const allowed = (process.env.ALLOWED_ORIGIN || '').trim();
  if (!allowed) return {};
  const origin = request.headers.get('origin') || '';
  if (origin !== allowed) return {};
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      extraHeaders || {}
    )
  });
}

/* Trim, cap length and strip control characters. Everything these forms
   collect is attacker-controlled, and all of it ends up in an email body or a
   Slack message. */
export function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim()
    .slice(0, max || 2000);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* Slack renders &, < and > specially inside mrkdwn. */
export function escapeSlack(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/* One submission per IP per window, enough to stop a bored someone holding
   down submit. Edge instances are not shared state, so this is a speed bump
   rather than a guarantee; the real limit is Vercel's own. */
const seen = new Map();

export function rateLimited(request, windowMs, max, bucket) {
  /* Keyed by endpoint as well as IP, so submitting one form never counts
     against the other. */
  const key = (bucket || 'default') + '|' + (request.headers.get('x-forwarded-for') || 'unknown');
  const now = Date.now();
  const hits = (seen.get(key) || []).filter(function (t) { return now - t < windowMs; });
  hits.push(now);
  seen.set(key, hits);
  if (seen.size > 5000) seen.clear();
  return hits.length > max;
}

export async function sendEmail(opts) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!key || !from) throw new Error('RESEND_API_KEY or LEAD_FROM_EMAIL is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo || undefined
    })
  });

  if (!res.ok) throw new Error('Resend responded ' + res.status + ': ' + (await res.text()));
  return res.json();
}
