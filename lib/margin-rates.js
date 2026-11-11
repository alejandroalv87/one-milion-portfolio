// Interactive Brokers (IBKR Pro) margin loan rates — first tier, in % per year.
// Source: https://www.interactivebrokers.ie/en/trading/margin-rates.php
// These track benchmark (central-bank) rates and CHANGE over time, so they are
// only DEFAULTS to pre-fill the form — the user can edit each rate.
// Captured: Nov 2026.
export const DEFAULT_MARGIN_RATES = {
  USD: 5.38, EUR: 4.0, GBP: 5.48, CAD: 3.97, HKD: 5.40, AUD: 6.30,
  CHF: 1.50, JPY: 2.58, SEK: 3.28, SGD: 3.46, NOK: 5.90, NZD: 4.10,
  DKK: 4.99, PLN: 6.85, CZK: 6.64, ILS: 7.25, INR: 8.66, MXN: 9.40,
  ZAR: 8.43, AED: 6.35, CNH: 5.20,
};

export const MARGIN_RATES_ASOF = "Nov 2026";

// Starting point from the balances in your IBKR positions export (the negative
// cash lines = broker loan). Amounts are the borrowed magnitude; edit to update.
export const MARGIN_SEED = [
  { ccy: "CAD", amount: 25842 },
  { ccy: "EUR", amount: 19695 },
  { ccy: "GBP", amount: 9406 },
  { ccy: "USD", amount: 15675 },
];
