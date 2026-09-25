# Nebraska Child Support Calculator

A web calculator for estimating monthly child support obligations
under the Nebraska Child Support Guidelines and Neb. Rev. Stat. § 42-364.

Enter each parent's monthly gross income and deductions, the basic support amount
from Nebraska Table 1, health insurance premiums, and the parenting-time split; the
page computes net incomes, each parent's percentage contribution, the total
obligation, each parent's monthly share, and the final amount owed — using either a
**Joint Physical Custody** calculation or the **Basic Net Income Calculation
(Worksheet 1)**.

The pages are plain HTML, CSS, and jQuery. Running totals are computed in the
browser as the form is filled in. The final result is a paid, per-calculation
step: two small Vercel serverless functions (`api/`) take payment through Stripe
Checkout and compute the result only after the payment is verified. Inputs are
never stored. `scripts/build.js` copies the public files into `dist/` for
deployment.

> **Disclaimer:** This tool is for informational use only and does not constitute
> legal advice. Results are estimates; consult an attorney and the official
> Nebraska Supreme Court worksheets for any real case.

## Features

### Calculation

- **Two calculation modes** — Joint Physical Custody (JPC) and Basic Net Income
  Calculation (Worksheet 1), selected before finalizing.
- **Net income computation** — monthly gross income minus total deductions, per
  parent, recalculated automatically as fields lose focus.
- **Combined income totals** — combined monthly and combined annual net income.
- **Percentage contribution** — each parent's share of combined net income.
- **Total obligation and monthly shares** — the Table 1 amount plus health
  insurance/cash medical support, apportioned by each parent's percentage.
- **Health insurance and cash medical support** — premiums paid are added to the
  obligation and credited back to the paying parent; in JPC mode the premium is
  shared by percentage and netted against the support owed.
- **Parenting-time weighting** — JPC applies the 1.5 multiplier to the Table 1
  amount and weights each parent's obligation by the other parent's share of
  overnights.
- **Final result** — the amount each parent owes, displayed per parent.

### Built-in tools

- **Table 1 Calculator** — looks up the Nebraska Schedule of Basic Support
  Obligations from the bundled CSV (`data/ne-child-support-table-1.csv`, 391 rows
  covering $500–$20,000 of combined monthly net income in $50 increments, for 1–6
  children). Income is rounded to the nearest $50 row; values below the table floor
  return the minimum and values above the ceiling return the maximum.
- **Deduction Calculator** — a collapsible sidebar accordion that totals taxes,
  FICA, retirement, previously ordered child support, regular support for other
  children, health insurance for the parent, child tax credits, and other
  deductions.
- **Printable worksheet** — opens a formatted summary table in a new tab covering
  case name, incomes, deductions, net and combined incomes, percentage
  contributions, the Table 1 amount, insurance, total obligation, monthly shares,
  and results.
- **Case name field** — label a calculation with a party name or case number, which
  carries through to the printout.

### Validation and warnings

Browser alerts and on-page messages flag the conditions the guidelines care about:

- Parenting-time percentages that do not total 100%.
- JPC selected with a time split outside the 30%–70% range for either parent.
- A parent's paid health insurance exceeding 3% of their gross income.
- A parent's obligation plus paid insurance exceeding the poverty guideline
  ($1,255).
- A parent's net income falling below the poverty guideline.
- Finalizing without choosing a calculation type.

### Interface

