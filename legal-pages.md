Legal pages

# Sales Site — Legal Pages Brief (handoff)

> **For the agent building the Capacity SaaS marketing site.** Self-contained: everything needed is below,
> no need to read the rest of this folder.
>
> **Context.** Capacity is launching "Engage" — email, SMS and WhatsApp marketing that venues send to their
> own customer lists from inside our portal. That changes what the marketing site legally needs. Standard
> **Terms of Service** and **Privacy Policy** are already written; this brief covers **what is missing**
> and **what must change** in the two that exist.
>
> ## Rules that override everything else in this brief
>
> **1. Do not publish a factual claim that is not on the verified list in §5.** Data residency, security
> posture and sub-processors are the claims prospects check and regulators test. §5 lists what is confirmed,
> what is pending, and the specific sentences that must **not** be used. If a claim is not there, leave it
> out and flag it.
> **2. Avoid AI phrasing.** No em dashes, AI cliches or any other identifiable hallmarks. Use standard legal > text style

---

## 1. Why this is needed (one paragraph — it shapes the tone of every page)

When a venue uses Engage, **the venue is the data controller and Capacity is the data processor.** The
venue's customer list is the venue's data; we only process it on their instructions. This is not a
formality — it determines who is liable, and it is the reason a DPA and a sub-processor list stop being
optional. Venues *will* ask for these during procurement, and larger ones will not sign without them. The
pages below should read as **reassurance that we have done this properly**, not as small print.

---

## 2. New pages required

### 2.1 Data Processing Agreement (DPA) — 🔴 highest priority

The only genuinely blocking item. UK GDPR Article 28 requires a written contract between controller and
processor.

- **Publicly readable at a stable URL** (`/legal/dpa`). Do not gate it behind a form — procurement teams
  need to send it to their own lawyer, and a gate reads as evasion.
- **Versioned and dated**, e.g. `/legal/dpa` (current) plus `/legal/dpa/2026-09`. Superseded versions stay
  reachable forever: a customer must be able to read the version *they* accepted.
- Must display the **version identifier and effective date** prominently — the product records which
  version each venue accepted, and the two have to match.
- Content is **counsel-drafted**. Structural placeholders: subject matter and duration; nature and purpose;
  types of personal data and categories of data subjects; controller instructions; confidentiality;
  security measures; sub-processor terms (link to §2.2); data-subject rights assistance; breach
  notification; deletion/return on termination; audit rights; international transfers.

### 2.2 Sub-processor list

A short page listing every third party that touches customer data, what they do, and where.

- **Versioned, with an email subscribe option** for change notifications — the DPA will commit us to giving
  notice before adding a sub-processor, and that promise needs somewhere to land.
- Table columns: **Sub-processor · Purpose · Data location**.
- Populate **only** from the verified list in §5.

### 2.3 Acceptable Use / Anti-Spam Policy

Every serious messaging platform has one, and it does real work: it is the contractual basis on which we
**pause or terminate a venue** that imports a purchased list and threatens delivery for everyone else. The
product enforces this automatically; the policy is what makes enforcement legitimate rather than arbitrary.

Points it must cover (wording by counsel):
- The customer warrants it has a **lawful basis** for every contact it uploads, and that consent or soft
  opt-in was properly obtained.
- **Prohibited**: purchased, rented, scraped or harvested lists; sending to people who have opted out;
  false sender identity or misleading subject lines.
- Capacity may **suspend sending immediately** where bounce or complaint rates threaten platform
  deliverability, or where a lawful basis appears absent — **without notice**, because the damage is
  immediate and shared across every customer on the platform.
- The customer is responsible for the content of its messages.

### 2.4 Security & Data Residency page

Sales asset as much as a legal one; usually the second thing a procurement team asks for. Sections:
**where data is stored** (§5), **encryption in transit and at rest**, **access control**, **backups**,
**sub-processors** (link), **breach process**, **how to report a vulnerability**.

Keep it factual and modest. An overstated security page is a misrepresentation; a plain accurate one closes
deals perfectly well.

---

## 3. Changes to the pages that already exist

### 3.1 Privacy Policy — needs a "two roles" section

