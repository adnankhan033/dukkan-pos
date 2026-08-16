/** Tracks an active OS print dialog so window-close is not treated as quitting the app. */

let activePrintSessions = 0;

export function beginPrintSession() {
  activePrintSessions += 1;
}

export function endPrintSession() {
  activePrintSessions = Math.max(0, activePrintSessions - 1);
}

export function isPrintSessionActive() {
  return activePrintSessions > 0;
}
