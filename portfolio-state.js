// Manual-entry state (client-side): cash accounts, base currency, and monthly
// snapshots for the history / evolution view. All persisted in localStorage.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore (private mode / blocked storage) */
  }
}

/* ------------------------------- base currency ---------------------------- */
const CCY_KEY = "pt_base_ccy_v1";
export function loadBaseCurrency() {
  return read(CCY_KEY, "USD");
}
export function saveBaseCurrency(ccy) {
  write(CCY_KEY, String(ccy || "USD").toUpperCase().slice(0, 4));
}

/* ---------------------- investment-progress currency ---------------------- */
const PROG_CCY_KEY = "pt_progress_ccy_v1";
export function loadProgressCurrency() {
  return read(PROG_CCY_KEY, "EUR");
}
export function saveProgressCurrency(ccy) {
  write(PROG_CCY_KEY, String(ccy || "EUR").toUpperCase().slice(0, 4));
}

/* ------------------------------- cash accounts ---------------------------- */
// [{ id, label, amount }]
const CASH_KEY = "pt_cash_v1";
export function loadCash() {
  const v = read(CASH_KEY, []);
  return Array.isArray(v) ? v : [];
}
export function saveCash(list) {
  write(CASH_KEY, Array.isArray(list) ? list : []);
}
export function cashTotal(list) {
  return (list || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
}

/* ------------------------------ margin / loan ----------------------------- */
// [{ id, ccy, amount, rate }]  amount = borrowed magnitude; rate = % per year
const MARGIN_KEY = "pt_margin_v1";
export function loadMargin() {
  const v = read(MARGIN_KEY, null);
  return Array.isArray(v) ? v : null; // null => not initialized yet
}
export function saveMargin(list) {
  write(MARGIN_KEY, Array.isArray(list) ? list : []);
}

/* --------------------------------- snapshots ------------------------------ */
// [{ month: 'YYYY-MM', invested, value, cash }]  (invested = contributions to date)
const SNAP_KEY = "pt_snapshots_v1";
export function loadSnapshots() {
  const v = read(SNAP_KEY, []);
  if (!Array.isArray(v)) return [];
  return v.slice().sort((a, b) => String(a.month).localeCompare(String(b.month)));
}
export function saveSnapshots(list) {
  write(SNAP_KEY, Array.isArray(list) ? list : []);
}
// Insert or update the snapshot for a given month (merges provided fields).
export function upsertSnapshot(list, month, fields) {
  const next = Array.isArray(list) ? list.slice() : [];
  const i = next.findIndex((s) => s.month === month);
  if (i >= 0) next[i] = { ...next[i], ...fields, month };
  else next.push({ month, invested: null, value: null, cash: null, ...fields });
  return next.sort((a, b) => String(a.month).localeCompare(String(b.month)));
}
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