The current policy almost certainly describes Capacity as controller of its own users' data (venue staff
logins, site visitors). It now needs to distinguish clearly:

- **Where we are controller**: our own account holders, prospects, site visitors. The existing policy
  covers this.
- **Where we are processor**: the venue's customer lists processed through Engage. Here we act on the
  venue's instructions; **the venue's own privacy policy governs**, and a consumer with a question about
  their data should be pointed to the venue, with a route to us if the venue does not respond.

Missing that distinction is the single commonest mistake, and it makes us look like the controller of
99,000 people's data we do not control.

### 3.2 Terms of Service — three insertions

- Incorporate the **Acceptable Use Policy** by reference.
- Incorporate the **DPA** by reference, and state that using Engage constitutes acceptance of the current
  version.
- State that the **customer is the controller** of contact data it uploads, and Capacity the processor.

### 3.3 Cookie banner (the marketing site itself)

If the site runs any analytics, UK PECR requires **consent before non-essential cookies are set** — a real
banner with a genuine reject option, not a notice bar. Reject must be as easy as accept. It would be a poor
look for a compliance-conscious messaging platform to get its own cookie banner wrong, and it is the one
thing on this list a prospect can check in five seconds.

---

## 4. Optional, high value: "Messaging & the law" guide

Not legal boilerplate — a marketing asset in the help/resources section explaining UK PECR to venue
operators: consent vs soft opt-in, why a purchased list is a bad idea, what an unsubscribe must do. It
ranks well, it is genuinely useful to the audience, it differentiates us from competitors who avoid the
subject, and it reduces the number of customers who get themselves into trouble on our platform. Write it
as guidance, and include the line that it is not legal advice.

---

## 5. Verified facts — the only claims that may be published

**Confirmed:**

| Sub-processor | Purpose | Data location |
|---|---|---|
| **Supabase** | Application database | **London, UK** |
| **Vercel** | Application hosting | Confirm region before publishing |
| **Twilio SendGrid** | Marketing email delivery | **EU** (EU data residency is being purchased) |
| **Twilio** | SMS, and WhatsApp messaging | ⚠️ **Confirm** — see below |
| **Resend** | Transactional email (password resets, invites) | ⚠️ **Confirm** |
| **Stripe** | Payments | Per Stripe's own terms |

- **Capacity is the processor; the venue is the controller.** True and safe to state.
- **Twilio is a single sub-processor covering email, SMS and WhatsApp.** True, and worth saying — a short
  sub-processor list is a genuine selling point.

**🔴 Do not publish until confirmed:**
- The **data location for Twilio SMS/WhatsApp, Resend and Vercel**. Three of six rows are unverified; the
  page cannot go live until they are.
- Any **security certification** (ISO 27001, SOC 2, Cyber Essentials). We hold none unless someone confirms
  otherwise. Do not imply certification through phrasing like "enterprise-grade security standards".

**🔴 Sentences that must never appear:**
- ❌ *"Your customers' data never leaves the UK."* **Not true.** The database is in London, but marketing
  email is processed in the **EU**.
- ✅ Use instead: **"Your data is stored in the UK and the EU, and never leaves them."** This is accurate
  once §5 is confirmed, and it is legally clean — the UK has adequacy regulations covering the EEA, so
  UK→EU data flow needs no extra safeguards. It is also a stronger claim than most competitors can make.
- ❌ Any claim that we **guarantee** a customer's GDPR or PECR compliance. We provide tools; the venue is
  responsible for its own lawful basis. Getting this wrong transfers their liability to us in one sentence.

---

## 6. Priority

1. **DPA + sub-processor list** — blocks enterprise sales and is the legal structure behind the product.
2. **Acceptable Use Policy** — must exist before the first customer sends, because it is what lets us stop
   a bad send.
3. **Privacy Policy "two roles" section** + ToS insertions.
4. **Security & residency page**.
5. Cookie banner (immediate if analytics are already live).
6. "Messaging & the law" guide.

**Counsel is on the critical path for 1–3.** Build the pages, structure and versioning now with marked
placeholders so that legal copy drops in without a rebuild.
