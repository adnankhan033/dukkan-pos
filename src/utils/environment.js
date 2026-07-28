import { isTauri } from "@tauri-apps/api/core";

/** True when running inside the Portal POS desktop window (not a regular browser tab). */
export function isDesktopApp() {
  try {
    return isTauri();
  } catch {
    return false;
  }
}
