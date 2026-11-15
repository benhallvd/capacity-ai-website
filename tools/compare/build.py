"""The comparison pages: /compare and one page per rival.

    python3 tools/compare/build.py && python3 tools/shell/shell.py && python3 stamp.py

Every figure about a rival comes from that rival's own published page, named
in SOURCE. Change a fact here, rerun, and the page, its FAQ markup and its
table move together. Nothing about Capacity is claimed that the rest of the
site does not already say. Short on purpose: one line per cell.
"""
from __future__ import annotations

import html as H
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = "https://www.getcapacity.co"
CHECKED = "November 2026"

VENUES = [
    ("labyrinth-logo.png", "Labyrinth"), ("trilogy-mark.svg", "Trilogy"), ("home-botanic-logo.svg", "Home &amp; Botanic"),
    ("fritz-steins-logo.svg", "Fritz &amp; Steins"), ("chapel-mark.png", "The Chapel"), ("ovation-logo.png", "Ovation"), ("bunker-logo.png", "Bunker"),
]

# The three results the client has cleared, each worded for its page.
PROOF = {
    "ebc": dict(logo="ebc-logo.svg", wide=True, alt="Epic Bars &amp; Clubs", fig="+52%", line="ticket sales across the group in 12 months.", photo="people/trilogy-confetti.jpg", crop=False),
    "ebc2": dict(logo="ebc-logo.svg", wide=True, alt="Epic Bars &amp; Clubs", fig="+52%", line="more tickets sold in a year, on the tools the venues already ran.", photo="people/trilogy-confetti.jpg", crop=False),
    "fritz": dict(logo="fritz-steins-logo.svg", wide=False, alt="Fritz &amp; Steins", fig="&pound;16.40", line="per Christmas private hire enquiry, each a party of 50 or more.", photo="clients/fritz-steins-bar.jpg", crop=True),
    "botanic": dict(logo="home-botanic-logo.svg", wide=False, alt="Home &amp; Botanic", fig="1.6k", line="contacts from one sold out launch weekend.", photo="clients/home-botanic-interior.jpg", crop=False),
    "botanic2": dict(logo="home-botanic-logo.svg", wide=False, alt="Home &amp; Botanic", fig="70%", line="of guests opted in to WiFi in launch week.", photo="clients/home-botanic-interior.jpg", crop=False),
}

# Capacity's column for the ticketing rivals. Nothing beyond the ticketing
# page and the FAQ.
US_TICKETS = {
    "Where tickets sell": "Your own website, in your own name.",
    "Whose name is on it": "Yours, from the listing to the wallet pass.",
    "Fees": "Agreed in the audit.",
    "Who keeps the buyer": "You. Every buyer is a profile in your CRM.",
    "After the event": "The CRM forecasts the next one and drafts the moves.",
    "Set-up": "Set up around how you sell. Run it yourself, or with our team.",
    "Best for": "Venues, promoters and events that want their own name on the ticket and their own customers.",
}

