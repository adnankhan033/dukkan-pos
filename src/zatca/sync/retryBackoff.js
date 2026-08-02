/** Retry delays after each failure: 1m → 5m → 15m → 30m → 60m */
export const ZATCA_RETRY_BACKOFF_MINUTES = [1, 5, 15, 30, 60];

export function computeNextRetryAt(retryCount) {
  const attempt = Math.max(1, Number(retryCount) || 1);
  const index = Math.min(attempt, ZATCA_RETRY_BACKOFF_MINUTES.length) - 1;
  const minutes = ZATCA_RETRY_BACKOFF_MINUTES[index];
  const d = new Date(Date.now() + minutes * 60 * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function formatRetryWait(nextRetryAt) {
  if (!nextRetryAt) return null;
  const ms = new Date(nextRetryAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60000);
  return minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} hr`;
}
