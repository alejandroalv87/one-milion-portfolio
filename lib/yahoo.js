// Server-side Yahoo Finance client. No API key required.
//
// - Quotes (price, day change, 52-week, currency, name) come from the public
//   chart endpoint, which needs no cookie/crumb and is very reliable.
// - The richer data (next earnings, institutional ownership, insider trades,
//   income statement, market cap / PE) comes from quoteSummary, which Yahoo
//   gates behind a cookie + "crumb". We fetch and cache those. If Yahoo blocks
//   quoteSummary from the host IP, those calls degrade gracefully (the UI shows
//   "not available") while quotes keep working.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

const cache = new Map(); // key -> { at, data }
function ttlMs() {
  return Math.max(0, Number(process.env.DATA_CACHE_TTL || 60)) * 1000;
}
function cached(key) {
  const h = cache.get(key);
  return h && Date.now() - h.at < ttlMs() ? h.data : undefined;
}
function store(key, data) {
  cache.set(key, { at: Date.now(), data });
  return data;
}

const raw = (o) => (o && typeof o === "object" && "raw" in o ? o.raw : o);
const num = (v) => {
  const n = Number(raw(v));
  return Number.isFinite(n) ? n : null;
};

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ----------------------------- QUOTES (chart) ----------------------------- */

async function chartQuote(symbol) {
  const key = `chart:${symbol}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1d`;
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) throw new Error(`chart ${r.status}`);
    const j = await r.json();
    const m = j?.chart?.result?.[0]?.meta;
    if (!m || m.regularMarketPrice == null) return store(key, null);
    const price = num(m.regularMarketPrice);
    const prev = num(m.chartPreviousClose) ?? num(m.previousClose);
    const change = price != null && prev != null ? price - prev : null;
    const pct = change != null && prev ? (change / prev) * 100 : null;
    return store(key, {
      symbol: m.symbol || symbol,
      name: m.shortName || m.longName || symbol,
      price,
      change,
      changesPercentage: pct,
      currency: m.currency || null,
      exchange: m.fullExchangeName || m.exchangeName || null,
      yearLow: num(m.fiftyTwoWeekLow),
      yearHigh: num(m.fiftyTwoWeekHigh),
    });
  } catch {
    return store(key, null);
  }
}

export async function getQuotes(symbols) {
  const list = (Array.isArray(symbols) ? symbols : String(symbols).split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return [];
  const results = await mapLimit(list, 6, chartQuote);
  return results.filter(Boolean);
}

/* --------------------------- quoteSummary + crumb -------------------------- */

let crumbCache = { crumb: null, cookie: null, at: 0 };

async function ensureCrumb() {
  if (crumbCache.crumb && Date.now() - crumbCache.at < 25 * 60 * 1000) return crumbCache;
  // 1) get a cookie
  const r = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
  const setCookies =
    typeof r.headers.getSetCookie === "function"
      ? r.headers.getSetCookie()
      : [r.headers.get("set-cookie")].filter(Boolean);
  const cookie = setCookies.map((c) => String(c).split(";")[0]).join("; ");
  // 2) exchange it for a crumb
  const cr = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie, Accept: "text/plain" },
  });
  const crumb = (await cr.text()).trim();
  if (!crumb || /too many|unauthorized|<html/i.test(crumb)) {
    throw new Error("Yahoo crumb unavailable");
  }
  crumbCache = { crumb, cookie, at: Date.now() };
  return crumbCache;
}

async function quoteSummary(symbol, modules) {
  const key = `qs:${symbol}:${modules}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  try {
    let { crumb, cookie } = await ensureCrumb();
    const build = (c) =>
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        symbol
      )}?modules=${encodeURIComponent(modules)}&crumb=${encodeURIComponent(c)}`;
    let r = await fetch(build(crumb), {
      headers: { "User-Agent": UA, Cookie: cookie, Accept: "application/json" },
    });
    if (r.status === 401) {
      // crumb may be stale — refresh once
      crumbCache = { crumb: null, cookie: null, at: 0 };
      ({ crumb, cookie } = await ensureCrumb());
      r = await fetch(build(crumb), {
        headers: { "User-Agent": UA, Cookie: cookie, Accept: "application/json" },
      });
    }
    if (!r.ok) throw new Error(`quoteSummary ${r.status}`);
    const j = await r.json();
    const res = j?.quoteSummary?.result?.[0] || null;
    return store(key, res);
  } catch {
    return store(key, null);
  }
}

/* ------------------------------ Mapped getters ---------------------------- */

