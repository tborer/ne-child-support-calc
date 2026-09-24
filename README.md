# Nebraska Child Support Calculator

A static, browser-based calculator for estimating monthly child support obligations
under the Nebraska Child Support Guidelines and Neb. Rev. Stat. § 42-364.

Enter each parent's monthly gross income and deductions, the basic support amount
from Nebraska Table 1, health insurance premiums, and the parenting-time split; the
page computes net incomes, each parent's percentage contribution, the total
obligation, each parent's monthly share, and the final amount owed — using either a
**Joint Physical Custody** calculation or the **Basic Net Income Calculation
(Worksheet 1)**.

The application is entirely client-side: plain HTML, CSS, and jQuery with no
server. Nothing entered on the page is transmitted anywhere — all calculation
happens in the browser. A small dependency-free build script
(`scripts/build.js`) copies the public files into `dist/`, which is deployed as a
static site to Vercel (and, during the migration, to GitHub Pages).

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

- **Guidelines page** (`guidelines.html`) — a step-by-step walkthrough of how to
  fill in each section of the calculator.
- **Contextual help** — hoverable/focusable `?` icons with per-field explanations.
- **Reference links** — direct links to the official Nebraska Supreme Court
  Worksheet 1, Table 1, and Worksheet 3 PDFs.
- **Accessible, responsive layout** — semantic sections, ARIA labels, live regions
  for computed values, and a two-column layout with a tools sidebar.

### Testing and deployment

- **Playwright E2E suite** — 18 focused tests (runs in about 10 seconds):
  - `tests/calculation.spec.js` — one Joint Physical Custody case per code
    path (who pays insurance, which parent owes, 30%/70% time-split edges),
    a Worksheet 1 case, the running totals, and Table 1 lookups. Results are
    checked within a $1 rounding tolerance.
  - `tests/payment-gate.spec.js` — Finalize disabled when Stripe is off, an
    unpaid click redirecting to the Payment Link, and the return trip
    restoring the form and producing the correct result.
  - `tests/landing.spec.js` — landing-page call to action and structured data.

  Tests replace `js/config.js` with their own Stripe settings and never
  contact Stripe, so they pass whatever the deployed repository variables
  are. jQuery is served from `node_modules` (pinned to the same 3.6.0 as the
  page), so the suite doesn't depend on the CDN either.
- **Deployment** — Vercel builds and deploys from `vercel.json`; GitHub
  Actions still deploys the same `dist/` to GitHub Pages on push
  (`.github/workflows/deploy.yml`) until the migration is finished. A manually
  triggered test workflow (`.github/workflows/test.yml`) uploads the
  Playwright HTML report.

## Running locally

The page fetches the Table 1 CSV, so it must be served over HTTP rather than opened
from the filesystem. You can serve the repo directly:

```bash
python3 -m http.server 3000
# then open http://localhost:3000 (landing page)
# or http://localhost:3000/calculator.html (calculator)
```

or build and serve exactly what gets deployed:

```bash
node scripts/build.js
python3 -m http.server 3000 --directory dist
```

## Running the tests

```bash
npm install
npx playwright install chromium
npm test          # run the suite
npm run test:report   # open the HTML report
```

The Playwright config starts its own static server on port 3000, so no separate
server is needed.

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
vercel.json         Vercel build settings and security/cache headers
js/calculator.js    Calculation logic, validation, tools, print view
js/config.js        Runtime feature flags (Stripe) — local-dev defaults; replaced in dist/ by the build
data/ne-child-support-table-1.csv   Nebraska Table 1 support schedule
childsup_table.pdf  Source PDF the CSV was derived from
tests/              Playwright E2E specs
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
   `node scripts/build.js`, output directory `dist`.
2. Under **Settings → Environment Variables**, add:

   | Variable                  | Value                                                                  |
   |---------------------------|------------------------------------------------------------------------|
   | `SITE_URL`                | Public URL with trailing slash, e.g. `https://example.com/`. Optional once a production domain is set, because the build falls back to it. |
   | `ENABLE_STRIPE`           | `true` to turn on the payment gate (leave unset to keep it off).       |
   | `STRIPE_PAYMENT_LINK_URL` | The Stripe Payment Link URL.                                           |

   Environment variables only apply to new deployments, so redeploy after
   changing them.