RIVALS = [
    dict(
        slug="dice", name="DICE", kind="tickets", proof="ebc", logo="dice.svg", mono=True, wide=True,
        title="Capacity vs DICE | Capacity",
        desc="DICE sells tickets to its own audience in its own app. Capacity sells yours on your site, in your name, and keeps every buyer. Fees and terms side by side.",
        line="Choose where your tickets sell.",
        lede="DICE is a ticketing app with an audience of its own. Capacity is your own ticketing, in your name, with every buyer kept as your customer.",
        tag="Ticketing app",
        them={
            "Where tickets sell": "The DICE app, to DICE&rsquo;s audience.",
            "Whose name is on it": "DICE&rsquo;s. Fans buy, hold and hear in DICE.",
            "Fees": "8.5% + VAT service fee (min &pound;1) and 2.5% + VAT transaction fee, on self sign-up terms.",
            "Who keeps the buyer": "Shared. Marketing needs your own opt-in.",
            "After the event": "Waitlists, reminders and Encore, inside DICE.",
            "Set-up": "Self-serve. Paid out within five business days.",
            "Best for": "Gigs and one-offs that want DICE&rsquo;s audience.",
        },
        source=("DICE&rsquo;s published UK terms", "https://support.dice.fm/article/758-mio-ticketing-terms-and-conditions-uk"),
        pick_them=["You want DICE&rsquo;s app audience for a one-off.", "Touts are the main worry.", "The buyer can be DICE&rsquo;s customer."],
        pick_us=["You want your own name on the ticket.", "You want every buyer in your own CRM.", "You want it built around how you sell."],
        faq=[
            ("Do we have to leave DICE?", "No. DICE connects, so buyers there land in the same CRM. Your next event can sell through your own site as well, or instead."),
            ("What does DICE charge?", "On its published self sign-up terms, a service fee of 8.5% plus VAT on face value with a £1 minimum, and a transaction fee of 2.5% plus VAT. Partner deals are quoted. Check DICE's terms for current figures."),
            ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
        ],
    ),
    dict(
        slug="skiddle", name="Skiddle", kind="tickets", proof="ebc2", logo="skiddle.svg", mono=True, wide=True,
        title="Capacity vs Skiddle | Capacity",
        desc="Skiddle lists your night with a 10% + 27p booking fee. Capacity sells in your own name on your own site and keeps the buyer. Fees and terms side by side.",
        line="Choose where your tickets sell.",
        lede="Skiddle is a listing site with a booking fee. Capacity is your own ticketing, in your name, with a CRM that knows who came.",
        tag="Listing site",
        them={
            "Where tickets sell": "skiddle.com and the Skiddle app.",
            "Whose name is on it": "Skiddle&rsquo;s, as your disclosed agent.",
            "Fees": "10% + 27p per ticket, min &pound;1, paid by the customer by default.",
            "Who keeps the buyer": "Shared. Marketing needs a valid opt-in.",
            "After the event": "Remind Me, Re:Sell and brand alerts, inside Skiddle.",
            "Set-up": "Self-serve. Free to list.",
            "Best for": "Promoters who want a free listing in front of Skiddle&rsquo;s audience.",
        },
        source=("Skiddle&rsquo;s help centre", "https://help.promotioncentre.co.uk/en/articles/9362892-what-is-the-booking-fee-rate-on-skiddle"),
        pick_them=["You want a free listing with reach.", "The fee is the customer&rsquo;s, not yours.", "You run one-offs."],
        pick_us=["You want your own name on the ticket.", "You want the people who came in one CRM.", "You want it built around how you sell."],
        faq=[
            ("Can we keep selling on Skiddle?", "Yes. Skiddle connects, so buyers there land in the same CRM, and your next event can sell through your own site too."),
            ("What does Skiddle charge?", "Its published default is 10% of the ticket price plus 27p, minimum £1, paid by the customer on top. You can pay it yourself as a commission instead. Check Skiddle's help centre for the current rate."),
            ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
        ],
    ),
    dict(
        slug="fatsoma", name="Fatsoma", kind="tickets", proof="botanic", logo="fatsoma.svg", mono=True, wide=True,
        title="Capacity vs Fatsoma | Capacity",
        desc="Fatsoma is a marketplace with a 10% booking fee and reps. Capacity is your own ticketing on your own site, with every buyer kept in your CRM. Side by side.",
        line="Choose where your tickets sell.",
        lede="Fatsoma sells your tickets on Fatsoma, with reps to push them. Capacity sells them on your site in your name, and keeps the buyer for the next one.",
        tag="Marketplace",
        them={
            "Where tickets sell": "fatsoma.com and the Fatsoma app.",
            "Whose name is on it": "Fatsoma&rsquo;s. A branded site is Professional, from &pound;1,500.",
            "Fees": "10% per paid ticket, min &pound;1, plus Stripe processing. Free tickets are free.",
            "Who keeps the buyer": "You get the data. Buyers also follow you on Fatsoma.",
            "After the event": "Announcements, promo codes and reps, inside Fatsoma.",
            "Set-up": "Self-serve. Paid out three working days after the event.",
            "Best for": "Student nights and rep-led events that sell on volume.",
        },
        source=("Fatsoma&rsquo;s pricing page", "https://ticketing.fatsoma.com/pricing"),
        pick_them=["Reps are how your nights sell.", "You want a marketplace with no monthly cost.", "A Fatsoma page is fine for now."],
        pick_us=["You want the checkout on your own site.", "You want tickets, bookings and the till in one record.", "You want the next night forecast from the last."],
        faq=[
            ("What does Fatsoma charge?", "Its published booking fee is 10% per paid ticket with a £1 minimum, which you cover or pass on, plus Stripe's processing fee. Free tickets carry no fee. Professional starts from £1,500 and Enterprise, with checkout on your own site, is priced on request."),
            ("When does Fatsoma pay out?", "On its standard terms, no sooner than three working days after the event ends."),
            ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
        ],
    ),
    dict(
        slug="fixr", name="FIXR", kind="tickets", proof="ebc", logo="fixr.svg", mono=True, wide=True,
        title="Capacity vs FIXR | Capacity",
        desc="FIXR is free for organisers and adds 4.99% + 49p to each ticket. Capacity sells in your own name on your own site and keeps every buyer. Side by side.",
        line="Choose where your tickets sell.",
        lede="FIXR is a ticket shop that costs the organiser nothing and charges the buyer. Capacity is your own ticketing, in your name, with every buyer kept.",
        tag="Ticket shop",
        them={
            "Where tickets sell": "fixr.co and the FIXR app.",
            "Whose name is on it": "FIXR&rsquo;s checkout. You get the full face value.",
            "Fees": "4.99% + 49p + VAT per paid ticket, paid by the buyer, plus a transaction fee per order.",
            "Who keeps the buyer": "Buyers hold a FIXR account.",
            "After the event": "FIXR&rsquo;s entry manager and point of sale.",
            "Set-up": "Self-serve. Free for organisers.",
            "Best for": "Student and society events that want a free ticket shop.",
        },
        source=("FIXR&rsquo;s help centre", "https://help.fixr.co/en/articles/10260634-what-fees-apply"),
        pick_them=["Your buyers already use FIXR.", "Free for the organiser decides it.", "You do not need the buyer after the door."],
        pick_us=["You want your own name on the ticket.", "You want every buyer in your own CRM.", "You sell all year, not one week."],
        faq=[
            ("What does FIXR charge?", "On its published Pro plan, £0.49 plus 4.99% plus VAT per paid ticket, added on top of the price and paid by the buyer, with a transaction fee per order. Student and charity events pay 3.99%."),
            ("Can we keep FIXR and use Capacity?", "Yes. FIXR connects, so buyers there land in the same CRM, and your next event can sell through your own site too."),
            ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
        ],
    ),
    dict(
        slug="eventbrite", name="Eventbrite", kind="tickets", proof="ebc2", logo="eventbrite.svg", mono=False, wide=False,
        title="Capacity vs Eventbrite | Capacity",
        desc="Eventbrite is a marketplace for any event with a fee on every paid ticket. Capacity is ticketing and a CRM built for nightlife, live events and venues, in your own name. Side by side.",
        line="Choose where your tickets sell.",
        lede="Eventbrite is the marketplace for any event. Capacity is ticketing and marketing built around nightlife, live events and venues, in your own name.",
        tag="Marketplace",
        them={
            "Where tickets sell": "The Eventbrite marketplace, or embedded on your site.",
            "Whose name is on it": "Eventbrite&rsquo;s checkout, with your event on it.",
            "Fees": "A service fee on every paid ticket, paid by the buyer by default. Free events are free.",
            "Who keeps the buyer": "You get reports and can email buyers through Eventbrite.",
            "After the event": "Email campaigns and Eventbrite Ads, inside Eventbrite.",
            "Set-up": "Self-serve. Pre-event payouts on a schedule.",
            "Best for": "One-off and general events that want the widest reach.",
        },
        source=("Eventbrite&rsquo;s UK pricing page", "https://www.eventbrite.co.uk/organizer/pricing/"),
        pick_them=["You run one-offs and want the biggest marketplace.", "You need reserved seating or registration forms.", "Eventbrite&rsquo;s checkout on your site is enough."],
        pick_us=["You run nights, events or venues, not one-offs.", "You want the till and the door in the same record as the tickets.", "You want the next event forecast from the last."],
        faq=[
            ("What does Eventbrite charge?", "A service fee on every paid ticket, paid by the buyer by default; organisers can choose to cover it. Free events carry no fee. The current UK rate is on Eventbrite's pricing page."),
            ("Can we keep Eventbrite?", "Yes. Eventbrite connects, so buyers there land in the same CRM, and your next event can sell through your own site too."),
            ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
        ],
    ),
    dict(
        slug="designmynight", name="DesignMyNight", kind="bookings", proof="fritz", logo="designmynight.svg", mono=True, wide=True,
        title="Capacity vs DesignMyNight | Capacity",
        desc="DesignMyNight and its Collins booking system take the table booking. Capacity takes bookings, tickets and messages into one guest profile. Side by side, with Collins pricing.",
        line="Choose how your bookings work.",
        lede="DesignMyNight is a discovery site and Collins is the booking system behind it. Capacity takes the booking too, then keeps the guest.",
        tag="Bookings software",
        rows=["What it is", "Bookings", "Pricing", "Who keeps the guest", "Till and data", "Set-up", "Best for"],
        us={
            "What it is": "Ticketing, enquiries, WhatsApp, forms and a predictive CRM.",
            "Bookings": "Every enquiry from every channel in one inbox.",
            "Pricing": "Agreed in the audit.",
            "Who keeps the guest": "You. One profile per guest, across everything.",
            "Till and data": "Your till connects, beside your customer data.",
            "Set-up": "Set up around how you run. Run it yourself, or with our team.",
            "Best for": "Venues and events that want bookings, tickets and marketing in one record.",
        },
        them={
            "What it is": "A discovery site, and Collins, the booking software behind it.",
            "Bookings": "Tables, deposits and pre-orders, by widget and listing.",
            "Pricing": "Collins Evo from &pound;149 a month per site. Referrals paid per booking.",
            "Who keeps the guest": "Collins holds the guest record and tags.",
            "Till and data": "Access EPOS and others, through an open API.",
            "Set-up": "Self-serve. Live within ten days, phone support 9 to 5.30.",
            "Best for": "Bars and restaurants that live on table bookings.",
        },
        source=("Access&rsquo;s Collins pages", "https://www.theaccessgroup.com/en-gb/hospitality/software/booking-reservations/"),
        pick_them=["Table bookings and deposits are the business.", "You want the DesignMyNight listing.", "You already run Access EPOS."],
        pick_us=["You want the booking, the ticket and the till visit on one guest.", "Private hire enquiries are where the money is.", "You run events as well as tables."],
        faq=[
            ("What does Collins cost?", "Access lists Collins Evo from £149 a month per site, with the full price list behind a form. DesignMyNight's listing is paid per confirmed reservation or through bundles, with no rate published."),
            ("Does Capacity take table bookings?", "Yes. Enquiries and bookings from every channel land in one inbox, and every booker becomes a profile in your CRM."),
            ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
        ],
    ),
    dict(
        slug="furiosa", name="Furiosa", kind="crm", proof="botanic2", logo=None, mono=True, wide=True,
        title="Capacity vs Furiosa | Capacity",
        desc="Furiosa is event marketing software priced by contact count, from £350 a month. Capacity is a predictive CRM with ticketing, till and door data in it, for promoters, events and venues. Side by side.",
        line="Choose what your CRM knows.",
        lede="Furiosa is event marketing software priced by contact count. Capacity is a predictive CRM with your ticketing, till and door in it, built around your events and venues.",
        tag="Marketing software",
        rows=["What it is", "Who runs it", "Pricing", "Ticketing", "Messaging", "Till and door", "Best for"],
        us={
            "What it is": "A predictive CRM built around your events and venues.",
            "Who runs it": "You, your team, or ours. Your call.",
            "Pricing": "Agreed in the audit.",
            "Ticketing": "Your own, in your name. DICE, Skiddle and more connect.",
            "Messaging": "WhatsApp, email and SMS, with the next moves drafted for you.",
            "Till and door": "Your till, door scans and WiFi feed the same CRM.",
            "Best for": "Promoters, events and venues that want tickets, marketing and the CRM in one.",
        },
        them={
            "What it is": "Event marketing software: sign-up pages, audiences, campaigns.",
            "Who runs it": "You. Self-serve, with a page builder.",
            "Pricing": "Free to 500 contacts, then &pound;350 to &pound;4,375 a month by contact count, ex VAT.",
            "Ticketing": "Its own event pages via Stripe, or synced from Skiddle, DICE and Eventbrite.",
            "Messaging": "Email, SMS and WhatsApp campaigns.",
            "Till and door": "No till or point of sale integration listed.",
            "Best for": "Sign-up pages and campaigns, priced by contact count.",
        },
        source=("Furiosa&rsquo;s pricing page", "https://furiosa.com/pricing"),
        pick_them=["You only need sign-up pages and campaigns.", "Contact count is how you want to pay.", "Your tickets and your CRM can stay separate."],
        pick_us=["You want ticketing, marketing and the CRM in one.", "You want the till, the door and WiFi in the same record.", "You want the next event forecast from the last."],
        faq=[
            ("What does Furiosa cost?", "Furiosa publishes its plans: free up to 500 contacts, then Starter at £350 a month for 5,000 contacts up to Scale at £4,375 a month for 250,000, all ex VAT, with Enterprise on request."),
            ("Is Furiosa self-serve?", "Yes. It describes a visual page builder, with its team designing sign-up pages on request and an account manager on the Scale plan."),
            ("Who runs Capacity day to day?", "You, your team, or ours, in whatever mix suits you. It is set up around how you sell, and the CRM drafts the next moves for whoever approves them."),
            ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
        ],
    ),
]

