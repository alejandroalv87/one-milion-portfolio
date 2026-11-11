// Holdings parsing + persistence (client-side).
//
// Understands two shapes:
//  1. A simple sheet:  Symbol, Shares, Cost
//  2. An Interactive Brokers "Portfolio Positions" export:
//     Section, Instrument, Exchange, Sector, Daily P&L, Unrealized P&L,
//     Position, Market Value, Avg Price
//
// For the IBKR export it keeps only real stock positions (skips TOTAL rows,
// Cash, Options, Combos and closed/zero positions) and maps each local ticker
// to its Yahoo symbol using the Exchange column (e.g. 3918 + SEHK -> 3918.HK).

const SYMBOL_KEYS = ["symbol", "ticker", "tickers", "instrument", "stock", "security", "code"];
const SHARES_KEYS = ["position", "shares", "qty", "quantity", "units", "# shares", "shares held"];
const COST_KEYS = [
  "avg price", "average price", "avg cost", "average cost", "cost basis", "cost",
  "buy price", "cost/share", "cost per share", "unit cost", "price",
];
const NAME_KEYS = ["name", "company", "company name", "description"];
const EXCHANGE_KEYS = ["exchange", "listing exchange", "primary exchange", "venue"];
const SECTION_KEYS = ["section", "asset class", "category", "type"];

// Interactive Brokers exchange code -> Yahoo Finance suffix.
const EXCHANGE_SUFFIX = {
  SEHK: ".HK", HKEX: ".HK", HKG: ".HK",
  ASX: ".AX",
  TSE: ".TO", TSX: ".TO", TOR: ".TO", // IBKR "TSE" = Toronto
  VENTURE: ".V", TSXV: ".V", CVE: ".V",
  LSE: ".L", LSEETF: ".L", BATEUK: ".L",
  // German venues: Frankfurt (.F) is the liquid line for these tickers;
  // Stuttgart (.SG) often returns stale prices.
  SWB: ".F", SWB2: ".F", STU: ".F", FWB: ".F", FRA: ".F",
  IBIS: ".DE", IBIS2: ".DE", XETRA: ".DE", GETTEX: ".DE",
  SBF: ".PA", ENEXT: ".PA",
  AEB: ".AS", BVME: ".MI", BM: ".MC", EBS: ".SW",
  TSEJ: ".T", SGX: ".SI", NSE: ".NS", BSE: ".BO",
};
// Exchanges that need no suffix (US + unknowns treated as US).
const US_EXCHANGES = new Set([
  "", "NYSE", "NASDAQ", "NASDAQ.NMS", "NMS", "NYQ", "NGM", "ARCA", "AMEX",
  "BATS", "PINK", "ISLAND", "IEX", "NYSENAT", "NYSEAMER",
]);

// Dropdown options for the manual "Add holding" form: label -> exchange code
// fed into yahooSymbol(). "US" maps to no suffix.
export const EXCHANGE_OPTIONS = [
  { code: "", label: "US (NYSE / Nasdaq)" },
  { code: "LSE", label: "London (LSE) — pence" },
  { code: "TSE", label: "Toronto (TSX)" },
  { code: "VENTURE", label: "TSX Venture" },
  { code: "ASX", label: "Australia (ASX)" },
  { code: "SEHK", label: "Hong Kong (SEHK)" },
  { code: "FRA", label: "Frankfurt" },
  { code: "XETRA", label: "Xetra (Germany)" },
  { code: "SBF", label: "Paris (Euronext)" },
  { code: "AEB", label: "Amsterdam (Euronext)" },
  { code: "BVME", label: "Milan (Borsa Italiana)" },
  { code: "BM", label: "Madrid (BME)" },
  { code: "EBS", label: "Swiss (SIX)" },
  { code: "TSEJ", label: "Tokyo" },
  { code: "SGX", label: "Singapore (SGX)" },
  { code: "NSE", label: "India (NSE)" },
];

export function toYahooSymbol(ticker, exchange) {
  return yahooSymbol(ticker, exchange);
}

