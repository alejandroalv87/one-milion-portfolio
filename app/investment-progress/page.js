"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  loadSnapshots, saveSnapshots, loadProgressCurrency, saveProgressCurrency, currentMonth,
} from "@/lib/portfolio-state";
import { HISTORY_SEED } from "@/lib/history-seed";
import { fmtPct, signClass } from "@/lib/format";

export default function InvestmentProgressPage() {
  const [rows, setRows] = useState([]);
  const [ccy, setCcy] = useState("EUR");

  useEffect(() => {
    setCcy(loadProgressCurrency());
    let snaps = loadSnapshots();
    if (!snaps.length) {
      snaps = HISTORY_SEED.map((s) => ({ ...s, cash: null }));
      saveSnapshots(snaps);
    }
    setRows(snaps);
  }, []);

  const fmt = useMemo(
    () => (v) =>
      v == null || v === "" || Number.isNaN(Number(v))
        ? "–"
        : Number(v).toLocaleString("en-US", { style: "currency", currency: ccy || "EUR", maximumFractionDigits: 0 }),
    [ccy]
  );

  function persist(next) {
    const sorted = next.slice().sort((a, b) => String(a.month).localeCompare(String(b.month)));
    setRows(sorted);
    saveSnapshots(sorted);
  }
  function update(month, field, value) {
    persist(rows.map((r) => (r.month === month ? { ...r, [field]: value === "" ? null : Number(value) } : r)));
  }
  function updateMonth(oldMonth, newMonth) {
    if (!newMonth || rows.some((r) => r.month === newMonth && r.month !== oldMonth)) return;
    persist(rows.map((r) => (r.month === oldMonth ? { ...r, month: newMonth } : r)));
  }
  function addRow() {
    const last = rows[rows.length - 1];
    const m = rows.some((r) => r.month === currentMonth()) ? nextMonth(last ? last.month : currentMonth()) : currentMonth();
    persist([...rows, { month: m, invested: last?.invested ?? null, value: last?.value ?? null, added: 0, dividend: 0 }]);
  }
  function removeRow(month) {
    persist(rows.filter((r) => r.month !== month));
  }
  function changeCcy(v) {
    const c = v.toUpperCase().slice(0, 4);
    setCcy(c); saveProgressCurrency(c);
  }

  const k = useMemo(() => computeMetrics(rows), [rows]);

  return (
    <AppShell active="progress">
      <div className="wrap-head">
        <div>
          <h1 className="page">Investment progress</h1>
          <div className="sub2">{k.span ? `${rows.length} monthly snapshots · ${k.first} → ${k.last}` : "Month-to-month evolution"}</div>
        </div>
        <div className="flex gap8 items-center">
          <label className="muted" style={{ fontSize: 12.5 }}>Currency</label>
          <input className="input" style={{ width: 72 }} value={ccy} onChange={(e) => changeCcy(e.target.value)} />
          <button className="btn" onClick={addRow}>+ Add month</button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="stat-row" style={{ marginBottom: 18 }}>
          <div className="stat"><div className="k">Portfolio value</div><div className="v tnum" style={{ color: "var(--blue)" }}>{fmt(k.value)}</div><div className="d muted">latest</div></div>
          <div className="stat"><div className="k">Total invested</div><div className="v tnum">{fmt(k.invested)}</div></div>
          <div className="stat"><div className="k">Total gain</div><div className={"v tnum " + signClass(k.gain)}>{fmt(k.gain)}</div><div className={"d " + signClass(k.gainPct)}>{fmtPct(k.gainPct)} on money in</div></div>
          <div className="stat"><div className="k">Return (XIRR / yr)</div><div className="v tnum" style={{ color: "var(--accent)" }}>{k.xirr == null ? "–" : fmtPct(k.xirr).replace("+", "")}</div><div className="d muted">money-weighted</div></div>
          <div className="stat"><div className="k">Dividends collected</div><div className="v tnum">{fmt(k.dividends)}</div><div className="d muted">cumulative</div></div>
          <div className="stat"><div className="k">Max drawdown</div><div className="v tnum neg">{k.ddPct == null ? "–" : fmtPct(k.ddPct, 1)}</div>{k.ddFrom && <div className="d muted">{k.ddFrom} → {k.ddTo}</div>}</div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="phead"><h2>Portfolio value vs. capital invested</h2><span className="sub">Blue = value · dashed = invested · green band = gain</span></div>
        <div className="pbody">
          {rows.filter((r) => r.value != null).length < 2 ? (
            <div className="empty">Add at least two months to see the chart.</div>
          ) : (
            <ProgressChart rows={rows} ccy={ccy} />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="phead"><h2>Monthly snapshots</h2><span className="sub">Edit any cell · figures in {ccy}</span></div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Month</th><th>Invested</th><th>Value</th><th>Added</th><th>Dividend</th><th>Gain</th><th></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>No months yet — click “Add month”.</td></tr>
              )}
              {rows.map((r) => {
                const g = r.value != null && r.invested != null ? r.value - r.invested : null;
                return (
                  <tr key={r.month}>
                    <td><input className="input" type="month" value={r.month} onChange={(e) => updateMonth(r.month, e.target.value)} style={{ padding: "6px 8px", width: 150 }} /></td>
                    <td><CellInput value={r.invested} onChange={(v) => update(r.month, "invested", v)} /></td>
                    <td><CellInput value={r.value} onChange={(v) => update(r.month, "value", v)} /></td>
                    <td><CellInput value={r.added} onChange={(v) => update(r.month, "added", v)} /></td>
                    <td><CellInput value={r.dividend} onChange={(v) => update(r.month, "dividend", v)} /></td>
                    <td className={signClass(g)}>{g == null ? "–" : fmt(g)}</td>
                    <td><button className="btn ghost" onClick={() => removeRow(r.month)} style={{ padding: "4px 10px" }}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function CellInput({ value, onChange }) {
  return (
    <input className="input" inputMode="decimal" value={value ?? ""}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ""))}
      placeholder="–" style={{ padding: "6px 8px", width: 110, textAlign: "right" }} />
  );
}

function nextMonth(m) {
  const [y, mo] = String(m).split("-").map(Number);
  const d = new Date(y, (mo || 1) - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeMetrics(rows) {
  const clean = rows.filter((r) => r.value != null);
  if (!clean.length) return {};
  const last = clean[clean.length - 1];
  const value = last.value;
  const invested = last.invested;
  const gain = value != null && invested != null ? value - invested : null;
  const gainPct = gain != null && invested ? (gain / invested) * 100 : null;
  const dividends = rows.reduce((s, r) => s + (Number(r.dividend) || 0), 0);

  // XIRR from monthly contributions (added) + terminal value
  const flows = [];
  rows.forEach((r) => { if (r.added) flows.push([r.month, -Number(r.added)]); });
  flows.push([last.month, value]);
  let xirr = null;
  if (flows.length >= 2) {
    const t0 = monthToDate(flows[0][0]);
    const yr = (m) => (monthToDate(m) - t0) / (365 * 864e5);
    const npv = (rate) => flows.reduce((s, [m, c]) => s + c / Math.pow(1 + rate, yr(m)), 0);
    let lo = -0.95, hi = 5, mid = 0;
    if (npv(lo) * npv(hi) < 0 || true) {
      for (let i = 0; i < 200; i++) { mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; }
      xirr = mid * 100;
      if (!Number.isFinite(xirr) || Math.abs(xirr) > 1e4) xirr = null;
    }
  }

  // Max drawdown on value
  let peak = -Infinity, ddPct = 0, ddFrom = null, ddTo = null, curPeakMonth = null;
  clean.forEach((r) => {
    if (r.value > peak) { peak = r.value; curPeakMonth = r.month; }
    const dd = peak ? (r.value - peak) / peak * 100 : 0;
    if (dd < ddPct) { ddPct = dd; ddFrom = curPeakMonth; ddTo = r.month; }
  });

  return {
    value, invested, gain, gainPct, dividends, xirr,
    ddPct: ddPct < 0 ? ddPct : null, ddFrom, ddTo,
    span: true, first: clean[0].month, last: last.month,
  };
}
function monthToDate(m) {
  const [y, mo] = String(m).split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).getTime();
}

function ProgressChart({ rows, ccy }) {
  const [hover, setHover] = useState(null);
  const data = rows.filter((r) => r.value != null || r.invested != null);
  const W = 1000, H = 380, m = { t: 16, r: 16, b: 34, l: 60 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = data.flatMap((r) => [r.value, r.invested].filter((x) => x != null));
  const yMax = Math.max(1, ...vals) * 1.08;
  const x = (i) => m.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => m.t + (1 - v / yMax) * ih;
  const compactK = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(0) + "K" : String(Math.round(v)));

  const path = (key) => {
    const pts = data.map((r, i) => [i, r[key]]).filter(([, v]) => v != null).map(([i, v]) => `${x(i)},${y(v)}`);
    return pts.length ? `M${pts.join(" L")}` : "";
  };
  const area = (() => {
    const top = data.map((r, i) => (r.value != null ? [x(i), y(r.value)] : null)).filter(Boolean);
    const bot = data.map((r, i) => (r.invested != null ? [x(i), y(r.invested)] : null)).filter(Boolean);
    if (top.length < 2 || bot.length < 2) return "";
    return `M${top.map((p) => p.join(",")).join(" L")} L${bot.reverse().map((p) => p.join(",")).join(" L")} Z`;
  })();
  const grid = [];
  for (let i = 0; i <= 4; i++) { const v = (yMax / 4) * i; grid.push({ y: y(v), label: compactK(v) }); }
  const years = {};
  data.forEach((r, i) => { const yr = r.month.slice(0, 4); if (!(yr in years)) years[yr] = i; });

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((px - m.l) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }
  const fmtMoney = (v) => (v == null ? "–" : Number(v).toLocaleString("en-US", { style: "currency", currency: ccy || "EUR", maximumFractionDigits: 0 }));
  const h = hover != null ? data[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span className="flex items-center gap8"><i style={{ width: 14, height: 3, background: "var(--blue)", borderRadius: 2 }} /> Value</span>
        <span className="flex items-center gap8"><i style={{ width: 14, borderTop: "2px dashed var(--muted)" }} /> Invested</span>
        <span className="flex items-center gap8"><i style={{ width: 12, height: 11, background: "rgba(47,191,113,.3)", borderRadius: 3 }} /> Gain</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={m.l} y1={g.y} x2={W - m.r} y2={g.y} stroke="var(--grid)" strokeWidth="1" />
            <text x={m.l - 8} y={g.y + 4} textAnchor="end" fill="var(--muted)" fontSize="12">{g.label}</text>
          </g>
        ))}
        {Object.entries(years).map(([yr, i]) => (
          <text key={yr} x={x(i)} y={H - 12} textAnchor="middle" fill="var(--muted)" fontSize="11">{yr}</text>
        ))}
        {area && <path d={area} fill="rgba(47,191,113,.14)" />}
        {path("invested") && <path d={path("invested")} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" />}
        {path("value") && <path d={path("value")} fill="none" stroke="var(--blue)" strokeWidth="2.6" strokeLinejoin="round" />}
        {h && (
          <g>
            <line x1={x(hover)} y1={m.t} x2={x(hover)} y2={H - m.b} stroke="var(--axis)" strokeWidth="1" />
            {h.value != null && <circle cx={x(hover)} cy={y(h.value)} r="4.5" fill="var(--blue)" stroke="var(--panel)" strokeWidth="2" />}
            {h.invested != null && <circle cx={x(hover)} cy={y(h.invested)} r="3.5" fill="var(--muted)" stroke="var(--panel)" strokeWidth="1.5" />}
          </g>
        )}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" />
      </svg>
      {h && (
        <div style={{
          position: "absolute", left: `${(x(hover) / W) * 100}%`, top: 8, transform: "translateX(-50%)",
          background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 11px",
          fontSize: 12.5, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 6px 20px rgba(0,0,0,.3)",
        }}>
          <div style={{ fontWeight: 650, marginBottom: 4 }}>{h.month}</div>
          <div className="flex between gap16"><span className="muted">Value</span><span className="tnum">{fmtMoney(h.value)}</span></div>
          <div className="flex between gap16"><span className="muted">Invested</span><span className="tnum">{fmtMoney(h.invested)}</span></div>
          <div className="flex between gap16"><span className="muted">Gain</span><span className={"tnum " + signClass(h.value != null && h.invested != null ? h.value - h.invested : 0)}>{h.value != null && h.invested != null ? fmtMoney(h.value - h.invested) : "–"}</span></div>
        </div>
      )}
    </div>
  );
}
