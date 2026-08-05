import { useSettingsStore } from "../contexts/store";
import {
  resolveBusinessTimezone,
  formatDateTimeInTimezone,
  parseStoredTimestampToInstant,
} from "./timezones";

export function formatQuantity(qty, symbol = "pcs") {
  const value = Number(qty) || 0;
  const unit = symbol?.trim() || "pcs";
  return `${value} ${unit}`;
}

export function formatCurrency(amount, currency = "SAR") {
  const value = Number(amount) || 0;
  return `${value.toFixed(2)} ${currency}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const raw = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}(?: |T|$)/.test(raw)) {
    const datePart = raw.slice(0, 10);
    const [year, month, day] = datePart.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
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
  const tz = resolveBusinessTimezone(useSettingsStore.getState().settings);
  const instant = parseStoredTimestampToInstant(dateStr);
  if (instant) {
    return formatDateTimeInTimezone(instant, tz);
  }
  return String(dateStr);
}

/** Order/sale timestamps — always show in store region (default Asia/Riyadh). */
export function formatOrderDateTime(dateStr) {
  if (!dateStr) return "-";
  const settings = useSettingsStore.getState().settings;
  const tz = resolveBusinessTimezone(settings);
  const instant = parseStoredTimestampToInstant(dateStr);
  if (instant) {
    return formatDateTimeInTimezone(instant, tz);
  }
  return String(dateStr);
}

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function localDateISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local date and time as YYYY-MM-DD HH:mm:ss. */
export function localDateTimeISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${localDateISO(d)} ${h}:${min}:${s}`;
}

export function todayISO(date) {
  return localDateISO(date ?? new Date());
}

/** Date range for expense/accounting period filters. */
export function getPeriodDateRange(period, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  if (period === "daily") {
    const day = todayISOFromDate(ref);
    return { from: day, to: day };
  }

  if (period === "weekly") {
    const day = ref.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(ref);
    start.setDate(ref.getDate() + diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: todayISOFromDate(start), to: todayISOFromDate(end) };
  }

  if (period === "monthly") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { from: todayISOFromDate(start), to: todayISOFromDate(end) };
  }

  if (period === "yearly") {
    const start = new Date(ref.getFullYear(), 0, 1);
    const end = new Date(ref.getFullYear(), 11, 31);
    return { from: todayISOFromDate(start), to: todayISOFromDate(end) };
  }

  return { from: null, to: null };
}

function todayISOFromDate(date) {
  return localDateISO(date);
}

export function startOfMonthISO(referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  return localDateISO(new Date(ref.getFullYear(), ref.getMonth(), 1));
}

export function generateNumber(prefix) {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${ts}${rand}`;
}

export const INVOICE_NUMBER_PREFIX = "INV";

/** Format sequential invoice number, e.g. INV-1, INV-42 */
export function formatInvoiceNumber(sequence) {
  const num = Math.max(1, Number(sequence) || 1);
  return `${INVOICE_NUMBER_PREFIX}-${num}`;
}

/** Parse numeric suffix from INV-123 (case-insensitive). Returns null if not matched. */
export function parseInvoiceSequence(saleNumber) {
  const match = String(saleNumber ?? "").trim().match(/^INV-(\d+)$/i);
  if (!match) return null;
  return Number(match[1]);
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
