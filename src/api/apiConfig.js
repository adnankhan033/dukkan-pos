/** Settings keys for Drupal backend connection. */
export const API_SETTING_KEYS = {
  BASE_URL: "api_base_url",
  TERMINAL_CODE: "terminal_code",
};

export const API_PATH_PREFIX = "/api/dukkan-pos/v1";

/** Default Lando URL for local dev (override in .env.local). */
export const DEFAULT_DRUPAL_API_URL = "http://dukkan-pos-backend.lndo.site";

export function normalizeApiBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

/** Env → saved settings → built-in dev default. */
export function resolveApiBaseUrl(settings) {
  const fromSettings = normalizeApiBaseUrl(settings?.[API_SETTING_KEYS.BASE_URL]);
  if (fromSettings) return fromSettings;

  const fromEnv = normalizeApiBaseUrl(import.meta.env.VITE_DRUPAL_API_URL);
  if (fromEnv) return fromEnv;

  if (import.meta.env.DEV) {
    return normalizeApiBaseUrl(DEFAULT_DRUPAL_API_URL);
  }

  return "";
}

export function isDrupalConfigured(settings) {
  return Boolean(resolveApiBaseUrl(settings));
}

/** Merge resolved API URL into settings object for API calls. */
export function withResolvedApiUrl(settings = {}) {
  const api_base_url = resolveApiBaseUrl(settings);
  if (!api_base_url || api_base_url === normalizeApiBaseUrl(settings.api_base_url)) {
    return settings;
  }
  return { ...settings, api_base_url };
}

/** Persist env/default URL into SQLite when missing (dev convenience). */
export async function ensureApiUrlInSettings(settings, settingsService) {
  const resolved = resolveApiBaseUrl(settings);
  if (!resolved) return settings;

  if (normalizeApiBaseUrl(settings?.api_base_url) === resolved) {
    return settings;
  }

  await settingsService.set(API_SETTING_KEYS.BASE_URL, resolved);
  return settingsService.getAll();
}
