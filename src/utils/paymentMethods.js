import { PAYMENT_METHODS } from "./constants";

const FALLBACK_LABELS = {
  [PAYMENT_METHODS.CASH]: { en: "Cash", ar: "كاش" },
  [PAYMENT_METHODS.CARD]: { en: "Card", ar: "بطاقة" },
  [PAYMENT_METHODS.PAY_LATER]: { en: "Pay Later", ar: "آجل" },
  transfer: { en: "Transfer", ar: "تحويل" },
};

export function slugifyPaymentCode(label) {
  const base = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return base || "method";
}

export function paymentMethodCollectsCash(method) {
  return Number(method?.collect_cash ?? 0) === 1;
}

export function paymentMethodRequiresCustomer(method) {
  return String(method?.code || "").toLowerCase() === PAYMENT_METHODS.PAY_LATER;
}

export function isPayLaterMethod(code) {
  return String(code || "").toLowerCase() === PAYMENT_METHODS.PAY_LATER;
}

export function resolvePaymentMethodLabel(code, methods = []) {
  const key = String(code || PAYMENT_METHODS.CASH).toLowerCase();
  const match = methods.find((m) => String(m.code).toLowerCase() === key);
  if (match?.label) return match.label;
  return FALLBACK_LABELS[key]?.en || key.replace(/_/g, " ");
}

export function resolvePaymentMethodLabelBilingual(code, methods = []) {
  const key = String(code || PAYMENT_METHODS.CASH).toLowerCase();
  const match = methods.find((m) => String(m.code).toLowerCase() === key);
  if (match?.label) {
    return match.label_ar ? `${match.label} / ${match.label_ar}` : match.label;
  }
  const fallback = FALLBACK_LABELS[key];
  if (!fallback) return key.replace(/_/g, " ");
  return `${fallback.en} / ${fallback.ar}`;
}

export function buildPaymentMethodLabelMap(methods = []) {
  const map = {};
  for (const method of methods) {
    map[String(method.code).toLowerCase()] = method.label;
  }
  return map;
}