SPRITE = '''<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
  <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
  <symbol id="i-arrow-up-right" viewBox="0 0 24 24"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></symbol>
  <symbol id="i-instagram" viewBox="0 0 24 24"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.4211.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.1623.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.439.645 1.439 1.439z"/></symbol>
  <symbol id="i-linkedin" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></symbol>
</svg>'''


def head(p: str, title: str, desc: str, path: str, ld: list[dict]) -> str:
    url = f"{SITE}/{path}"
    scripts = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False, indent=2)}</script>' for x in ld)
    return f'''<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{desc}" />
<meta name="theme-color" content="#0a0a0a" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Capacity" />
<meta property="og:locale" content="en_GB" />
<meta property="og:url" content="{url}" />
<link rel="canonical" href="{url}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/png" sizes="64x64" href="{p}assets/favicon.png?v=a6689e9c9e" />
<link rel="icon" type="image/png" sizes="512x512" href="{p}assets/favicon-512.png?v=eafb25fc21" />
<link rel="apple-touch-icon" href="{p}assets/apple-touch-icon.png?v=a571e68c64" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rethink+Sans:ital,wght@0,400..800;1,400..800&family=Mona+Sans:wdth,wght@125,600..800&display=swap" />
<link rel="stylesheet" href="{p}tokens.css" />
<link rel="stylesheet" href="{p}site.css" />
<link rel="stylesheet" href="{p}home-next.css" />
<script>document.documentElement.classList.add('js');</script>
{scripts}
</head>
'''


