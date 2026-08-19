/** Product identity — same values on macOS and Windows. Paths are resolved per OS at runtime. */

export const APP_NAME = "Nexttel POS";
export const APP_NAME_COMPACT = "NexttelPOS";
export const APP_SLUG = "nexttel-pos";
export const APP_IDENTIFIER = "com.sharedtechadnan.nexttel-pos";
export const DB_FILE = "nexttel_pos.db";
export const DB_NAME = `sqlite:${DB_FILE}`;
export const BACKUP_FOLDER_NAME = APP_NAME_COMPACT;

function isWindowsRuntime() {
  if (typeof process !== "undefined" && process.platform === "win32") return true;
  if (typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent || "")) return true;
  return false;
}

/** Placeholder shown before the desktop app reports the real folder. */
export function backupFolderHint() {
  if (isWindowsRuntime()) {
    return `%USERPROFILE%\\Documents\\${BACKUP_FOLDER_NAME}\\backups`;
  }
  return `Documents/${BACKUP_FOLDER_NAME}/backups`;
}
