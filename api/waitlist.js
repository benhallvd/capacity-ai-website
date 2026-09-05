/* POST /api/waitlist - an early-access signup from the root page.

   Each signup is one small JSON file in this project's own private Blob store,
   under waitlist/. Nothing outside this Vercel project is involved, and the
   store is private, so a file is only ever readable with the project's token.

   The filename is a hash of the email, so the same address can only ever be
   saved once: a second signup finds the file already there and is treated as
   done, never overwriting the earlier record or its opt-in choice.

   Data minimisation on purpose: the email, whether they opted in to updates,
   the wording they opted in to, the page it came from, and the time. No IP
   address, no user agent.

   To export: `vercel blob list --prefix waitlist/` from this project, or the
   Storage tab of the project on vercel.com. Each file is one signup.

   Environment variables (Vercel project settings, all server-side):
     BLOB_READ_WRITE_TOKEN   set automatically when a private Blob store is
                             connected to the project (the CV upload on the
                             hiring page needs the same store)
     ALLOWED_ORIGIN          optional, only while the site is served off-platform */

import { head, put, BlobNotFoundError } from '@vercel/blob';
import { cors, json, clean, validEmail, rateLimited } from './_lib.js';

/* Recorded against every opt-in, so the record shows what was agreed to.
   Keep in step with the checkbox label in index.html. */
export const OPT_IN_WORDING =
  'Also send me occasional updates about Capacity by email. Optional, unsubscribe any time.';

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request) {
  const headers = cors(request);
  if (rateLimited(request, 60000, 5, 'waitlist')) {
    return json({ error: 'Too many requests' }, 429, headers);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[waitlist] BLOB_READ_WRITE_TOKEN is not set');
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

  const email = clean(body.email, 200).toLowerCase();
  if (!email || !validEmail(email)) {
    return json({ error: 'That email is not valid' }, 400, headers);
  }

  const optIn = body.marketing === true;
  const record = {
    email: email,
    marketing_opt_in: optIn,
    consent_wording: optIn ? OPT_IN_WORDING : null,
    source: clean(body.page, 300) || 'getcapacity.co/',
    created_at: new Date().toISOString()
  };

  try {
    const pathname = 'waitlist/' + (await sha256(email)) + '.json';
    if (await exists(pathname)) return json({ ok: true }, 200, headers);

    await put(pathname, JSON.stringify(record), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false
    });
  } catch (err) {
    console.error('[waitlist]', err && err.message);
    return json({ error: 'Could not save' }, 502, headers);
  }

  return json({ ok: true }, 200, headers);
}

async function exists(pathname) {
  try {
    await head(pathname, { access: 'private' });
    return true;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return false;
    throw err;
  }
}

/* Web Crypto, which is what the Edge runtime has. */
async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map(function (b) { return b.toString(16).padStart(2, '0'); })
    .join('');
}
