/* POST /api/cv-url - hands the browser a presigned URL to upload a CV, or the
   optional intro video from the application's last step.

   Vercel caps a function request body at 4.5MB, so a 10MB CV cannot be posted
   to /api/apply directly. Instead the browser PUTs the file straight to Vercel
   Blob using a URL signed here, and /api/apply is told only the pathname.

   The signed URL carries its own size and content-type limits, enforced by the
   Blob API rather than by us, so a client that lies about either is rejected at
   upload time.

   Environment: BLOB_READ_WRITE_TOKEN, set automatically when a Blob store is
   connected to the project. The store must be created with private access. */

import { issueSignedToken, presignUrl } from '@vercel/blob';
import { cors, json, clean, rateLimited } from './_lib.js';

export const MAX_CV_BYTES = 10 * 1024 * 1024;

export const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/* A one to two minute video. Recorded in the browser it lands as WebM (or MP4
   on Safari) at a few tens of MB; an upload from a phone can be larger, so the
   cap is generous but finite. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const KINDS = {
  cv:    { types: CV_TYPES,    max: MAX_CV_BYTES,    folder: 'cv',    typeError: 'CV must be a PDF or Word document', sizeError: 'That CV is over 10MB' },
  video: { types: VIDEO_TYPES, max: MAX_VIDEO_BYTES, folder: 'video', typeError: 'Video must be MP4, WebM or MOV',   sizeError: 'That video is over 100MB' }
};

/* Upload window. Long enough for a 10MB file on a bad connection, short enough
   that a leaked URL is worthless quickly. */
const URL_TTL_MS = 15 * 60 * 1000;

export function cvPathname(filename, folder) {
  const safe = String(filename || 'cv')
    .replace(/[^A-Za-z0-9._-]/g, '_')   /* no separators survive, so no traversal */
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+/, '')
    .slice(-80) || 'cv';
  return (folder || 'cv') + '/' + crypto.randomUUID() + '/' + safe;
}

/* Only paths this endpoint could have minted are ever read back. */
export function isCvPathname(p) {
  return typeof p === 'string' &&
    /^cv\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,80}$/.test(p);
}

export function isVideoPathname(p) {
  return typeof p === 'string' &&
    /^video\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,80}$/.test(p);
}

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request) {
  const headers = cors(request);
  if (rateLimited(request, 60000, 10, 'cv-url')) {
    return json({ error: 'Too many requests' }, 429, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: 'Expected JSON' }, 400, headers);
  }

  const kind = KINDS[body.kind === 'video' ? 'video' : 'cv'];
  /* Browsers report recorded video as e.g. video/webm;codecs=vp9, so only
     the type itself is compared. */
  const contentType = clean(body.contentType, 120).split(';')[0].trim();
  const size = Number(body.size);

  if (kind.types.indexOf(contentType) === -1) {
    return json({ error: kind.typeError }, 415, headers);
  }
  if (!Number.isFinite(size) || size <= 0 || size > kind.max) {
    return json({ error: kind.sizeError }, 413, headers);
  }

  const pathname = cvPathname(clean(body.filename, 120), kind.folder);
  const validUntil = Date.now() + URL_TTL_MS;

  try {
    const token = await issueSignedToken({
      pathname: pathname,
      operations: ['put'],
      allowedContentTypes: kind.types,
      maximumSizeInBytes: kind.max,
      validUntil: validUntil
    });

    const signed = await presignUrl(token, {
      operation: 'put',
      pathname: pathname,
      access: 'private',
      allowedContentTypes: kind.types,
      maximumSizeInBytes: kind.max,
      addRandomSuffix: false,
      allowOverwrite: false,
      validUntil: validUntil
    });

    return json({ uploadUrl: signed.presignedUrl, pathname: pathname }, 200, headers);
  } catch (err) {
    console.error('[cv-url]', err && err.message);
    return json({ error: 'Could not prepare the upload' }, 502, headers);
  }
}
