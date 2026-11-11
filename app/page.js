"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { parseHoldings, loadHoldings, saveHoldings, toYahooSymbol, EXCHANGE_OPTIONS } from "@/lib/holdings";
import { instrumentCurrency, reconcileCost } from "@/lib/normalize";
import { loadBaseCurrency, saveBaseCurrency } from "@/lib/portfolio-state";
import { fmtCurrency, fmtNum, fmtPct, signClass } from "@/lib/format";

export default function Dashboard() {
  const router = useRouter();
  const [holdings, setHoldings] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [fx, setFx] = useState({});
  const [base, setBase] = useState("USD");
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [raw, setRaw] = useState("");
  const [parseMsg, setParseMsg] = useState("");
  const [sort, setSort] = useState({ key: "weight", dir: "desc" });
  const [add, setAdd] = useState({ ticker: "", exchange: "", shares: "", cost: "" });

  useEffect(() => {
    setBase(loadBaseCurrency());
    const h = loadHoldings();
    setHoldings(h);
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "1" || h.length === 0) setShowImport(true);
  }, []);

  // live quotes
  useEffect(() => {
    const syms = holdings.map((h) => h.symbol).filter(Boolean);
    if (!syms.length) { setQuotes({}); return; }
    let cancelled = false;
    setLoadingQuotes(true);
    fetch(`/api/data/quote?symbols=${encodeURIComponent(syms.join(","))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const map = {};
        (j.data || []).forEach((q) => { map[q.symbol] = q; });
        setQuotes(map);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingQuotes(false));
    return () => { cancelled = true; };
  }, [holdings]);

  // FX rates for all instrument currencies -> base
  useEffect(() => {
    const ccys = new Set();
    Object.values(quotes).forEach((q) => {
      const { ccy } = instrumentCurrency(q.currency);
      if (ccy) ccys.add(ccy);
    });
    if (!ccys.size) return;
    let cancelled = false;
    fetch(`/api/data/fx?base=${encodeURIComponent(base)}&ccy=${encodeURIComponent([...ccys].join(","))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setFx(j.data || {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [quotes, base]);

  const rows = useMemo(() => {
    return holdings.map((h) => {
      const q = quotes[h.symbol] || {};
      const { ccy: instCcy, div } = instrumentCurrency(q.currency);
      const priceMain = q.price != null ? q.price / div : null;        // in instCcy
      const costMain = reconcileCost(h.cost, priceMain, div);           // in instCcy
      const rate = instCcy ? fx[instCcy] : null;                        // instCcy -> base
      const shares = h.shares ?? null;
      const mktValueBase = priceMain != null && shares != null && rate != null ? priceMain * shares * rate : null;
      const costBase = costMain != null && shares != null && rate != null ? costMain * shares * rate : null;
      const gainBase = mktValueBase != null && costBase != null ? mktValueBase - costBase : null;
      const gainPct = gainBase != null && costBase ? (gainBase / costBase) * 100 : null;
      return {
        ...h, name: h.name || q.name || "", instCcy, priceMain, costMain,
        shares, mktValueBase, costBase, gainBase, gainPct,
        dayPct: q.changesPercentage ?? null,
      };
    });
  }, [holdings, quotes, fx, base]);

  const totals = useMemo(() => {
    let value = 0, cost = 0, day = 0, hasVal = false, hasCost = false, missing = 0;
    rows.forEach((r) => {
      if (r.mktValueBase != null) { value += r.mktValueBase; hasVal = true; } else if (r.shares) missing++;
      if (r.costBase != null) { cost += r.costBase; hasCost = true; }
      if (r.mktValueBase != null && r.dayPct != null) {
        day += r.mktValueBase - r.mktValueBase / (1 + r.dayPct / 100);
      }
    });
    const gain = hasVal && hasCost ? value - cost : null;
    const gainPct = gain != null && cost ? (gain / cost) * 100 : null;
    const dayPct = value && day ? (day / (value - day)) * 100 : null;
    return { value: hasVal ? value : null, day, dayPct, gain, gainPct, count: rows.length, missing };
  }, [rows]);

  function doImport() {
    const { rows: parsed, error, skipped } = parseHoldings(raw);
    if (error) { setParseMsg(error); return; }
    saveHoldings(parsed);
    setHoldings(parsed);
    const extra = skipped && skipped.length ? ` (skipped ${skipped.length} non-stock / closed rows)` : "";
    setParseMsg(`Imported ${parsed.length} positions${extra}.`);
    setShowImport(false);
    setRaw("");
  }
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result || ""));
    reader.readAsText(f);
  }
  function addHolding() {
    const ticker = add.ticker.trim();
    if (!ticker) return;
    const symbol = toYahooSymbol(ticker, add.exchange);
    const next = holdings.filter((h) => h.symbol !== symbol).concat([{
      symbol,
      rawSymbol: ticker.toUpperCase(),
      exchange: add.exchange,
      shares: add.shares === "" ? null : Number(add.shares),
      cost: add.cost === "" ? null : Number(add.cost),
      name: "",
    }]);
    saveHoldings(next);
    setHoldings(next);
    setAdd({ ticker: "", exchange: "", shares: "", cost: "" });
    setParseMsg(`Added ${symbol}.`);
  }
  function removeHolding(symbol) {
    const next = holdings.filter((h) => h.symbol !== symbol);
    saveHoldings(next);
    setHoldings(next);
  }
  function changeBase(v) {
    const b = v.toUpperCase().slice(0, 4);
    setBase(b);
    if (/^[A-Z]{3}$/.test(b)) saveBaseCurrency(b);
  }

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (key === "symbol") return mul * String(a.symbol).localeCompare(String(b.symbol));
      const pick = { weight: "mktValueBase", mktValueBase: "mktValueBase", priceMain: "priceMain", dayPct: "dayPct", shares: "shares", costMain: "costMain", gainBase: "gainBase" };
      const f = pick[key] || "mktValueBase";
      const va = a[f] == null ? -Infinity : a[f];
      const vb = b[f] == null ? -Infinity : b[f];
      return mul * (va - vb);
    });
    return arr;
  }, [rows, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "symbol" ? "asc" : "desc" }));
  }
  const arrow = (key) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const baseMoney = (v) => (v == null ? "–" : fmtCurrency(v, base));
  const localMoney = (v, ccy) =>
    v == null ? "–" : ccy && ccy !== base ? `${fmtNum(v, v < 10 ? 4 : 2)} ${ccy}` : fmtCurrency(v, base);
  const weight = (r) => (totals.value && r.mktValueBase != null ? (r.mktValueBase / totals.value) * 100 : null);

  return (
    <AppShell active="dashboard">
      <div className="wrap-head">
        <div>
          <h1 className="page">Portfolio</h1>
          <div className="sub2">
            {totals.count ? `${totals.count} positions` : "No holdings yet"}
            {loadingQuotes ? " · refreshing prices…" : ""}
          </div>
        </div>
        <div className="flex gap8 items-center">
          <label className="muted" style={{ fontSize: 12.5 }}>Base</label>
          <input className="input" style={{ width: 72 }} value={base}
            onChange={(e) => changeBase(e.target.value)} aria-label="Base currency" />
          <button className="btn ghost" onClick={() => setShowImport((v) => !v)}>
            {holdings.length ? "Import / update" : "Import holdings"}
          </button>
        </div>
      </div>

      {(showImport || holdings.length === 0) && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="phead"><h2>Import holdings</h2><span className="sub">CSV / TSV — paste or upload</span></div>
          <div className="pbody">
            <p className="muted" style={{ marginTop: 0 }}>
              Paste or upload a CSV. Works with a simple <b>Symbol, Shares, Cost</b> sheet
              <i>or</i> an Interactive Brokers "Portfolio Positions" export — columns are
              detected automatically, foreign tickers are mapped to Yahoo symbols
              (e.g. 3918 → 3918.HK), and TOTAL / Cash / options / closed rows are skipped.
            </p>
            <textarea className="input" value={raw} onChange={(e) => setRaw(e.target.value)}
              placeholder={"Symbol,Shares,Cost\nAAPL,50,172.40\nGOOGL,30,138.10"} />
            <div className="flex gap12 items-center" style={{ marginTop: 12 }}>
              <button className="btn" onClick={doImport} disabled={!raw.trim()}>Import</button>
              <label className="btn ghost" style={{ cursor: "pointer" }}>
                Upload CSV<input type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{ display: "none" }} />
              </label>
              {parseMsg && <span className="muted">{parseMsg}</span>}
            </div>

            <div style={{ borderTop: "1px solid var(--line)", margin: "16px 0 14px" }} />
            <label style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Or add one holding manually</label>
            <div className="flex gap8" style={{ marginTop: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div><div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Ticker</div>
                <input className="input" style={{ width: 110 }} placeholder="AAPL"
                  value={add.ticker} onChange={(e) => setAdd({ ...add, ticker: e.target.value })} /></div>
              <div><div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Market</div>
                <select className="input" style={{ width: 210 }} value={add.exchange}
                  onChange={(e) => setAdd({ ...add, exchange: e.target.value })}>
                  {EXCHANGE_OPTIONS.map((o) => <option key={o.label} value={o.code}>{o.label}</option>)}
                </select></div>
              <div><div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Shares</div>
                <input className="input" style={{ width: 90 }} inputMode="decimal" placeholder="0"
                  value={add.shares} onChange={(e) => setAdd({ ...add, shares: e.target.value.replace(/[^0-9.\-]/g, "") })} /></div>
              <div><div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Avg cost</div>
                <input className="input" style={{ width: 90 }} inputMode="decimal" placeholder="0"
                  value={add.cost} onChange={(e) => setAdd({ ...add, cost: e.target.value.replace(/[^0-9.\-]/g, "") })} /></div>
              <button className="btn" onClick={addHolding} disabled={!add.ticker.trim()}>Add holding</button>
            </div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              Pick the market so the right Yahoo symbol and currency are used (e.g. ticker <b>SHEL</b> + London → SHEL.L).
            </div>
          </div>
        </div>
      )}

      {holdings.length > 0 && (
        <>
          <div className="stat-row" style={{ marginBottom: 18 }}>
            <div className="stat">
              <div className="k">Market value ({base})</div>
              <div className="v tnum">{baseMoney(totals.value)}</div>
            </div>
            <div className="stat">
              <div className="k">Day change</div>
              <div className={"v tnum " + signClass(totals.day)}>{baseMoney(totals.day)}</div>
              <div className={"d " + signClass(totals.dayPct)}>{fmtPct(totals.dayPct)}</div>
            </div>
            <div className="stat">
              <div className="k">Total gain / loss</div>
              <div className={"v tnum " + signClass(totals.gain)}>{totals.gain == null ? "–" : baseMoney(totals.gain)}</div>
              <div className={"d " + signClass(totals.gainPct)}>{fmtPct(totals.gainPct)}</div>
            </div>
            <div className="stat">
              <div className="k">Positions</div>
              <div className="v tnum">{totals.count}</div>
              {totals.missing > 0 && <div className="d muted">{totals.missing} without a price</div>}
            </div>
          </div>

          <div className="panel">
            <div className="phead"><h2>Holdings</h2><span className="sub">Values &amp; weights in {base} · click a row for detail</span></div>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("symbol")} style={{ cursor: "pointer" }}>Symbol{arrow("symbol")}</th>
                    <th onClick={() => toggleSort("priceMain")} style={{ cursor: "pointer" }}>Price{arrow("priceMain")}</th>
                    <th onClick={() => toggleSort("dayPct")} style={{ cursor: "pointer" }}>Day{arrow("dayPct")}</th>
                    <th onClick={() => toggleSort("shares")} style={{ cursor: "pointer" }}>Shares{arrow("shares")}</th>
                    <th onClick={() => toggleSort("mktValueBase")} style={{ cursor: "pointer" }}>Mkt value ({base}){arrow("mktValueBase")}</th>
                    <th onClick={() => toggleSort("costMain")} style={{ cursor: "pointer" }}>Avg cost{arrow("costMain")}</th>
                    <th onClick={() => toggleSort("gainBase")} style={{ cursor: "pointer" }}>Gain / loss ({base}){arrow("gainBase")}</th>
                    <th onClick={() => toggleSort("weight")} style={{ cursor: "pointer" }}>Weight{arrow("weight")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.symbol} className="clickable" onClick={() => router.push(`/stock/${r.symbol}`)}>
                      <td><span className="sym">{r.symbol}</span>{r.name && <span className="name">{r.name}</span>}</td>
                      <td>{localMoney(r.priceMain, r.instCcy)}</td>
                      <td className={signClass(r.dayPct)}>{fmtPct(r.dayPct)}</td>
                      <td>{fmtNum(r.shares, 4)}</td>
                      <td>{baseMoney(r.mktValueBase)}</td>
                      <td>{localMoney(r.costMain, r.instCcy)}</td>
                      <td className={signClass(r.gainBase)}>
                        {r.gainBase == null ? "–" : baseMoney(r.gainBase)}
                        {r.gainPct != null && <span className="muted"> ({fmtPct(r.gainPct)})</span>}
                      </td>
                      <td>{weight(r) == null ? "–" : fmtPct(weight(r), 1).replace("+", "")}</td>
                      <td><button className="btn ghost" title="Remove holding"
                        onClick={(e) => { e.stopPropagation(); removeHolding(r.symbol); }}
                        style={{ padding: "2px 9px" }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Prices and average cost are shown per share in each holding's own currency;
            market value, gain/loss and weight are converted to {base} at live FX rates.
            London quotes (pence) are converted to GBP automatically. Change the base
            currency with the box up top.
          </p>
        </>
      )}
    </AppShell>
  );
}
