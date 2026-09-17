# Nebraska Child Support Calculator

A static, browser-based calculator for estimating monthly child support obligations
under the Nebraska Child Support Guidelines and Neb. Rev. Stat. § 42-364.

Enter each parent's monthly gross income and deductions, the basic support amount
from Nebraska Table 1, health insurance premiums, and the parenting-time split; the
page computes net incomes, each parent's percentage contribution, the total
obligation, each parent's monthly share, and the final amount owed — using either a
**Joint Physical Custody** calculation or the **Basic Net Income Calculation
(Worksheet 1)**.

The application is entirely client-side: plain HTML, CSS, and jQuery with no build
step and no server. Nothing entered on the page is transmitted anywhere — all
calculation happens in the browser. It is deployed as a static site to GitHub Pages.

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

- **Playwright E2E suite** — 139 Joint Physical Custody test cases
  (`tests/calculation.spec.js`) asserting each parent's final obligation within a
  $1 rounding tolerance, run against a local static server.
- **GitHub Actions** — automatic GitHub Pages deployment on push
  (`.github/workflows/deploy.yml`) and a manually triggered test workflow
  (`.github/workflows/test.yml`) that uploads the Playwright HTML report.

## Running locally

The page fetches the Table 1 CSV, so it must be served over HTTP rather than opened
from the filesystem:

```bash
python3 -m http.server 3000
# then open http://localhost:3000
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
index.html          Calculator page
guidelines.html     Step-by-step usage guide
css/styles.css      Site styling
js/calculator.js    Calculation logic, validation, tools, print view
data/ne-child-support-table-1.csv   Nebraska Table 1 support schedule
childsup_table.pdf  Source PDF the CSV was derived from
tests/              Playwright E2E specs
```

## Reference material

- [Nebraska Worksheet 1](https://supremecourt.nebraska.gov/sites/default/files/worksheet1.pdf)
- [Nebraska Table 1](https://supremecourt.nebraska.gov/sites/default/files/childsup_table.pdf)
- [Nebraska Worksheet 3](https://supremecourt.nebraska.gov/sites/default/files/worksheet3.pdf)
- [Nebraska Supreme Court](https://supremecourt.nebraska.gov/)
