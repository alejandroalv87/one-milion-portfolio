# Portfolio Dashboard (no login, Yahoo data)

A private, TIKR-style portfolio dashboard — **no login and no API key.** Import
your holdings from a Google Sheet or an Interactive Brokers positions export, see
live prices and gain/loss, and click any holding for live financials, next
earnings date, institutional ownership, and insider transactions.

Built with Next.js (App Router). Market data comes from **Yahoo Finance** via
server-side routes (so the browser never calls Yahoo directly).

## Configuration

No market-data key is needed. Settings (all optional) go in `.env.local` or your
host's environment:

- `DATA_CACHE_TTL` — seconds to cache data server-side (default 60).
- **Access gate (optional).** Leave off and the site is fully open. To require a
  single shared password before anyone can view it, set **both**:
  - `SITE_PASSWORD` — the password you share with whoever may access it.
  - `AUTH_SECRET` — a long random string that signs the login cookie
    (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).
  With both set, visitors hit a password screen; a "Log out" item appears in the
  sidebar. On Netlify, set these as environment variables and redeploy.

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
```

Open it, click **Import holdings**, and paste or upload your CSV.

## Deploy (Netlify)

1. Push this folder to a Git repo (or drag-drop in Netlify).
2. **Important — base directory:** if your repo has the app inside a subfolder,
   set **Site configuration → Build & deploy → Base directory** to that folder.
   If the app files (`app/`, `package.json`) are at the repo root, leave it blank.
3. Deploy. The Next.js plugin is auto-detected. No environment variables needed.

Also works on Vercel, any Node host (`npm run build && npm run start`), or Docker
(`Dockerfile` included).

## Importing holdings

Two formats are recognized automatically:

1. **Simple sheet** — a `Symbol`/`Ticker` column, plus optional `Shares` and
   `Cost` (per-share average). Example in `holdings.sample.csv`.
2. **Interactive Brokers "Portfolio Positions" export** — the importer reads the
   `Instrument`, `Position`, `Avg Price`, `Exchange` and `Section` columns,
   **skips** TOTAL rows, Cash, options, combos and closed (zero-share) positions,
   and **maps local tickers to Yahoo symbols** using the exchange:

   | IBKR exchange | Yahoo suffix | Example |
   |---|---|---|
   | SEHK | `.HK` (4-digit) | 3918 → 3918.HK |
   | ASX | `.AX` | FDR → FDR.AX |
   | TSE (Toronto) | `.TO` | TNZ → TNZ.TO |
   | VENTURE (TSXV) | `.V` | AUEN → AUEN.V |
   | LSE | `.L` | JSE → JSE.L |
   | SWB / STU | `.SG` | 8YG → 8YG.SG |
   | (blank / US) | none | GLNG, VFF |

   A few niche listings may not resolve on Yahoo; those rows import but show "–"
   for price. The map lives in `lib/holdings.js` (`EXCHANGE_SUFFIX`) if you need
   to add one.

Prices and values are shown in each holding's **local currency**. The summary
tiles are a raw sum, so they're only accurate if your positions share a currency.
(FX normalization to one base currency is a small add-on — see below.)

## Data notes (Yahoo)

- **Quotes** (price, day change, 52-week range, currency) use Yahoo's public
  chart endpoint — reliable, no auth.
- **Next earnings, ownership, insiders, financials, market cap / P/E** use
  Yahoo's `quoteSummary`, which requires a cookie + "crumb" that the server
  fetches automatically. Yahoo sometimes rate-limits this from datacenter IPs; if
  so, those panels show "not available" while quotes keep working. Raising
  `DATA_CACHE_TTL` reduces how often the crumb is needed.

## Tabs

- **Portfolio** — holdings table with live prices and gain/loss, sortable columns
  (default by weight), FX-normalized to a base currency, CSV/IBKR import.
- **Cash & Allocation** — enter your bank-account cash manually; see an
  Investment-vs-Cash donut, net worth, and a one-click "save this month" button.
- **Investment progress** — a monthly table (invested / value / added / dividend),
  pre-seeded with your real history, with an evolution chart (value vs invested)
  and KPIs (gain, money-weighted XIRR, dividends, max drawdown). Add a row as each
  month ends.
- **Stock detail** — click any holding: financials, next earnings, ownership,
  insiders.

All manual figures (cash, snapshots, base currency) are stored in your browser
(localStorage), same as your holdings.

## Project layout

```
app/
  page.js                      Dashboard + holdings import (sortable, FX-normalized)
  allocation/page.js           Cash & Allocation (manual cash, donut)
  investment-progress/page.js  Monthly snapshots + evolution chart + KPIs
  stock/[symbol]/page.js       Stock detail (overview/financials/ownership/insiders)
  login/page.js                Password screen (only used when the gate is on)
  api/data/*                   quote / profile / financials / earnings / ownership / insiders / fx
  api/auth/*                   login / logout / status (shared-password gate)
lib/
  yahoo.js                     Yahoo Finance client (chart + quoteSummary/crumb) + cache
  holdings.js                  CSV parsing, IBKR support, exchange→Yahoo symbol map
  normalize.js                 Pence (GBp) handling + cost reconciliation
  portfolio-state.js           Cash accounts, currencies, monthly snapshots
  history-seed.js              Your real monthly history (seeds Investment progress)
  session.js                   Edge-safe session for the optional password gate
  format.js                    Number/date formatting
middleware.js                  Enforces the password gate when configured
components/AppShell.js         Sidebar + ticker search + logout
```

## Possible add-ons

- **FX normalization** — convert every position to one base currency (e.g. USD)
  for correct totals, using Yahoo FX pairs.
- **A light shared-password gate** — if you don't want the URL fully open.
- Charts, dividends, or a watchlist.