def crumbs(*items: tuple[str, str]) -> dict:
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}


def faq_ld(qas) -> dict:
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qas]}


def tick(p: str) -> str:
    li = "".join(f'<li><img src="{p}assets/clients/{f}" alt="{n}" loading="lazy" /></li>' for f, n in VENUES)
    return f'''<section class="band on-dark nx-tick" aria-label="Venues running on Capacity">
  <p class="nx-tick__k" data-r>Running in <b>24 venues</b> across the UK</p>
  <div class="vt__row nx-tick__row" data-r style="--rd:1"><ul class="vt__track">{li}</ul><ul class="vt__track" aria-hidden="true">{li}</ul></div>
</section>
'''


def esc(s: str) -> str:
    return H.escape(s, quote=False).replace("'", "&rsquo;")


def faq(qas, lead="Questions.") -> str:
    items = "".join(f'''      <details class="qa" name="faq" data-r style="--rd:{i}">
        <summary class="qa__q">{esc(q)}<svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg></summary>
        <div class="qa__a"><div class="qa__inner"><p>{esc(a)}</p></div></div>
      </details>
''' for i, (q, a) in enumerate(qas))
    return f'''<section class="band on-dark fq" id="faq">
  <div class="wrap">
    <div class="head head--center">
      <h2 class="h2" data-r="wipe">{lead}</h2>
    </div>
    <div class="faq faq--cards">
{items}    </div>
  </div>
</section>
'''


