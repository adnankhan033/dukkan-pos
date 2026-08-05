import { isTauri } from "@tauri-apps/api/core";

/** True when running inside the DukkanPOS desktop window (not a regular browser tab). */
export function isDesktopApp() {
  try {
    return isTauri();
  } catch {
    return false;
  }
}
