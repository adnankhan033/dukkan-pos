export const PAYMENT_METHODS_CHANGED_EVENT = "nexttel-pos-payment-methods-changed";

export function dispatchPaymentMethodsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PAYMENT_METHODS_CHANGED_EVENT));
  }
}

export function onPaymentMethodsChanged(handler) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(PAYMENT_METHODS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(PAYMENT_METHODS_CHANGED_EVENT, handler);
}