def close(p: str, line: str) -> str:
    return f'''<section class="band on-dark cta-photo cta-photo--page" id="demo">
  <img class="cta-photo__photo" data-ascii="soft" src="{p}assets/photo/room-mirror-ball.jpg" alt="" loading="lazy" />
  <div class="cta-photo__shade" aria-hidden="true"></div>
  <div class="wrap cta-photo__inner">
    <h2 class="cta-photo__title" data-r="wipe">Start with an audit.</h2>
    <p class="lede" data-r style="--rd:1">{line}</p>
    <a class="btn btn--primary btn--lg" href="{p}discovery" data-r style="--rd:2">Book an audit <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>
  </div>
</section>
'''


def footer(p: str) -> str:
    return f'''<footer class="band on-dark footer">
  <i class="footer__beam" aria-hidden="true"></i>
  <div class="wrap">
    <div class="footer__inner">
      <div class="footer__brand">
        <a href="/" aria-label="Capacity home"><img src="{p}assets/capacity-logomark-white.png?v=fb245a8e45" alt="Capacity" /></a>
        <p>Built around how your business runs.</p>
        <div class="footer__socials">
          <a href="https://instagram.com/wearecapacity" aria-label="Capacity on Instagram"><svg class="ic ic--brand" aria-hidden="true"><use href="#i-instagram"/></svg></a>
          <a href="https://www.linkedin.com/company/wearecapacity" aria-label="Capacity on LinkedIn"><svg class="ic ic--brand" aria-hidden="true"><use href="#i-linkedin"/></svg></a>
        </div>
      </div>
      <nav class="footer__col footer__col--wide" aria-label="Solutions">
        <h3>Solutions</h3>
        <a href="{p}ticketing">Ticketing</a>
        <a href="{p}enquiries">Enquiries</a>
        <a href="{p}profiles">Predictive CRM</a>
        <a href="{p}whatsapp">WhatsApp</a>
        <a href="{p}social">Social media</a>
        <a href="{p}forms">Signup forms</a>
        <a href="{p}analytics">Website</a>
        <a href="{p}till">Till and POS</a>
        <a href="{p}reports">Reports</a>
        <a href="{p}files">Files</a>
        <a href="{p}intelligence">Capacity Intelligence</a>
      </nav>
      <nav class="footer__col" aria-label="Company">
        <h3>Company</h3>
        <a href="/#how">How we work</a>
        <a href="{p}integrations">Integrations</a>
        <a href="{p}hiring">Careers</a>
        <a href="{p}discovery">Contact</a>
        <a href="{p}faq">FAQs</a>
        <a href="{p}updates">Updates</a>
      </nav>
      <nav class="footer__col" aria-label="Get started">
        <h3>Get started</h3>
        <a href="{p}discovery">Book an audit</a>
      </nav>
      <nav class="footer__col" aria-label="Legal">
        <h3>Legal</h3>
        <a href="{p}terms">Terms</a>
        <a href="{p}privacy">Privacy</a>
        <a href="{p}dpa">DPA</a>
        <a href="{p}acceptable-use">Acceptable use</a>
        <a href="{p}cookies">Cookies</a>
      </nav>
    </div>
    <div class="footer__bar">
      <span>&copy; Capacity Digital Ltd 2026 &middot; Company No. 14487697</span>
      <span class="footer__legal">
        <a href="{p}cookies" data-consent-settings>Cookie settings</a>
        <a href="{p}security">Security</a>
      </span>
      <span>167-169 Great Portland Street, London W1W 5PF</span>
    </div>
  </div>
</footer>

<script src="{p}ascii.js" defer></script>
<script src="{p}site.js" defer></script>
<script src="{p}home-next.js" defer></script>
</body>
</html>
'''


