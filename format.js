// Formatting helpers shared across the UI (safe for client components).

export function fmtCurrency(n, currency = "USD", max = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  // Guard against invalid currency codes (e.g. a half-typed "EU") which would
  // otherwise throw a RangeError from Intl and crash the whole page.
  const cur = typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency)
    ? currency.toUpperCase()
    : "USD";
  try {
    return Number(n).toLocaleString("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: max,
    });
  } catch {
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: max });
  }
}

export function fmtNum(n, max = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: max });
}

export function fmtPct(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  const v = Number(n);
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

// Big money -> compact (e.g. 1.2B, 350.0M)
export function fmtBig(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function fmtDate(s) {
  if (!s) return "–";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function daysUntil(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function signClass(n) {
  const v = Number(n);
  if (Number.isNaN(v) || v === 0) return "";
  return v > 0 ? "pos" : "neg";
}
