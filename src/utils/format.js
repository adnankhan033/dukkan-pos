export function formatCurrency(amount, currency = "SAR") {
  const value = Number(amount) || 0;
  return `${value.toFixed(2)} ${currency}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function startOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function generateNumber(prefix) {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${ts}${rand}`;
}

export function calcVat(subtotal, discount, vatPercent) {
  const base = Math.max(0, subtotal - discount);
  return (base * vatPercent) / 100;
}

export function calcGrandTotal(subtotal, discount, vat) {
  return Math.max(0, subtotal - discount + vat);
}

/** Normalize DB / Tauri plugin errors into a readable string. */
export function formatDbError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  if (typeof err === "object") {
    if (typeof err.error === "string") return err.error;
    if (typeof err.msg === "string") return err.msg;
    try {
      const text = JSON.stringify(err);
      if (text && text !== "{}") return text;
    } catch {
      /* ignore */
    }
  }
  return "Unknown error";
}