export async function getQuoteDetail(symbol) {
  const base = await chartQuote(symbol);
  const qs = await quoteSummary(symbol, "price,summaryDetail,defaultKeyStatistics");
  const price = qs?.price || {};
  const sd = qs?.summaryDetail || {};
  return {
    ...(base || { symbol }),
    name: base?.name || price.longName || price.shortName || symbol,
    marketCap: num(price.marketCap) ?? num(sd.marketCap),
    pe: num(sd.trailingPE),
    yearLow: base?.yearLow ?? num(sd.fiftyTwoWeekLow),
    yearHigh: base?.yearHigh ?? num(sd.fiftyTwoWeekHigh),
  };
}

export async function getProfile(symbol) {
  const qs = await quoteSummary(symbol, "assetProfile,summaryProfile,price");
  if (!qs) return null;
  const p = qs.assetProfile || qs.summaryProfile || {};
  const price = qs.price || {};
  const ceo = (p.companyOfficers || []).find((o) => /chief executive|ceo/i.test(o.title || ""));
  return {
    companyName: price.longName || price.shortName || symbol,
    exchangeShortName: price.exchangeName || null,
    sector: p.sector || null,
    industry: p.industry || null,
    description: p.longBusinessSummary || null,
    ceo: ceo?.name || null,
    fullTimeEmployees: p.fullTimeEmployees || null,
    country: p.country || null,
    ipoDate: null,
  };
}

export async function getEarnings(symbol) {
  const qs = await quoteSummary(symbol, "calendarEvents,earnings");
  if (!qs) return { next: null, upcoming: [], past: [] };
  const dates = qs.calendarEvents?.earnings?.earningsDate || [];
  const nextTs = dates.map((d) => num(d)).filter(Boolean).sort((a, b) => a - b);
  const nextDate = nextTs.length ? new Date(nextTs[0] * 1000).toISOString().slice(0, 10) : null;
  const epsEst = num(qs.calendarEvents?.earnings?.earningsAverage);
  const quarterly = qs.earnings?.earningsChart?.quarterly || [];
  const past = quarterly
    .map((q) => ({ date: q.date, eps: num(q.actual), epsEstimated: num(q.estimate) }))
    .reverse();
  return {
    next: nextDate ? { date: nextDate, epsEstimated: epsEst } : null,
    upcoming: [],
    past,
  };
}

export async function getOwnership(symbol) {
  const qs = await quoteSummary(symbol, "institutionOwnership,majorHoldersBreakdown");
  const list = qs?.institutionOwnership?.ownershipList || [];
  return list
    .map((o) => ({
      holder: o.organization,
      shares: num(o.position),
      pctHeld: num(o.pctHeld),
      pctChange: num(o.pctChange),
      dateReported: o.reportDate?.fmt || null,
    }))
    .filter((o) => o.holder)
    .sort((a, b) => (b.shares || 0) - (a.shares || 0))
    .slice(0, 25);
}

export async function getInsiders(symbol) {
  const qs = await quoteSummary(symbol, "insiderTransactions");
  const list = qs?.insiderTransactions?.transactions || [];
  return list.slice(0, 40).map((t) => {
    const text = t.transactionText || t.moneyText || "";
    const isSale = /sale|sell|dispos/i.test(text);
    return {
      reportingName: t.filerName,
      typeOfOwner: t.filerRelation || "",
      transactionType: text || "–",
      acquistionOrDisposition: isSale ? "D" : "A",
      securitiesTransacted: num(t.shares),
      price: num(t.value) && num(t.shares) ? num(t.value) / num(t.shares) : null,
      transactionDate: t.startDate?.fmt || null,
    };
  });
}

export async function getIncomeStatement(symbol, period = "quarter") {
  const mod = period === "annual" ? "incomeStatementHistory" : "incomeStatementHistoryQuarterly";
  const qs = await quoteSummary(symbol, mod);
  const rows = qs?.[mod]?.incomeStatementHistory || [];
  return rows.map((r) => {
    const revenue = num(r.totalRevenue);
    const grossProfit = num(r.grossProfit);
    const operatingIncome = num(r.operatingIncome);
    const netIncome = num(r.netIncome);
    return {
      date: r.endDate?.fmt || null,
      calendarYear: r.endDate?.fmt ? r.endDate.fmt.slice(0, 4) : null,
      period: null,
      revenue,
      grossProfit,
      operatingIncome,
      netIncome,
      grossProfitRatio: revenue ? grossProfit / revenue : null,
      operatingIncomeRatio: revenue ? operatingIncome / revenue : null,
      netIncomeRatio: revenue ? netIncome / revenue : null,
      epsdiluted: null,
    };
  });
}
