A done-for-you marketing platform for hospitality / nightlife venues and event promoters (bars, clubs, restaurants, event organisers). The product being marketed is the white-label client portal — one login where a venue sees everything its agency does for them, instead of scattered spreadsheets, WhatsApp threads, and ad-platform dashboards.

Positioning: "Your entire marketing operation, in one portal." Agency-grade marketing made visible and self-serve for venues.

Target visitor
Venue owners / marketing managers / promoters who are time-poor, non-technical, and frustrated with (a) not knowing what their agency/marketing is actually doing, (b) juggling Meta Ads Manager, GA4, booking tools, and design approvals separately.

Core value props (use as section headers / benefit blocks)
One portal, whole picture — campaigns, website analytics, bookings/events, social, reviews, contacts, invoices in a single branded dashboard.
See your ad spend working — live Meta (and Snapchat/TikTok) ad performance: spend, ROAS, conversions, per-ad metrics.
Request work in a click — submit artwork/campaign/website/social requests; track them through a live timeline (received → in progress → done).
AI that knows your venue — "Intelligence," an AI assistant with your last 30 days of data; ask questions, get charts, weekly summary emails.
Bookings & events at a glance — events calendar, booking heatmaps, year-on-year analytics.
Monthly reports, automatically — AI-generated multi-section performance reports, PDF + shareable link.
Reviews, social & contacts — Google reviews, social scheduling + follower growth, a contacts CRM with WiFi/CSV capture (GDPR-compliant).
(Don't list all 20 features — lead with 4–6 strongest. Designs and self-learning AI are not live; don't market them.)

Proof / credibility hooks
Real product, in production at dash.wearecapacity.co (don't link publicly yet — it's gated).
Built on Meta's native ad targeting, GA4, Google Search Console, Stripe billing.
White-label: every venue gets its own branded portal.
Tone & messaging
Confident, plain-English, benefit-led. Speak to busy venue operators, not marketers. Avoid jargon (no "ROAS" in a headline; explain it). Energy that fits nightlife/hospitality without being gimmicky.

Design system (match the app so brand carries over)
Brand blue #1b63f8 (primary CTA) · Cyan #21c0e9 · Lilac #9180ff · Orange #e27555 (accents)
Dark bg #08171c, card #142328 · Light bg #f2f2f2, card #e4e9f0
Radius 8px · Icons lucide-react only · Flat design — avoid shadows
Font/feel: clean, modern, slightly premium. A dark hero suits the nightlife audience.
Page structure (suggested)
Hero — headline + subhead + waitlist email capture (the swappable CTA) + product screenshot/mockup.
Problem → Solution (one portal) narrative.
Feature highlights — 4–6 benefit cards with screenshots.
How it works — 3 steps (join → onboard → run your marketing in one place).
Secondary CTA band → waitlist.
Footer — minimal: logo, contact ben@wearecapacity.co, socials, legal.
Functional requirements
Waitlist capture: email (+ optional name / venue name / role). Store somewhere queryable and send a confirmation email. Recommend Resend for email (the app already uses it; sender domain capacitymail.to is the only verified one — coordinate before sending from a new domain). Storage: a simple table/airtable/Supabase or form provider — agent's choice, but make it exportable.
CTA component abstracted so "Join the waitlist" → "Schedule a call" (e.g. Cal.com/Calendly embed) is a one-line swap.
Fast, SEO-friendly, mobile-first (audience is mostly on phones). Recommend Next.js + Tailwind to mirror the app stack, but it's a clean separate repo — no dependency on the portal codebase.
Basic analytics (GA4 or Plausible) + conversion event on signup.
Out of scope / don't imply
It's not a self-serve SaaS the visitor buys instantly — it's agency + portal, early access by waitlist. No pricing page yet, no "sign up free."
Don't market paused/planned features (in-house design service, self-learning AI).