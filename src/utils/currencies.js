/** Store currencies. Change the default in Settings → Store. */
export const DEFAULT_CURRENCY = "SAR";

export const CURRENCIES = [
  { code: "SAR", name: "Saudi Riyal" },
  { code: "AED", name: "UAE Dirham" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "EGP", name: "Egyptian Pound" },
];

export function currencyLabel(code) {
  const match = CURRENCIES.find((c) => c.code === code);
  if (!match) return code || DEFAULT_CURRENCY;
  return `${match.code} — ${match.name}`;
}

export function currencyOptions(currentCode) {
  const code = String(currentCode || DEFAULT_CURRENCY).trim() || DEFAULT_CURRENCY;
  if (CURRENCIES.some((c) => c.code === code)) return CURRENCIES;
  return [{ code, name: code }, ...CURRENCIES];
}