def proof_card(p: str, key: str) -> str:
    d = PROOF[key]
    return f'''<a class="nx-proof" href="/#work" data-r>
      <img class="nx-proof__ph{' is-crop' if d['crop'] else ''}" src="{p}assets/{d['photo']}" alt="" loading="lazy" />
      <span class="nx-proof__shade" aria-hidden="true"></span>
      <img class="nx-proof__logo{' wide' if d['wide'] else ''}" src="{p}assets/clients/{d['logo']}" alt="{d['alt']}" loading="lazy" />
      <span class="nx-proof__txt"><b>{d['fig']}</b><span>{d['line']}</span></span>
      <span class="nx-proof__go">Results <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></span>
    </a>'''


def proof(p: str, key: str) -> str:
    return f'''<section class="band on-dark">
  <div class="wrap">
    {proof_card(p, key)}
  </div>
</section>
'''


def rival_tile(p: str, r: dict, cls: str = "") -> str:
    """The rival's mark on a white tile; a wordmark where no logo is published."""
    if r.get("logo"):
        return f'<span class="cmp-tile cmp-tile--them{cls}"><img src="{p}assets/brands/{r["logo"]}" alt="{r["name"]}" class="{"is-wide" if r.get("wide") else ""}" /></span>'
    return f'<span class="cmp-tile cmp-tile--them cmp-tile--word{cls}"><span>{r["name"]}</span></span>'


