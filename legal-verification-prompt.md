# Verification request: data locations and security facts

Give this to an agent (or person) with access to the Capacity production
accounts: Vercel, Supabase, Twilio, Twilio SendGrid, Resend, Stripe, and the
Google Workspace / GitHub admin.

Everything below is going onto a public trust page that prospects' procurement
teams and their lawyers will read. **Do not guess and do not infer from
documentation about what the product is capable of.** Report what the account is
actually configured to do today, and say "unknown" where you cannot verify it
from the console, the API, or a written statement from the vendor. An unverified
answer is worse than a blank.

For each item give: the answer, where you checked (console path, API call, doc
URL or support ticket), and the date you checked.

---

## A. Data locations

1. **Vercel.** Which region is the production deployment served and functions
   executed from? Check Project Settings → Functions → Function Region, and any
   Edge Config / Edge Middleware. If the project uses ISR, Data Cache or Blob
   storage, state the region for each separately. Is the account on a plan that
   pins region, or could it fail over elsewhere? Report the region code and its
   city (e.g. `lhr1`, London).

2. **Twilio (SMS and WhatsApp).** Which Twilio Region is the account configured
   in, `us1` (US) or `ie1` (Ireland)? Check Console → Account → General Settings,
   and the base URL your API calls use. Separately: message bodies and
   delivery logs may be retained in a different place from the account region,
   so confirm where **message content** is stored and for how long. If Twilio
   Regional Data Residency is not enabled, say so plainly. For WhatsApp,
   confirm which entity is the Business Solution Provider and where the WhatsApp
   Business Account sits.

3. **Twilio SendGrid.** Confirm whether the **EU data residency** add-on has
   actually been purchased and is switched on for the production account, or is
   still only planned. If it is on, confirm the sending subusers are on the EU
   region, not just the parent account. State the date it took effect.

4. **Resend.** Which region is the account provisioned in? Check the dashboard
   and, if it is not stated there, get it in writing from Resend support. Also
   confirm how long Resend retains email content and logs.

5. **Supabase.** Confirm the production project region is London (`eu-west-2`),
   and confirm where **backups** are stored, which is not always the same region
   as the primary. Check whether Point-in-Time Recovery is enabled and where
   those snapshots live.

6. **Stripe.** Confirm whether Capacity is the merchant of record or the venue
   is, and which Stripe entity the account contracts with (Stripe Payments UK
   Ltd or Stripe Technology Europe Ltd). This determines what we can say about
   payment data.

7. **Any others.** List every other third party that touches customer personal
   data in production and is not named above: error tracking, logging, analytics,
   support desk, CRM, AI/LLM providers, file storage, calendar, anything with an
   API key in the production environment. For each: vendor, what it is used for,
   what personal data it sees, and its data location. Check the environment
   variables in Vercel and the installed integrations in Supabase to catch the
   ones nobody remembers.

8. **Support access from outside the UK and EEA.** For each vendor above, can
   its support or engineering staff access our data from outside the UK/EEA, and
   under what safeguard (UK IDTA, UK Addendum to the EU SCCs, or the vendor's own
   DPA)? Get the URL of each vendor's DPA and sub-processor page.

---

## B. Security facts

Answer yes, no, or unknown. Do not answer yes to something that is merely the
vendor default unless you have confirmed it is switched on for our account.

1. **Encryption at rest.** Is the Supabase database encrypted at rest, and are
   backups encrypted at rest? Is anything stored outside the database, for
   example uploaded files or exports, and is that encrypted too?

2. **Encryption in transit.** Is TLS enforced everywhere, including any direct
   database connections and any webhook endpoints? Is HSTS set on the production
   domains? Are there any HTTP endpoints still reachable?

3. **Staff MFA.** Is MFA enforced (not merely available) on: Google Workspace,
   GitHub, Vercel, Supabase, Twilio, SendGrid, Resend and Stripe? Name any where
   it is not enforced.

4. **Least privilege.** How many people have production database access today,
   and who? Is access granted by role? Is there a documented offboarding step
   that removes access, and has it actually been followed for anyone who has
   left? Is Supabase Row Level Security enabled on every table holding customer
   data, and are there tables where it is off?

5. **Backups.** How often do backups run, what is the retention period in days,
   and where are they stored? Has a restore ever been tested, and when? Answer
   "never tested" if that is the truth.

6. **Logging and monitoring.** Is there an audit log of staff access to customer
   data? How long are application and access logs kept, and where?

7. **Certifications.** Confirm that Capacity holds **no** security certification
   today: no ISO 27001, no SOC 2, no Cyber Essentials, no Cyber Essentials Plus.
   If any is held or formally in progress, give the certificate number or the
   assessor and the expected date. If none, say "none held, none in progress".

8. **Penetration testing and vulnerability management.** Has any external
   penetration test been done, and when? Is dependency scanning (Dependabot or
   similar) switched on? Is there a process for applying security patches?

9. **Vulnerability reports.** Is there a mailbox that currently receives and is
   monitored for security reports? We intend to publish `legal@wearecapacity.co`
   unless told otherwise.

10. **Breach process.** Is there a written incident response process, even a
    short one? Who is on call? We have to state that we notify customers without
    undue delay, so confirm someone would actually see an alert.

---

## C. Registrations

1. **ICO data protection fee.** Ben's position is that Capacity is a processor
   and will not be paying. Note for the record that the fee is triggered by
   *controller* activity, which Capacity has (staff, prospects, account holders,
   billing, site visitors), and that the exemptions in the 2018 Regulations
   cover only staff administration, a business's own marketing, and accounts
   and records. Non-payment is a civil penalty of up to £4,350, not a criminal
   offence, and the ICO publishes the names of non-payers. No action needed
   unless he changes his mind.

2. **Data protection contact.** Is anyone formally named as the data protection
   contact or DPO? A DPO is probably not mandatory, but a named contact has to
   go on the privacy policy.

3. **Engage launch date.** What date does Engage go live, or first send on behalf
   of a customer? This sets the effective date on the DPA and the acceptable use
   policy.

---

## D. Analytics

The marketing site currently sets no cookies and loads no analytics. We are
told analytics is coming.

1. Which tool, and on what date?
2. Does it set cookies, and does it collect IP addresses or any other personal
   data?
3. Where does that vendor store the data?
4. Will it run on the marketing site, the app, or both?
