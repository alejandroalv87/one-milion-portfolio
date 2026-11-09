# Portfolio Dashboard (no login, Yahoo data)

A private, TIKR-style portfolio dashboard — **no login and no API key.** Import
your holdings from a Google Sheet or an Interactive Brokers positions export, see
live prices and gain/loss, and click any holding for live financials, next
earnings date, institutional ownership, and insider transactions.

Built with Next.js (App Router). Market data comes from **Yahoo Finance** via
server-side routes (so the browser never calls Yahoo directly).

## Nothing to configure

There is no key to manage. You can deploy as-is. The only optional setting is
`DATA_CACHE_TTL` (seconds to cache data server-side; default 60).

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

- **Portfolio** — holdings table with live prices and gain/loss, CSV/IBKR import.
- **Cash & Allocation** — enter your bank-account cash manually; see an
  Investment-vs-Cash donut, net worth, and a one-click "save this month" button.
- **History** — a manual monthly table (invested / value / cash) with an
  evolution chart (value vs invested, plus net worth), like a portfolio tracker.
- **Stock detail** — click any holding: financials, next earnings, ownership,
  insiders.

All manual figures (cash, snapshots, base currency) are stored in your browser
(localStorage), same as your holdings.

## Project layout

```
app/
  page.js                    Dashboard + holdings import
  allocation/page.js         Cash & Allocation (manual cash, donut)
  history/page.js            Monthly snapshots + evolution chart
  stock/[symbol]/page.js     Stock detail (overview/financials/ownership/insiders)
  api/data/*                 quote / profile / financials / earnings / ownership / insiders
lib/
  yahoo.js                   Yahoo Finance client (chart + quoteSummary/crumb) + cache
  holdings.js                CSV parsing, IBKR support, exchange→Yahoo symbol map
  portfolio-state.js         Manual cash accounts, base currency, monthly snapshots
  format.js                  Number/date formatting
components/AppShell.js       Sidebar + ticker search
```

## Possible add-ons

- **FX normalization** — convert every position to one base currency (e.g. USD)
  for correct totals, using Yahoo FX pairs.
- **A light shared-password gate** — if you don't want the URL fully open.
- Charts, dividends, or a watchlist.
