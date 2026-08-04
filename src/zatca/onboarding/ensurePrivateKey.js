import { ZATCA_SETTING_KEYS } from "../core/constants";
import { settingsService } from "../../services/SettingsService";
import {
  generateSecp256k1PrivateKeyPem,
  isValidPrivateKeyPem,
} from "./keyGenerator";

/**
 * Return an existing private key or generate and persist a new one locally.
 * Never overwrites a key that is already stored.
 */
export async function ensurePrivateKey({ settings, persist = true } = {}) {
  const keyName = ZATCA_SETTING_KEYS.PRIVATE_KEY;
  const stored = settings?.[keyName]?.trim() || "";

  if (stored && isValidPrivateKeyPem(stored)) {
    return { generated: false, privateKey: stored };
  }

  const privateKey = generateSecp256k1PrivateKeyPem();

  if (persist) {
    await settingsService.set(keyName, privateKey);
  }

  return { generated: true, privateKey };
}
