"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { loadHoldings } from "@/lib/holdings";
import {
  loadCash, saveCash, cashTotal, loadBaseCurrency, saveBaseCurrency,
  loadSnapshots, saveSnapshots, upsertSnapshot, currentMonth, uid,
} from "@/lib/portfolio-state";
import { instrumentCurrency } from "@/lib/normalize";
import { fmtPct, fmtCurrency } from "@/lib/format";

export default function AllocationPage() {
  const [ccy, setCcy] = useState("USD");
  const [cash, setCash] = useState([]);
  const [invInput, setInvInput] = useState("");   // investment value (editable)
  const [liveInv, setLiveInv] = useState(null);   // live naive sum
  const [mixed, setMixed] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    setCcy(loadBaseCurrency());
    const c = loadCash();
    setCash(c.length ? c : [{ id: uid(), label: "Bank account", amount: "" }]);
  }, []);

  // live investment total from holdings, converted to base currency via FX
  useEffect(() => {
    const holdings = loadHoldings();
    const syms = holdings.map((h) => h.symbol).filter(Boolean);
    if (!syms.length) return;
    let cancelled = false;
    (async () => {
      try {
        const qj = await (await fetch(`/api/data/quote?symbols=${encodeURIComponent(syms.join(","))}`, { cache: "no-store" })).json();
        const map = {};
        (qj.data || []).forEach((q) => (map[q.symbol] = q));
        const ccys = new Set();
        holdings.forEach((h) => {
          const q = map[h.symbol];
          if (q) { const { ccy: ic } = instrumentCurrency(q.currency); if (ic) ccys.add(ic); }
        });
        const fj = ccys.size
          ? await (await fetch(`/api/data/fx?base=${encodeURIComponent(ccy)}&ccy=${encodeURIComponent([...ccys].join(","))}`, { cache: "no-store" })).json()
          : { data: {} };
        const fx = fj.data || {};
        let sum = 0, haveAny = false;
        holdings.forEach((h) => {
          const q = map[h.symbol];
          if (q && q.price != null && h.shares != null) {
            const { ccy: ic, div } = instrumentCurrency(q.currency);
            const rate = ic ? fx[ic] : null;
            if (rate != null) { sum += (q.price / div) * h.shares * rate; haveAny = true; }
          }
        });
        if (haveAny && !cancelled) {
          setLiveInv(sum);
          setMixed(ccys.size > 1);
          setInvInput((prev) => (prev === "" ? String(Math.round(sum)) : prev));
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [ccy]);

  const investment = Number(invInput) || 0;
  const cashSum = cashTotal(cash.map((c) => ({ amount: Number(c.amount) || 0 })));
  const net = investment + cashSum;
  const invPct = net ? (investment / net) * 100 : 0;
  const cashPct = net ? (cashSum / net) * 100 : 0;

  const fmt = useMemo(() => (v) => fmtCurrency(v, ccy, 0), [ccy]);

  function updateCash(id, field, value) {
    setCash((list) => {
      const next = list.map((c) => (c.id === id ? { ...c, [field]: value } : c));
      saveCash(next);
      return next;
    });
  }
  function addCash() {
    setCash((list) => {
      const next = [...list, { id: uid(), label: "", amount: "" }];
      saveCash(next);
      return next;
    });
  }
  function removeCash(id) {
    setCash((list) => {
      const next = list.filter((c) => c.id !== id);
      saveCash(next);
      return next;
    });
  }
  function changeCcy(v) {
    setCcy(v);
    if (/^[A-Za-z]{3}$/.test(v)) saveBaseCurrency(v);
  }
  function saveSnapshot() {
    const m = currentMonth();
    const next = upsertSnapshot(loadSnapshots(), m, { value: investment, cash: cashSum });
    saveSnapshots(next);
    setSavedMsg(`Saved snapshot for ${m}: investments ${fmt(investment)}, cash ${fmt(cashSum)}.`);
  }

  return (
    <AppShell active="allocation">
      <div className="wrap-head">
        <div>
          <h1 className="page">Cash &amp; Allocation</h1>
          <div className="sub2">Your investments vs. cash on hand</div>
        </div>
        <div className="flex gap8 items-center">
          <label className="muted" style={{ fontSize: 12.5 }}>Base currency</label>
          <input className="input" style={{ width: 80 }} value={ccy}
            onChange={(e) => changeCcy(e.target.value.toUpperCase().slice(0, 4))} />
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="k">Investments</div><div className="v tnum" style={{ color: "var(--blue)" }}>{fmt(investment)}</div><div className="d muted">{fmtPct(invPct, 1).replace("+", "")} of net worth</div></div>
        <div className="stat"><div className="k">Cash</div><div className="v tnum" style={{ color: "var(--accent)" }}>{fmt(cashSum)}</div><div className="d muted">{fmtPct(cashPct, 1).replace("+", "")} of net worth</div></div>
        <div className="stat"><div className="k">Net worth</div><div className="v tnum">{fmt(net)}</div></div>
        <div className="stat"><div className="k">Cash runway buffer</div><div className="v tnum">{fmtPct(cashPct, 0).replace("+", "")}</div><div className="d muted">in cash</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
        {/* Donut */}
        <div className="panel">
          <div className="phead"><h2>Allocation</h2></div>
          <div className="pbody" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Donut invPct={invPct} />
            <div className="flex gap16" style={{ fontSize: 13 }}>
              <span className="flex items-center gap8"><i style={{ width: 11, height: 11, borderRadius: 3, background: "var(--blue)", display: "inline-block" }} /> Investments {fmtPct(invPct, 1).replace("+", "")}</span>
              <span className="flex items-center gap8"><i style={{ width: 11, height: 11, borderRadius: 3, background: "var(--accent)", display: "inline-block" }} /> Cash {fmtPct(cashPct, 1).replace("+", "")}</span>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="panel">
          <div className="phead"><h2>Figures</h2><span className="sub">Entered manually</span></div>
          <div className="pbody">
            <div className="field">
              <label>Investments value ({ccy})</label>
              <div className="flex gap8">
                <input className="input" inputMode="decimal" value={invInput}
                  onChange={(e) => setInvInput(e.target.value.replace(/[^0-9.\-]/g, ""))} placeholder="0" />
                {liveInv != null && (
                  <button className="btn ghost" onClick={() => setInvInput(String(Math.round(liveInv)))} title="Use live portfolio value">
                    Use live
                  </button>
                )}
              </div>
              {liveInv != null && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Live portfolio value ≈ {Math.round(liveInv).toLocaleString("en-US")} {ccy}
                  {mixed ? ", converted from multiple currencies at live FX rates" : ""}. You can
                  override it above.
                </div>
              )}
            </div>

            <label style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Cash accounts</label>
            <div className="grid" style={{ gap: 8, marginTop: 6 }}>
              {cash.map((c) => (
                <div key={c.id} className="flex gap8">
                  <input className="input" placeholder="Account name" value={c.label}
                    onChange={(e) => updateCash(c.id, "label", e.target.value)} style={{ flex: 2 }} />
                  <input className="input" inputMode="decimal" placeholder="Amount" value={c.amount}
                    onChange={(e) => updateCash(c.id, "amount", e.target.value.replace(/[^0-9.\-]/g, ""))} style={{ flex: 1 }} />
                  <button className="btn ghost" onClick={() => removeCash(c.id)} title="Remove" style={{ padding: "0 12px" }}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap8" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={addCash}>+ Add account</button>
              <button className="btn" onClick={saveSnapshot}>Save this month to History</button>
            </div>
            {savedMsg && <div className="ok">{savedMsg}</div>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Donut({ invPct }) {
  const r = 70, c = 2 * Math.PI * r, inv = Math.max(0, Math.min(100, invPct));
  const invLen = (inv / 100) * c;
  return (
    <svg width="190" height="190" viewBox="0 0 190 190" role="img" aria-label="Allocation donut">
      <g transform="rotate(-90 95 95)">
        <circle cx="95" cy="95" r={r} fill="none" stroke="var(--accent)" strokeWidth="26" />
        <circle cx="95" cy="95" r={r} fill="none" stroke="var(--blue)" strokeWidth="26"
          strokeDasharray={`${invLen} ${c - invLen}`} />
      </g>
      <text x="95" y="90" textAnchor="middle" fill="var(--ink)" fontSize="26" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
        {Math.round(inv)}%
      </text>
      <text x="95" y="110" textAnchor="middle" fill="var(--muted)" fontSize="12">invested</text>
    </svg>
  );
}
