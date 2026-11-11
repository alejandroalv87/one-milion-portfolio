// Currency normalization helpers (client-safe).
//
// Some exchanges quote in a sub-unit: London in pence (GBp), Johannesburg in
// cents (ZAc), Tel Aviv in agorot (ILA). Convert those to the main unit so FX
// and aggregation are correct.
const SUBUNIT = {
  GBP_: "GBP", GBP: null, // guard
  GBp: { ccy: "GBP", div: 100 },
  GBX: { ccy: "GBP", div: 100 },
  ZAc: { ccy: "ZAR", div: 100 },
  ZAX: { ccy: "ZAR", div: 100 },
  ILA: { ccy: "ILS", div: 100 },
};

export function instrumentCurrency(rawCcy) {
  const c = String(rawCcy || "").trim();
  const sub = SUBUNIT[c];
  if (sub && sub.ccy) return { ccy: sub.ccy, div: sub.div };
  return { ccy: c || null, div: 1 };
}

// Reconcile a per-share cost to the instrument's main currency. If the quote is
// a sub-unit (div>1) and the cost looks like it's in that sub-unit (much larger
// than the main-unit price), divide it too. Converges whether the source cost
// was in pence or pounds.
export function reconcileCost(cost, priceMain, div) {
  if (cost == null) return null;
  if (div > 1 && priceMain != null && cost > 3 * priceMain) return cost / div;
  return cost;
}
