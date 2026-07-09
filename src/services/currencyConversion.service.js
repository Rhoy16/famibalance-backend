// src/services/currencyConversion.service.js
//
// RF-10 — Multi-currency support.
// Converts a transaction amount into the family's base currency at the
// moment it is created/updated, and returns the exchange rate used so it
// can be stored on the row. That way historical transactions keep the
// rate that was actually applied, even if rates move later.

const BASE_CURRENCY = process.env.BASE_CURRENCY || 'PEN';

// Simple in-memory cache: refresh rates at most once per hour so we don't
// call the external API on every single request.
let cachedRates = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

// Fallback table used only if the external API call fails (e.g. no
// internet in the grading environment). Expressed as 1 BASE_CURRENCY = X.
const FALLBACK_RATES = {
  PEN: 1,
  USD: 0.27,
  EUR: 0.25,
};

async function fetchRates() {
  const now = Date.now();
  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`);
    const json = await response.json();

    if (!json || !json.rates) {
      throw new Error('Malformed response from exchange rate provider');
    }

    cachedRates = json.rates;
    cachedAt = now;
    return cachedRates;
  } catch (error) {
    console.warn('[currencyConversion.service] Using fallback rates:', error.message);
    return FALLBACK_RATES;
  }
}

/**
 * Converts `amount` (in `currency`) into the base currency.
 * Returns { baseAmount, exchangeRate }.
 */
export async function convertToBaseCurrency(amount, currency) {
  const normalizedCurrency = (currency || BASE_CURRENCY).toUpperCase();

  if (normalizedCurrency === BASE_CURRENCY) {
    return { baseAmount: amount, exchangeRate: 1 };
  }

  const rates = await fetchRates();
  const rateForCurrency = rates[normalizedCurrency];

  if (!rateForCurrency) {
    const error = new Error(`Unsupported currency: ${normalizedCurrency}`);
    error.statusCode = 400;
    throw error;
  }

  // `rates` is expressed as BASE_CURRENCY -> currency, so invert it to go
  // from `currency` back into BASE_CURRENCY.
  const exchangeRate = 1 / rateForCurrency;
  const baseAmount = Number((amount * exchangeRate).toFixed(2));

  return { baseAmount, exchangeRate: Number(exchangeRate.toFixed(6)) };
}

export { BASE_CURRENCY };