function yahooSymbol(rawSymbol, exchange) {
  let sym = String(rawSymbol || "").trim().toUpperCase();
  const ex = String(exchange || "").trim().toUpperCase();
  if (!sym) return sym;
  // Already has a suffix -> leave it.
  if (/\.[A-Z]{1,3}$/.test(sym)) return sym;
  const suffix = EXCHANGE_SUFFIX[ex];
  if (suffix) {
    // Hong Kong tickers are numeric, zero-padded to 4 digits on Yahoo.
    if (suffix === ".HK" && /^\d+$/.test(sym)) sym = sym.padStart(4, "0");
    return sym + suffix;
  }
  return sym; // US or unknown -> as-is
}

function splitLine(line, delim) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === delim && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectDelim(line) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";") && !line.includes(",")) return ";";
  return ",";
}

function findIndex(headers, keys) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const k of keys) { const i = lower.indexOf(k); if (i !== -1) return i; }
  for (let i = 0; i < lower.length; i++) {
    if (keys.some((k) => lower[i] === k || lower[i].includes(k))) return i;
  }
  return -1;
}

function toNumber(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || /^(n\/a|na|-)$/i.test(s)) return null;
  const neg = /^\(.*\)$/.test(s); // (123) = negative
  const n = parseFloat(s.replace(/[()]/g, "").replace(/[^0-9.\-]/g, ""));
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

const OPTION_RE = /\b(CALL|PUT)\b|\d{1,2}'\d{2}|synthetic|combo|future/i;

function isSkippableSection(section) {
  const s = String(section || "").toLowerCase();
  return (
    s.startsWith("total") || s === "cash" || s.includes("option") ||
    s.includes("combo") || s.includes("future") || s.includes("forex") ||
    s.includes("warrant")
  );
}

export function parseHoldings(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], error: "No data found." };

  const delim = detectDelim(lines[0]);
  const headers = splitLine(lines[0], delim);

  let iSym = findIndex(headers, SYMBOL_KEYS);
  const iSh = findIndex(headers, SHARES_KEYS);
  const iCost = findIndex(headers, COST_KEYS);
  const iName = findIndex(headers, NAME_KEYS);
  const iEx = findIndex(headers, EXCHANGE_KEYS);
  const iSec = findIndex(headers, SECTION_KEYS);

  let startRow = 1;
  let si = iSym, shi = iSh, ci = iCost, ni = iName, exi = iEx, sei = iSec;
  // No recognizable header -> assume Symbol, Shares, Cost with no header row.
  if (si === -1) { si = 0; shi = 1; ci = 2; ni = -1; exi = -1; sei = -1; startRow = 0; }

  const rows = [];
  const skipped = [];
  for (let r = startRow; r < lines.length; r++) {
    const cols = splitLine(lines[r], delim);
    const section = sei >= 0 ? cols[sei] : "";
    if (isSkippableSection(section)) { skipped.push(cols[si]); continue; }

    const rawSym = (cols[si] || "").trim();
    if (!rawSym) continue;
    // Skip option / combo / future instruments (not quotable tickers).
    if (OPTION_RE.test(rawSym)) { skipped.push(rawSym); continue; }

    const upper = rawSym.toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9.\-]{1,14}$/.test(upper)) { skipped.push(rawSym); continue; }

    const shares = shi >= 0 ? toNumber(cols[shi]) : null;
    // Skip closed positions (0 shares) when a shares column exists.
    if (shi >= 0 && (shares === null || shares === 0)) { skipped.push(rawSym); continue; }

    const exchange = exi >= 0 ? cols[exi] : "";
    rows.push({
      symbol: yahooSymbol(rawSym, exchange),
      rawSymbol: upper,
      exchange: String(exchange || "").trim(),
      shares,
      cost: ci >= 0 ? toNumber(cols[ci]) : null,
      name: ni >= 0 ? cols[ni] || "" : "",
    });
  }

  if (!rows.length) {
    return { rows: [], error: "Couldn't find any importable stock positions." };
  }
  return { rows, error: null, skipped: skipped.filter(Boolean) };
}

const KEY = "pt_holdings_v2";

export function loadHoldings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migration: the stale Stuttgart (.SG) line is remapped to Frankfurt (.F).
    return parsed.map((h) =>
      h && typeof h.symbol === "string" && h.symbol.endsWith(".SG")
        ? { ...h, symbol: h.symbol.replace(/\.SG$/, ".F") }
        : h
    );
  } catch {
    return [];
  }
}

export function saveHoldings(rows) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows || []));
  } catch {
    /* ignore (private mode / blocked storage) */
  }
}
