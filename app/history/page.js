"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  loadSnapshots, saveSnapshots, loadBaseCurrency, currentMonth,
} from "@/lib/portfolio-state";
import { fmtPct, signClass } from "@/lib/format";

export default function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [ccy, setCcy] = useState("USD");

  useEffect(() => {
    setRows(loadSnapshots());
    setCcy(loadBaseCurrency());
  }, []);

  const fmt = useMemo(
    () => (v) =>
      v == null || v === "" || Number.isNaN(Number(v))
        ? "–"
        : Number(v).toLocaleString("en-US", { style: "currency", currency: ccy || "USD", maximumFractionDigits: 0 }),
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
    const m = rows.some((r) => r.month === currentMonth())
      ? nextMonth(last ? last.month : currentMonth())
      : currentMonth();
    persist([...rows, { month: m, invested: last?.invested ?? null, value: last?.value ?? null, cash: last?.cash ?? null }]);
  }
  function removeRow(month) {
    persist(rows.filter((r) => r.month !== month));
  }

  // derived
  const clean = rows.filter((r) => r.value != null || r.invested != null);
  const latest = clean[clean.length - 1] || {};
  const invested = latest.invested ?? null;
  const value = latest.value ?? null;
  const cash = latest.cash ?? null;
  const gain = value != null && invested != null ? value - invested : null;
  const gainPct = gain != null && invested ? (gain / invested) * 100 : null;
  const net = (value || 0) + (cash || 0);

  return (
    <AppShell active="history">
      <div className="wrap-head">
        <div>
          <h1 className="page">History</h1>
          <div className="sub2">Month-to-month evolution of invested capital, portfolio value &amp; cash</div>
        </div>
        <button className="btn" onClick={addRow}>+ Add month</button>
      </div>

      {clean.length > 0 && (
        <div className="stat-row" style={{ marginBottom: 18 }}>
          <div className="stat"><div className="k">Portfolio value</div><div className="v tnum" style={{ color: "var(--blue)" }}>{fmt(value)}</div></div>
          <div className="stat"><div className="k">Invested</div><div className="v tnum">{fmt(invested)}</div></div>
          <div className="stat"><div className="k">Gain / loss</div><div className={"v tnum " + signClass(gain)}>{gain == null ? "–" : fmt(gain)}</div><div className={"d " + signClass(gainPct)}>{fmtPct(gainPct)}</div></div>
          <div className="stat"><div className="k">Net worth</div><div className="v tnum">{fmt(net)}</div><div className="d muted">incl. {fmt(cash)} cash</div></div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="phead"><h2>Evolution</h2><span className="sub">Value vs. invested, and net worth</span></div>
        <div className="pbody">
          {clean.length < 2 ? (
            <div className="empty">Add at least two months (below) to see the chart.</div>
          ) : (
            <EvolutionChart rows={clean} ccy={ccy} />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="phead"><h2>Monthly snapshots</h2><span className="sub">Enter figures in {ccy}</span></div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Month</th><th>Invested</th><th>Value</th><th>Cash</th><th>Gain</th><th></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>No months yet — click “Add month”, or save one from the Cash &amp; Allocation tab.</td></tr>
              )}
              {rows.map((r) => {
                const g = r.value != null && r.invested != null ? r.value - r.invested : null;
                return (
                  <tr key={r.month}>
                    <td><input className="input" type="month" value={r.month} onChange={(e) => updateMonth(r.month, e.target.value)} style={{ padding: "6px 8px", width: 150 }} /></td>
                    <td><CellInput value={r.invested} onChange={(v) => update(r.month, "invested", v)} /></td>
                    <td><CellInput value={r.value} onChange={(v) => update(r.month, "value", v)} /></td>
                    <td><CellInput value={r.cash} onChange={(v) => update(r.month, "cash", v)} /></td>
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
    <input
      className="input" inputMode="decimal" value={value ?? ""}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.\-]/g, ""))}
      placeholder="–" style={{ padding: "6px 8px", width: 120, textAlign: "right" }}
    />
  );
}

function nextMonth(m) {
  const [y, mo] = String(m).split("-").map(Number);
  const d = new Date(y, (mo || 1) - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function EvolutionChart({ rows, ccy }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const W = 1000, H = 380, m = { t: 16, r: 16, b: 34, l: 60 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  const vals = rows.flatMap((r) => [r.value, r.invested, (r.value || 0) + (r.cash || 0)].filter((x) => x != null));
  const yMax = Math.max(1, ...vals) * 1.08;
  const x = (i) => m.l + (rows.length === 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
  const y = (v) => m.t + (1 - v / yMax) * ih;

  const compactK = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(0) + "K";
    return String(Math.round(v));
  };
  const line = (key, extra) => {
    const pts = rows
      .map((r, i) => [i, key === "net" ? (r.value || 0) + (r.cash || 0) : r[key]])
      .filter(([, v]) => v != null)
      .map(([i, v]) => `${x(i)},${y(v)}`);
    return pts.length ? `M${pts.join(" L")}` : "";
  };

  // gain area between value and invested
  const areaPath = (() => {
    const top = rows.map((r, i) => (r.value != null ? [x(i), y(r.value)] : null)).filter(Boolean);
    const bot = rows.map((r, i) => (r.invested != null ? [x(i), y(r.invested)] : null)).filter(Boolean);
    if (top.length < 2 || bot.length < 2) return "";
    return `M${top.map((p) => p.join(",")).join(" L")} L${bot.reverse().map((p) => p.join(",")).join(" L")} Z`;
  })();

  const grid = [];
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    grid.push({ y: y(v), label: compactK(v) });
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round(((px - m.l) / iw) * (rows.length - 1));
    i = Math.max(0, Math.min(rows.length - 1, i));
    setHover(i);
  }

  const fmtMoney = (v) =>
    v == null ? "–" : Number(v).toLocaleString("en-US", { style: "currency", currency: ccy || "USD", maximumFractionDigits: 0 });

  const h = hover != null ? rows[hover] : null;

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span className="flex items-center gap8"><i style={{ width: 14, height: 3, background: "var(--blue)", borderRadius: 2 }} /> Value</span>
        <span className="flex items-center gap8"><i style={{ width: 14, borderTop: "2px dashed var(--muted)" }} /> Invested</span>
        <span className="flex items-center gap8"><i style={{ width: 14, height: 3, background: "var(--accent)", borderRadius: 2 }} /> Net worth (value + cash)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {grid.map((g, i) => (
          <g key={i}>
            <line x1={m.l} y1={g.y} x2={W - m.r} y2={g.y} stroke="var(--grid)" strokeWidth="1" />
            <text x={m.l - 8} y={g.y + 4} textAnchor="end" fill="var(--muted)" fontSize="12">{g.label}</text>
          </g>
        ))}
        {rows.map((r, i) => (
          <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fill="var(--muted)" fontSize="11">
            {rows.length > 14 && i % 2 ? "" : r.month.slice(2)}
          </text>
        ))}
        {areaPath && <path d={areaPath} fill="rgba(47,191,113,.12)" />}
        {line("net") && <path d={line("net")} fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.9" />}
        {line("invested") && <path d={line("invested")} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" />}
        {line("value") && <path d={line("value")} fill="none" stroke="var(--blue)" strokeWidth="2.6" strokeLinejoin="round" />}
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
          <div className="flex between gap16"><span className="muted">Net worth</span><span className="tnum">{fmtMoney((h.value || 0) + (h.cash || 0))}</span></div>
        </div>
      )}
    </div>
  );
}
