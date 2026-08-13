import { apiClient } from "./ApiClient";
import { settingsService } from "../services/SettingsService";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { normalizeUser } from "./drupalMode";
import {
  bootstrapCatalogRevision,
  invalidateProductCaches,
  setKnownCatalogRevision,
} from "../services/CatalogSync";

const SESSION_VERIFY_SKIP_MS = 15000;
let sessionBootstrappedAt = 0;

export function markDrupalSessionBootstrapped() {
  sessionBootstrappedAt = Date.now();
}

function shouldSkipSessionVerify() {
  return Date.now() - sessionBootstrappedAt < SESSION_VERIFY_SKIP_MS;
}

/**
 * After Drupal login: verify session, pull store settings, refresh profile, clear stale caches.
 * Products, orders, and users are always loaded live from Drupal API (not copied to SQLite).
 */
export async function bootstrapDrupalSession({ invalidateCaches = true } = {}) {
  const [me, remoteSettings] = await Promise.all([
    apiClient.getMe(),
    apiClient.getSettingsRemote(),
  ]);
  const merged = await settingsService.updateMany(remoteSettings);
  useSettingsStore.getState().setSettings(merged);

  const auth = useAuthStore.getState();
  if (me?.user) {
    auth.setDrupalProfile(normalizeUser(me.user), me.terminal ?? auth.terminal);
  }

  if (invalidateCaches) {
    invalidateProductCaches();
    setKnownCatalogRevision(null);
  }

  await bootstrapCatalogRevision();

  markDrupalSessionBootstrapped();
  return { settings: merged, user: me?.user, terminal: me?.terminal };
}

/** Re-verify JWT on app load; throws if session expired. */
export async function verifyDrupalSession() {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  if (shouldSkipSessionVerify()) return null;
  return bootstrapDrupalSession({ invalidateCaches: false });
}