def us_tile(p: str, cls: str = "") -> str:
    return f'<span class="cmp-tile cmp-tile--us{cls}"><img src="{p}assets/capacity-logomark-white.png" alt="Capacity" /></span>'


def rival_page(r: dict) -> str:
    p = "../"
    rows = r.get("rows") or list(US_TICKETS.keys())
    us = r.get("us") or US_TICKETS
    path = f"compare/{r['slug']}"
    ld = [crumbs(("Home", f"{SITE}/"), ("Compare", f"{SITE}/compare"), (f"Capacity vs {r['name']}", f"{SITE}/{path}")), faq_ld(r["faq"])]
    tbl = "".join(f'<tr><th scope="row">{k}</th><td class="is-us" data-l="Capacity">{us[k]}</td><td class="is-them" data-l="{r["name"]}">{r["them"][k]}</td></tr>' for k in rows)
    pick_them = "".join(f"<li>{x}</li>" for x in r["pick_them"])
    pick_us = "".join(f"<li>{x}</li>" for x in r["pick_us"])
    src_name, src_url = r["source"]
    body = f'''<body class="nx" data-page="compare">
{SPRITE}
<div data-shell="nav"></div>

<section class="band on-dark pgh cmp-head">
  <div class="wrap cmp-head__grid">
    <div class="pgh__head">
      <nav class="cmp-crumb" aria-label="Breadcrumb" data-r><a href="{p}compare">Compare</a><i>/</i><span>{r['name']}</span></nav>
      <h1 class="cmp-h1" data-r="wipe" style="--rd:1">{r['name']} and Capacity. <span>{r['line']}</span></h1>
      <p class="lede" data-r style="--rd:2">{r['lede']}</p>
      <a class="btn btn--primary" href="{p}discovery" data-r style="--rd:3">Book an audit <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>
    </div>
    <div class="cmp-duo" data-r="rise" style="--rd:2" aria-hidden="true">{us_tile(p)}{rival_tile(p, r)}</div>
  </div>
</section>
{tick(p)}
<section class="band on-light cmp" id="side">
  <div class="wrap">
    <div class="head head--center">
      <h2 class="h2" data-r="wipe">Side by side.</h2>
    </div>
    <div class="cmp-tbl__wrap" data-r>
    <table class="cmp-tbl">
      <thead><tr><th scope="col"><span class="sr-only">Point</span></th><th scope="col"><span class="cmp-tbl__who">{us_tile(p, " cmp-tile--xs")}Capacity</span></th><th scope="col"><span class="cmp-tbl__who">{rival_tile(p, r, " cmp-tile--xs")}{r['name']}</span></th></tr></thead>
      <tbody>{tbl}</tbody>
    </table>
    </div>
    <p class="cmp-note" data-r>{r['name']} figures from {src_name}, checked {CHECKED}. Check there for current plans.</p>
  </div>
</section>
{proof(p, r['proof'])}
<section class="band on-dark cmp">
  <div class="wrap">
    <div class="head head--center">
      <h2 class="h2" data-r="wipe">Which one.</h2>
    </div>
    <div class="cmp-pick">
      <div class="cmp-pick__col" data-r style="--rd:0">{rival_tile(p, r, " cmp-tile--sm")}<h3>{r['name']} if</h3><ul>{pick_them}</ul></div>
      <div class="cmp-pick__col cmp-pick__col--us" data-r style="--rd:1">{us_tile(p, " cmp-tile--sm")}<h3>Capacity if</h3><ul>{pick_us}</ul></div>
    </div>
  </div>
</section>
{faq(r['faq'])}
{close(p, "It looks at how you sell today, then shows you your next event in your own name.")}
{footer(p)}'''
    return head(p, r["title"], r["desc"], path, ld) + body


