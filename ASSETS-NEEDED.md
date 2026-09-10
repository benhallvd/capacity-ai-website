# Assets needed to finish the site

The site is complete and functional without these. Each one is a visible upgrade
when supplied. Anything marked PLACEHOLDER is also flagged with a comment at the
relevant point in the markup.

## High priority

| # | Asset | Where | Spec |
|---|-------|-------|------|
| 1 | **Brand-correct wordmark** | Nav and footer on every page (`assets/capacity-wordmark-black.png`, `assets/capacity-wordmark-white.png`) | Both current files draw the asterisk logomark in **brand blue**. `brand.md` says the logomark is plain **black in light / white in dark, never brand-coloured**. Two flat monochrome files (ideally SVG) would bring the site into line. |
| 2 | **Client / venue logos** (6–10) | Logo strip under the hero, `index.html` → `.logos__grid` | Six placeholder marks live in `assets/logos/*.svg`. Swap the files 1:1 (same filenames) and the strip picks them up, or edit the `<img>` list. Monochrome, ~32px tall, drawn in `#171717`; the strip mutes them to 42% opacity. |
| 3 | ~~**OG social card**~~ | Done | `assets/og-card.png` is now a 1200×630 letterboxed dashboard screenshot on the dark surface. Replace with a designed card when one exists; keep the filename and re-stamp the `?v=` hash. |
| 4 | **ICRTouch logo** | Integrations ticker and card (`assets/brands/icrtouch.svg`) | The current file is a rebuild of the hex globe from the logo pasted in chat, not their official asset. Drop in the real SVG (or PNG at 2x) under the same name and it picks up everywhere. The other 18 marks in `assets/brands/` are the vendors' own files. |
| 5 | **Form environment variables** | Vercel project settings | The forms post to the functions in `api/` and stay broken until these are set. Waitlist (root page): needs only `BLOB_READ_WRITE_TOKEN`, see below; each signup is a JSON file under `waitlist/` in this project's private Blob store. Demo and hiring: `RESEND_API_KEY`, `LEAD_FROM_EMAIL` (on a domain verified in Resend), `LEAD_TO_EMAIL`, `SLACK_BOT_TOKEN` (`chat:write` + `files:write`, and the bot must be invited to the channel), `SLACK_HIRING_CHANNEL` (the `#hiring` channel id). `BLOB_READ_WRITE_TOKEN` is set for you when a **private** Blob store is connected to the project; CV uploads fail without it. |

## Nice to have

| # | Asset | Where | Spec |
|---|-------|-------|------|
| 6 | **Venue photography** | Behind the expanding panel on the final call to action (`assets/venue/venue-01..10.jpg`) | Ten shots supplied 2026-08-21, converted to black and white and capped at 1400px. Add or swap files in that folder and bump `CTA_SHOTS` in the build script. More variety in the set means fewer repeats as it flicks through. |
| 7 | **Real product screenshots** | Hero panel (`index.html` → `.hero__panel`) is a hand-built mockup | If you'd rather show the real thing, export clean dark-mode screenshots from dash.wearecapacity.co. |
| 8 | **Analytics** | Not installed | GA4 or Plausible snippet + a conversion event on the demo-form submit (handler is in `site.js`). |
| 9 | **Custom domain canonical** | No `<link rel="canonical">` yet | Add once the production domain is confirmed. |

## Numbers to confirm before launch

All of the below are currently **hidden** for the MVP launch, wrapped in
`<!-- MVP-HIDDEN ... -->` comments in `index.html`. Confirm the numbers before
unwrapping any of them:

- Hero trust line: "Trusted by **24+** ambitious UK venues"
- Stats band: **80k+** tickets · **£3m+** generated · **24+** venues · **12hrs** saved/week
- Logo strip: six placeholder venue marks in `assets/logos/`
- Case study ledger (+212%, 14k tickets, −38% cost/sale, +61% repeat bookings)

`case-neon-rooms.html` is entirely invented, linked from nowhere and blocked in
`robots.txt`. It needs a real client before it ships.
