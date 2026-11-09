"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import {
  fmtCurrency, fmtNum, fmtPct, fmtBig, fmtDate, daysUntil, signClass,
} from "@/lib/format";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "financials", label: "Financials" },
  { key: "ownership", label: "Ownership" },
  { key: "insiders", label: "Insider Transactions" },
];

async function getJSON(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j.data;
}

export default function StockPage({ params }) {
  const symbol = decodeURIComponent(params.symbol || "").toUpperCase();
  const router = useRouter();
  const [tab, setTab] = useState("overview");

  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [headErr, setHeadErr] = useState("");

  const [financials, setFinancials] = useState(null);
  const [period, setPeriod] = useState("quarter");
  const [ownership, setOwnership] = useState(null);
  const [insiders, setInsiders] = useState(null);
  const [tabErr, setTabErr] = useState("");
  const [tabLoading, setTabLoading] = useState(false);

  // header data
  useEffect(() => {
    let dead = false;
    setHeadErr("");
    Promise.all([
      getJSON(`/api/data/quote?symbol=${symbol}`).then((d) => (Array.isArray(d) ? d[0] : d)),
      getJSON(`/api/data/profile?symbol=${symbol}`).catch(() => null),
      getJSON(`/api/data/earnings?symbol=${symbol}`).catch(() => null),
    ]).then(([q, p, e]) => {
      if (dead) return;
      setQuote(q); setProfile(p); setEarnings(e);
    }).catch((err) => !dead && setHeadErr(err.message));
    return () => { dead = true; };
  }, [symbol]);

  // per-tab lazy load
  useEffect(() => {
    let dead = false;
    setTabErr("");
    async function load() {
      try {
        if (tab === "financials") {
          setTabLoading(true);
          const d = await getJSON(`/api/data/financials?symbol=${symbol}&period=${period}`);
          if (!dead) setFinancials(d);
        } else if (tab === "ownership" && ownership === null) {
          setTabLoading(true);
          const d = await getJSON(`/api/data/ownership?symbol=${symbol}`);
          if (!dead) setOwnership(d);
        } else if (tab === "insiders" && insiders === null) {
          setTabLoading(true);
          const d = await getJSON(`/api/data/insiders?symbol=${symbol}`);
          if (!dead) setInsiders(d);
        }
      } catch (err) {
        if (!dead) setTabErr(err.message);
      } finally {
        if (!dead) setTabLoading(false);
      }
    }
    load();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, symbol, period]);

  const up = quote && Number(quote.changesPercentage) >= 0;
  const nextE = earnings?.next;
  const dUntil = nextE ? daysUntil(nextE.date) : null;

  return (
    <AppShell active="dashboard">
      <span className="backlink" onClick={() => router.push("/")} style={{ cursor: "pointer" }}>← Back to portfolio</span>

      <div className="wrap-head" style={{ marginTop: 6 }}>
        <div>
          <h1 className="page">
            {symbol}
            {profile?.companyName && <span className="muted" style={{ fontSize: 15, marginLeft: 10 }}>{profile.companyName}</span>}
          </h1>
          <div className="sub2">
            {profile?.exchangeShortName || quote?.exchange || ""}
            {profile?.sector ? ` · ${profile.sector}` : ""}
            {profile?.industry ? ` · ${profile.industry}` : ""}
          </div>
        </div>
        {quote && (
          <div style={{ textAlign: "right" }}>
            <div className="tnum" style={{ fontSize: 26, fontWeight: 700 }}>{fmtCurrency(quote.price)}</div>
            <div className={"tnum " + (up ? "pos" : "neg")} style={{ fontSize: 14 }}>
              {fmtCurrency(quote.change)} ({fmtPct(quote.changesPercentage)})
            </div>
          </div>
        )}
      </div>

      {headErr && <div className="err" style={{ marginBottom: 16 }}>Couldn't load data for {symbol}: {headErr}</div>}

      {/* key stats */}
      <div className="stat-row" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="k">Next earnings</div>
          <div className="v" style={{ fontSize: 18 }}>{nextE ? fmtDate(nextE.date) : "–"}</div>
          <div className="d muted">
            {dUntil != null ? (dUntil === 0 ? "Today" : `in ${dUntil} day${dUntil === 1 ? "" : "s"}`) : "TBA"}
            {nextE?.epsEstimated != null ? ` · est. EPS ${fmtNum(nextE.epsEstimated, 2)}` : ""}
          </div>
        </div>
        <div className="stat">
          <div className="k">Market cap</div>
          <div className="v" style={{ fontSize: 18 }}>{fmtBig(quote?.marketCap)}</div>
        </div>
        <div className="stat">
          <div className="k">P / E</div>
          <div className="v" style={{ fontSize: 18 }}>{quote?.pe != null ? fmtNum(quote.pe, 1) : "–"}</div>
        </div>
        <div className="stat">
          <div className="k">52-week range</div>
          <div className="v" style={{ fontSize: 15 }}>
            {quote ? `${fmtNum(quote.yearLow, 2)} – ${fmtNum(quote.yearHigh, 2)}` : "–"}
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {tabErr && <div className="err">{tabErr}</div>}

      {tab === "overview" && (
        <OverviewTab profile={profile} quote={quote} earnings={earnings} />
      )}
      {tab === "financials" && (
        <FinancialsTab data={financials} loading={tabLoading} period={period} setPeriod={setPeriod} />
      )}
      {tab === "ownership" && (
        <OwnershipTab data={ownership} loading={tabLoading} />
      )}
      {tab === "insiders" && (
        <InsidersTab data={insiders} loading={tabLoading} />
      )}
    </AppShell>
  );
}

function OverviewTab({ profile, quote, earnings }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="panel">
        <div className="phead"><h2>About</h2></div>
        <div className="pbody">
          <p style={{ marginTop: 0, color: "var(--ink-2)", lineHeight: 1.6 }}>
            {profile?.description || "No company description available."}
          </p>
          <div className="stat-row" style={{ marginTop: 8 }}>
            <Mini k="CEO" v={profile?.ceo || "–"} />
            <Mini k="Employees" v={profile?.fullTimeEmployees ? fmtNum(profile.fullTimeEmployees) : "–"} />
            <Mini k="Country" v={profile?.country || "–"} />
            <Mini k="IPO" v={profile?.ipoDate || "–"} />
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="phead"><h2>Recent earnings</h2></div>
        <div className="pbody" style={{ paddingTop: 6 }}>
          <table>
            <thead><tr><th>Date</th><th>EPS</th><th>Est.</th></tr></thead>
            <tbody>
              {(earnings?.past || []).slice(0, 6).map((e, i) => (
                <tr key={i}>
                  <td>{fmtDate(e.date)}</td>
                  <td className={signClass(e.eps != null && e.epsEstimated != null ? e.eps - e.epsEstimated : 0)}>
                    {e.eps != null ? fmtNum(e.eps, 2) : "–"}
                  </td>
                  <td className="muted">{e.epsEstimated != null ? fmtNum(e.epsEstimated, 2) : "–"}</td>
                </tr>
              ))}
              {(!earnings || !earnings.past?.length) && (
                <tr><td colSpan={3} className="muted">No earnings history.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Mini({ k, v }) {
  return (
    <div className="stat" style={{ padding: "10px 12px" }}>
      <div className="k">{k}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{v}</div>
    </div>
  );
}

function FinancialsTab({ data, loading, period, setPeriod }) {
  if (loading && !data) return <div className="loading">Loading financials…</div>;
  const rows = Array.isArray(data) ? [...data].reverse() : []; // oldest → newest
  if (!rows.length) return <div className="empty">No financial statements available (may require a higher FMP plan).</div>;

  const metrics = [
    { label: "Revenue", get: (r) => fmtBig(r.revenue) },
    { label: "Gross profit", get: (r) => fmtBig(r.grossProfit) },
    { label: "Gross margin", get: (r) => fmtPct((r.grossProfitRatio || 0) * 100).replace("+", "") },
    { label: "Operating income", get: (r) => fmtBig(r.operatingIncome) },
    { label: "Operating margin", get: (r) => fmtPct((r.operatingIncomeRatio || 0) * 100).replace("+", "") },
    { label: "Net income", get: (r) => fmtBig(r.netIncome) },
    { label: "Net margin", get: (r) => fmtPct((r.netIncomeRatio || 0) * 100).replace("+", "") },
    { label: "EPS (diluted)", get: (r) => (r.epsdiluted != null ? fmtNum(r.epsdiluted, 2) : "–") },
  ];

  const colLabel = (r) =>
    period === "annual" ? String(r.calendarYear || (r.date || "").slice(0, 4)) : (r.period ? `${r.period} '${String(r.calendarYear).slice(2)}` : fmtDate(r.date));

  return (
    <div className="panel">
      <div className="phead">
        <h2>Income statement</h2>
        <div className="flex gap8">
          <button className={"tab" + (period === "quarter" ? " active" : "")} style={{ padding: "4px 10px" }} onClick={() => setPeriod("quarter")}>Quarterly</button>
          <button className={"tab" + (period === "annual" ? " active" : "")} style={{ padding: "4px 10px" }} onClick={() => setPeriod("annual")}>Annual</button>
        </div>
      </div>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {rows.map((r, i) => <th key={i}>{colLabel(r)}</th>)}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label}>
                <td className="sym">{m.label}</td>
                {rows.map((r, i) => <td key={i}>{m.get(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OwnershipTab({ data, loading }) {
  if (loading && !data) return <div className="loading">Loading ownership…</div>;
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return <div className="empty">No institutional ownership data available.</div>;
  return (
    <div className="panel">
      <div className="phead"><h2>Top institutional holders</h2><span className="sub">Latest 13F filings</span></div>
      <div className="scroll-x">
        <table>
          <thead>
            <tr><th>Holder</th><th>Shares</th><th>% Held</th><th>Date reported</th></tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <tr key={i}>
                <td className="sym">{h.holder}</td>
                <td>{fmtNum(h.shares)}</td>
                <td>{h.pctHeld != null ? fmtPct(h.pctHeld * 100).replace("+", "") : "–"}</td>
                <td className="muted">{fmtDate(h.dateReported)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsidersTab({ data, loading }) {
  if (loading && !data) return <div className="loading">Loading insider transactions…</div>;
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return <div className="empty">No insider transactions available.</div>;
  return (
    <div className="panel">
      <div className="phead"><h2>Insider transactions</h2><span className="sub">SEC Form 4 filings</span></div>
      <div className="scroll-x">
        <table>
          <thead>
            <tr><th>Insider</th><th>Type</th><th>Action</th><th>Shares</th><th>Price</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const buy = (t.acquistionOrDisposition || t.acquisitionOrDisposition) === "A";
              return (
                <tr key={i}>
                  <td className="sym">{t.reportingName}<span className="name">{t.typeOfOwner}</span></td>
                  <td className="muted">{t.transactionType}</td>
                  <td><span className={"pill " + (buy ? "buy" : "sell")}>{buy ? "Buy" : "Sell"}</span></td>
                  <td>{fmtNum(t.securitiesTransacted)}</td>
                  <td>{t.price ? fmtCurrency(t.price) : "–"}</td>
                  <td className="muted">{fmtDate(t.transactionDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