HUB_FAQ = [
    ("Do we have to leave the ticketing we use?", "No. DICE, Skiddle, FIXR and Eventbrite all connect. When you are ready, your next event can sell through your own site instead."),
    ("Where do the figures come from?", "Each rival's own pricing page, help centre or terms, named under its table with the month it was checked."),
    ("What does Capacity charge?", "Pricing is agreed in the audit, around how your business runs."),
    ("Does our team run it, or yours?", "Either, or both. Capacity is set up around how you sell; you run it yourself, hand parts to our team, or let us run it."),
]


def hub_page() -> str:
    p = ""
    ld = [crumbs(("Home", f"{SITE}/"), ("Compare", f"{SITE}/compare")), faq_ld(HUB_FAQ)]

    def group(title, kinds):
        rs = [r for r in RIVALS if r["kind"] in kinds]
        cards = "".join(f'''      <a class="cmp-card" href="compare/{r['slug']}" data-r style="--rd:{i % 4}">{rival_tile(p, r, " cmp-tile--sm")}<span class="cmp-card__t"><b>Capacity vs {r['name']}</b><small>{r['tag']}</small></span><svg class="ic cmp-card__go" aria-hidden="true"><use href="#i-arrow-up-right"/></svg></a>
''' for i, r in enumerate(rs))
        return f'''<section class="band on-dark cmp-hub">
  <div class="wrap">
    <div class="head">
      <h2 class="h2" data-r="wipe">{title}</h2>
    </div>
    <div class="cmp-grid">
{cards}    </div>
  </div>
</section>
'''
    body = f'''<body class="nx" data-page="compare">
{SPRITE}
<div data-shell="nav"></div>

<section class="band on-dark pgh">
  <div class="wrap">
    <div class="pgh__head pgh__head--center">
      <p class="cr__eyebrow" data-r>Compare</p>
      <h1 class="h1" data-r="wipe" style="--rd:1">Capacity, side by side.</h1>
      <p class="lede" data-r style="--rd:2">Next to the tools promoters, events and venues already use, with each one&rsquo;s own published fees.</p>
    </div>
  </div>
</section>
{tick(p)}
{group("Ticketing.", ("tickets",))}
{group("Bookings and CRM.", ("bookings", "crm"))}
{faq(HUB_FAQ)}
{close(p, "It looks at how your business runs before anything is built, and pricing is set around it from there.")}
{footer(p)}'''
    return head(p, "Compare Capacity with DICE, Skiddle, Fatsoma, FIXR, Eventbrite and more | Capacity",
                "How Capacity compares with the ticketing, booking and CRM tools venues already use, with each rival's own published fees and terms.", "compare", ld) + body


def main():
    (ROOT / "compare").mkdir(exist_ok=True)
    (ROOT / "compare.html").write_text(hub_page())
    for r in RIVALS:
        (ROOT / "compare" / f"{r['slug']}.html").write_text(rival_page(r))
    print("compare.html +", len(RIVALS), "pages")


if __name__ == "__main__":
    main()
