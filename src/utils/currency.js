export function convertTo(amount, fromCurrency, toCurrency, usdToPkr) {
  const a = Number(amount) || 0;
  if (fromCurrency === toCurrency) return a;
  if (fromCurrency === "USD" && toCurrency === "PKR") return a * usdToPkr;
  if (fromCurrency === "PKR" && toCurrency === "USD") return a / (usdToPkr || 1);
  return a;
}

export function formatMoneyFor(amount, currency) {
  const n = Number(amount) || 0;
  const locale = currency === "PKR" ? "en-PK" : "en-US";
  const code = currency === "PKR" ? "PKR" : "USD";
  return new Intl.NumberFormat(locale, { style: "currency", currency: code, maximumFractionDigits: 2 }).format(n);
}