- **Help form** — a **Help** item in the navigation (after Guidelines) on
  every page opens a message form. Messages are emailed through SMTP by
  `POST /api/help` (see [Help form email](#help-form-email)).
- **Guidelines page** (`guidelines.html`) — a step-by-step walkthrough of how to
  fill in each section of the calculator.
- **Contextual help** — hoverable/focusable `?` icons with per-field explanations.
- **Reference links** — direct links to the official Nebraska Supreme Court
  Worksheet 1, Table 1, and Worksheet 3 PDFs.
- **Accessible, responsive layout** — semantic sections, ARIA labels, live regions
  for computed values, and a two-column layout with a tools sidebar.

### Testing and deployment

- **Unit tests** (`tests/unit/`, Node's built-in test runner, under a second):
  - `calc.test.js` — the server-side formulas: one Joint Physical Custody
    case per code path (who pays insurance, which parent owes, 30%/70%
    time-split edges), Worksheet 1, and input validation. Results are
    checked within a $1 rounding tolerance.
  - `payments.test.js` — the checkout and verification handlers with a stub
    Stripe client: unpaid, paid, forged, other-app and changed-input cases.
- **Playwright E2E tests** (`tests/*.spec.js`, about 10 seconds):
  - `calculation.spec.js` — running totals and Table 1 lookups.
  - `payment.spec.js` — the whole paid flow in a browser against the real
    `/api` handlers and an in-memory fake Stripe: pay → result, cancel,
    forged session id, same inputs free again, changed inputs charged again.
  - `landing.spec.js` — landing-page call to action and structured data.

  The tests never contact Stripe or the jQuery CDN (jQuery is served from
  `node_modules`, pinned to the page's 3.6.0).
- **Deployment** — Vercel builds and deploys from `vercel.json`: every
  push gets a preview, and `main` goes to production. The old GitHub Pages
  workflow (`.github/workflows/deploy.yml`) now only runs when started
  manually, with payments turned off because Pages can't run the `/api`
  functions. A manually triggered test workflow
  (`.github/workflows/test.yml`) uploads the Playwright HTML report.

## Running locally

```bash
npm install
npm run dev
# http://localhost:3000 (landing page), /calculator.html (calculator)
```

`npm run dev` (`scripts/dev-server.js`) serves the site and the `/api`
functions the way Vercel does, with payments turned on. With no Stripe keys it
uses an in-memory fake Stripe with its own Pay/Cancel page, so you can try the
whole flow offline. To use your real Stripe **test** account instead:

```bash
STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_ID=price_... PRICE_LABEL='$9.99' npm run dev
```

and pay with Stripe's test card `4242 4242 4242 4242` (any future expiry, any CVC).

To check the exact files that get deployed: `npm run build` writes them to `dist/`.

## Running the tests

```bash
npm install
npx playwright install chromium
npm test              # unit tests, then Playwright
npm run test:unit     # unit tests only
npm run test:report   # open the Playwright HTML report
```

Playwright starts `scripts/dev-server.js` (with the fake Stripe) on port 3000
itself, so no separate server is needed.

## Project structure

```
index.html          Landing page (SEO entry point; links into the calculator)
calculator.html     Calculator page
guidelines.html     Step-by-step usage guide
css/styles.css      Site styling
css/landing.css     Landing-page styling
robots.txt          Crawler rules + sitemap location
sitemap.xml         Sitemap for search engines
scripts/build.js    Builds dist/: copies site files, sets SITE_URL, writes js/config.js
scripts/dev-server.js  Local server for the site + /api (fake or real Stripe)
vercel.json         Vercel build settings and security/cache headers
api/checkout.js     POST /api/checkout — starts a Stripe Checkout for one calculation
api/calculate.js    POST /api/calculate — verifies payment, returns the result
api/help.js         POST /api/help — emails a help request via SMTP
lib/help.js         Help-request validation + SMTP sending (nodemailer)
lib/http.js         JSON response helpers shared by the /api handlers
js/help.js          Help link + modal (all pages)
lib/calc.js         Final Worksheet 1 / Joint Physical Custody formulas (server-side)
lib/payments.js     Checkout + verification handlers
js/calculator.js    Running totals, payment flow, validation, tools, print view
js/config.js        Page flags (ENABLE_STRIPE, PRICE_LABEL) — local defaults; replaced in dist/ by the build
data/ne-child-support-table-1.csv   Nebraska Table 1 support schedule
childsup_table.pdf  Source PDF the CSV was derived from
tests/              Playwright E2E specs, unit tests, fake Stripe
```

## Landing page and SEO

The site root (`index.html`) is a landing page built to rank for searches such
as "Nebraska child support calculator" and send visitors to `calculator.html`.
It includes:

- A keyword-focused `<title>`, meta description, canonical URL, and Open
  Graph/Twitter tags.
- JSON-LD structured data: `WebSite`, `WebApplication`, and a `FAQPage` whose
  questions match the visible FAQ section.
- Content that answers common search questions: how Nebraska child support is
  calculated, Worksheet 1 vs. Joint Physical Custody, allowed deductions,
  health insurance, and a worked example drawn from Table 1.
- Several calls to action pointing to the calculator, including a sticky
  button on mobile that shows once the hero scrolls out of view.
- No jQuery or other third-party scripts, so the page loads fast.

**Site URL.** The source files use `https://tborer.github.io/ne-child-support-calc/`
for canonical URLs, `og:url`, the JSON-LD, `robots.txt`, and `sitemap.xml`.
`scripts/build.js` rewrites that prefix to `SITE_URL` when it's set (on Vercel it
defaults to the project's production domain), so the source files never need
to change when the domain does.

## Google Search Console

`index.html` includes a `google-site-verification` meta tag to verify site
ownership in Google Search Console. It only needs to live on one page (the
one Search Console fetches at the domain root).

## Deploying to Vercel

1. In Vercel, **Add New → Project** and import this GitHub repository.
   `vercel.json` sets everything: no framework, build command
   `node scripts/build.js`, output directory `dist`. The `api/` functions are
   picked up automatically.
2. Set the environment variables below (**Settings → Environment
   Variables**) and redeploy — changes only apply to new deployments.
3. **Settings → Domains**: add the custom domain and set the DNS records
   Vercel shows.
4. In Google Search Console, add the new domain (the existing verification
   meta tag works; a DNS TXT record also covers subdomains) and submit
   `https://<domain>/sitemap.xml`.

`vercel.json` also sends security headers on every response
(`Content-Security-Policy`, `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`) and caches `data/` for a day. The CSP
allows scripts only from the site itself and `code.jquery.com`; if you add a
third-party script (analytics, for example), add its origin there.

## Stripe payments

Finalizing a calculation costs a one-time fee. There is no subscription and
no account.

### How it works

1. The visitor fills in the form. Running totals (net incomes, percentages,
   Table 1, monthly shares) are free and computed in the browser.
2. **Finalize Calculation** sends the inputs to `POST /api/checkout`. The
   function validates them and creates a Stripe Checkout Session (mode
   `payment`, one unit of `STRIPE_PRICE_ID`). The session's metadata holds
   `app: ne-child-support-calc` and a SHA-256 hash of the inputs; the numbers
   themselves are not sent to Stripe. The browser keeps a copy of the form in
   `sessionStorage` and goes to Stripe's hosted checkout page.
3. After payment Stripe returns to `/calculator.html?session_id=cs_...`. The
   page restores the form and calls `POST /api/calculate` with the session id
   and inputs.
4. `/api/calculate` retrieves the session from Stripe with the secret key and
   returns the result only if the session is complete and paid, belongs to
   this app, and the inputs hash to the stored value. The formulas are in
   `lib/calc.js`, so the result can't be produced without that check.
5. If checkout is canceled, Stripe returns to
   `/calculator.html?checkout=canceled` and the form is restored with no charge.

One payment covers one set of numbers. Asking again with the same numbers
(a refresh, printing) doesn't charge again; changing any number starts a new
checkout.

Nothing is stored server-side: no database, and the functions don't log
inputs. The paid session in Stripe is the record of each purchase.

### One-time Stripe setup

1. In the [Stripe Dashboard](https://dashboard.stripe.com/), create a
   **Product** (e.g. "Nebraska child support calculation") with a
   **one-time** Price. Copy the Price ID (`price_...`).
2. Copy your **Secret key** from **Developers → API keys** (`sk_live_...`, or
   `sk_test_...` in test mode). A
   [restricted key](https://docs.stripe.com/keys#limit-access) with
   **Checkout Sessions: Write** is enough and safer than the full secret key.
3. Do the same in **test mode** (toggle in the Dashboard) to get a test Price
   ID and test key for preview deployments. Test-mode and live-mode Prices are
   separate objects with different IDs.

No webhook or Payment Link is needed; the redirect URLs are set in code.

### Promotion codes

Checkout shows an **Add promotion code** field (`allow_promotion_codes:
true` in `lib/payments.js`). To create codes: in the Stripe Dashboard go to
**Product catalog → Coupons**, create a coupon (percent or amount off, and
optionally limit it to this product), then add a customer-facing
**promotion code** to it (e.g. `LAUNCH20`). Coupons and codes exist separately
in test and live mode, so create them in each. A 100%-off code works: the
session completes with `no_payment_required` and the result is released as
if paid.

### Environment variables

| Variable            | Used by | Required | Value |
|---------------------|---------|----------|-------|
| `STRIPE_SECRET_KEY` | `/api` at runtime | Yes | Stripe secret or restricted key. `sk_live_…`/`rk_live_…` in Production, `sk_test_…`/`rk_test_…` in Preview. **Mark it Sensitive.** |
| `STRIPE_PRICE_ID`   | `/api` at runtime | Yes | The one-time Price ID (`price_…`) from the same Stripe mode as the key. |
| `ENABLE_STRIPE`     | build (page) | Yes | `true` enables the Finalize button. Without it the button is disabled with a "not yet enabled" note. |
| `SITE_URL`          | build + `/api` | Recommended | Production URL with trailing slash, e.g. `https://example.com/`. Used for canonical/sitemap URLs and Stripe's return URLs. Falls back to Vercel's production domain. Preview deployments always return to their own preview URL. |
| `PRICE_LABEL`       | build (page) | Optional | Price shown next to Finalize, e.g. `$9.99`. Keep it in sync with the Stripe Price. |

`VERCEL_ENV`, `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are set by
Vercel automatically (keep **Automatically expose System Environment
Variables** on).

### Troubleshooting "Could not start checkout"

The message ends with Stripe's error code, e.g. `(Stripe: resource_missing)`,
and the full Stripe message is in Vercel's function logs (**Deployment →
Functions / Logs**, `api/checkout`). Common causes:

| Code | Meaning |
|------|---------|
| `resource_missing` | `STRIPE_PRICE_ID` doesn't exist in the key's mode — e.g. a live Price with a test key. |
| `StripeAuthenticationError` | `STRIPE_SECRET_KEY` is wrong, revoked, or has stray spaces. |
| `StripePermissionError` | A restricted key without **Checkout Sessions: Write**. |
| `parameter_invalid_*` / `url_invalid` | Usually a bad `SITE_URL` (it must start with `https://`). |

Environment variable changes only apply after a **redeploy**.

### Possible later additions

- **A few recalculations per payment.** This needs somewhere to count uses:
  for example, record each paid input hash in the PaymentIntent's metadata,
  or in a small key-value store (e.g. Upstash Redis via the Vercel
  Marketplace), and allow up to N distinct hashes per session in
  `lib/payments.js`.
- **Refunds.** A refunded session still verifies as paid. Checking
  `payment_intent` refund status, or a `charge.refunded` webhook, would close
  that.

## Help form email

`POST /api/help` sends each help message as a plain-text email using
[nodemailer](https://nodemailer.com/). The visitor's email, if they give
one, is set as **Reply-To**, so you can reply directly. The form has a
hidden honeypot field to drop simple bots.

| Variable      | Required | Value |
|---------------|----------|-------|
| `SMTP_HOST`   | Yes | Mail server host, e.g. `smtp.gmail.com`, `smtp.office365.com`, `smtp.sendgrid.net`. |
| `SMTP_PORT`   | Yes | `465` (implicit TLS) or `587` (STARTTLS). |
| `SMTP_SECURE` | Yes | `true` with port 465, `false` with port 587. |
| `SMTP_USER`   | Usually | SMTP login (often the full email address; `apikey` for SendGrid). |
| `SMTP_PASS`   | Usually | SMTP password or app password. **Mark it Sensitive.** |
| `SMTP_FROM`   | Yes | Sender address the server is allowed to send as, e.g. `Calculator <help@yourdomain.com>`. Messages are also delivered here. |
| `HELP_TO`     | Optional | Deliver help messages to a different address than `SMTP_FROM`. |

These are read at runtime, so set them for both Production and Preview and
redeploy. Gmail and Microsoft 365 need an app password rather than your
normal password. Without `SMTP_HOST` and `SMTP_FROM` the form answers "not set
up yet".

## Reference material

- [Nebraska Worksheet 1](https://supremecourt.nebraska.gov/sites/default/files/worksheet1.pdf)
- [Nebraska Table 1](https://supremecourt.nebraska.gov/sites/default/files/childsup_table.pdf)
- [Nebraska Worksheet 3](https://supremecourt.nebraska.gov/sites/default/files/worksheet3.pdf)
- [Nebraska Supreme Court](https://supremecourt.nebraska.gov/)