3. **Settings → Domains**: add the custom domain and set the DNS records
   Vercel shows.
4. Update the Stripe Payment Link's after-payment redirect to
   `https://<domain>/calculator.html?session_id={CHECKOUT_SESSION_ID}`.
5. In Google Search Console, add the new domain (the existing verification
   meta tag works; a DNS TXT record also covers subdomains) and submit
   `https://<domain>/sitemap.xml`.

Every pull request gets its own Vercel preview URL. Preview deployments only
receive the environment variables scoped to **Preview**, so you can use a
Stripe test-mode Payment Link there and the live link in **Production**.

`vercel.json` also sends security headers on every response
(`Content-Security-Policy`, `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`) and caches `data/` for a day. The CSP
allows scripts only from the site itself and `code.jquery.com`; if you add a
third-party script (analytics, for example), add its origin there.

## Stripe payment gate

The "Finalize Calculation" button can be gated behind a Stripe payment. Because
this is a static site with no backend/server, this uses a **Stripe Payment
Link** (no secret key, no server code) and is a *soft* gate: it stops casual
use of the button without paying, but since all logic runs in the browser, a
technically sophisticated user could bypass it (e.g. via devtools). There is
no way to make this cryptographically enforceable without adding a backend
(e.g. a serverless function that verifies the Stripe session server-side) —
that's a bigger change and wasn't in scope here.

### How it works

1. If Stripe isn't enabled/configured, the "Finalize Calculation" button is
   **disabled** and a message explains why.
2. If Stripe is enabled and configured, clicking the button:
   - **First click (unpaid):** saves the current form values to
     `sessionStorage` and redirects the browser to the Stripe Payment Link.
   - **After a successful payment:** Stripe redirects back to the site with
     `?session_id={CHECKOUT_SESSION_ID}` in the URL (configured on the
     Payment Link itself, see below). The page detects that, marks the
     browser session as paid (`sessionStorage`, cleared when the tab/browser
     session ends), restores the saved form values, and strips the query
     string from the URL.
   - **Subsequent clicks in the same browser session:** run the calculation
     directly, without redirecting to Stripe again.

### One-time Stripe setup

1. In the [Stripe Dashboard](https://dashboard.stripe.com/), create a
   **Product** and **Price** for the calculation (e.g. a one-time fee).
2. Create a **Payment Link** for that price. Under the Payment Link's
   **After payment** settings, choose **"Redirect customers to your
   website"** and set the URL to:
   ```
   https://<your-site-domain>/calculator.html?session_id={CHECKOUT_SESSION_ID}
   ```
   (Stripe fills in `{CHECKOUT_SESSION_ID}` automatically — keep it exactly
   as shown.) Payment Links that still point at the site root keep working:
   the landing page forwards any `?session_id=` request to
   `calculator.html`.
3. Copy the Payment Link URL (e.g. `https://buy.stripe.com/xxxxxxxx`).

### Environment variables

These are read at **build time** by `scripts/build.js`, which writes
`dist/js/config.js` from them. On Vercel, set them in the project's
environment variables (see above). For the GitHub Pages deploy, set them
under the repo's **Settings → Secrets and variables → Actions →
Variables** tab:

| Variable                  | Description                                                              |
|----------------------------|---------------------------------------------------------------------------|
| `ENABLE_STRIPE`            | `true` to enable the Stripe gate, `false` (or unset) to keep it disabled. |
| `STRIPE_PAYMENT_LINK_URL`  | The Stripe Payment Link URL from setup step 3 above.                     |

Neither value is a secret credential (no Stripe API key is used anywhere in
this repo), so plain repository **variables** work — no need for encrypted
secrets. Until both are set (`ENABLE_STRIPE=true` and a non-empty
`STRIPE_PAYMENT_LINK_URL`), the Finalize Calculation button stays disabled
and the generated config keeps Stripe off.

## Reference material

- [Nebraska Worksheet 1](https://supremecourt.nebraska.gov/sites/default/files/worksheet1.pdf)
- [Nebraska Table 1](https://supremecourt.nebraska.gov/sites/default/files/childsup_table.pdf)
- [Nebraska Worksheet 3](https://supremecourt.nebraska.gov/sites/default/files/worksheet3.pdf)
- [Nebraska Supreme Court](https://supremecourt.nebraska.gov/)
