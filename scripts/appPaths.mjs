/**
 * OS-specific app folders. Tauri stores sqlite under the config dir:
 *   macOS:   ~/Library/Application Support/<identifier>/
 *   Windows: %APPDATA%\<identifier>\
 *   Linux:   ~/.config/<identifier>/
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  APP_IDENTIFIER,
  APP_NAME_COMPACT,
  DB_FILE,
} from "../src/utils/appIdentity.js";

function home() {
  return homedir();
}

export function candidateAppDataDirs() {
  const id = APP_IDENTIFIER;
  const h = home();

  if (process.platform === "win32") {
    const roaming = process.env.APPDATA || join(h, "AppData", "Roaming");
    const local = process.env.LOCALAPPDATA || join(h, "AppData", "Local");
    return [join(roaming, id), join(local, id)];
  }

  if (process.platform === "darwin") {
    return [join(h, "Library", "Application Support", id)];
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME || join(h, ".config");
  const xdgData = process.env.XDG_DATA_HOME || join(h, ".local", "share");
  return [join(xdgConfig, id), join(xdgData, id)];
}

export function candidateSqliteDbPaths() {
  return candidateAppDataDirs().map((dir) => join(dir, DB_FILE));
}

export function resolveSqliteDbPath() {
  const paths = candidateSqliteDbPaths();
  return paths.find((path) => existsSync(path)) || paths[0];
}

export function resolveBackupFolderPath() {
  const h = home();
  const documents =
    process.platform === "win32"
      ? join(process.env.USERPROFILE || h, "Documents")
      : join(h, "Documents");
  return join(documents, APP_NAME_COMPACT, "backups");
}
