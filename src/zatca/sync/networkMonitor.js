/** Network connectivity helpers for ZATCA background sync. */

export function isOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function subscribeNetworkStatus(onChange) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
