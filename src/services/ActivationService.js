import { invoke, isTauri } from "@tauri-apps/api/core";
import { settingsService } from "./SettingsService";
import {
  BACKUP_SETTING_KEYS,
  decodeBackupSecret,
  normalizeGmailAppPassword,
} from "../utils/backupSettings.js";
import {
  ACTIVATION_RECIPIENT_EMAIL,
  ACTIVATION_SETTING_KEYS,
  ACTIVATION_STATUS,
  isSystemActivated,
  normalizeActivationKey,
  resolveActivationSmtpFromEnv,
} from "../utils/activationConfig";

class ActivationService {
  async resolveSmtpCredentials(settings = null) {
    const fromEnv = resolveActivationSmtpFromEnv();
    if (fromEnv) return fromEnv;

    const all = settings || (await settingsService.getAll());

    const activationGmail = all[ACTIVATION_SETTING_KEYS.GMAIL]?.trim();
    const activationPassword = decodeBackupSecret(
      all[ACTIVATION_SETTING_KEYS.GMAIL_APP_PASSWORD]
    );
    if (activationGmail && activationPassword) {
      return {
        gmail: activationGmail,
        appPassword: normalizeGmailAppPassword(activationPassword),
      };
    }

    const backupGmail = all[BACKUP_SETTING_KEYS.GMAIL_ADDRESS]?.trim();
    const backupPassword = decodeBackupSecret(
      all[BACKUP_SETTING_KEYS.GMAIL_APP_PASSWORD]
    );
    if (backupGmail && backupPassword) {
      return {
        gmail: backupGmail,
        appPassword: normalizeGmailAppPassword(backupPassword),
      };
    }

    return null;
  }
  async ensureSystemActivation(existingSettings = null) {
    const settings = existingSettings || (await settingsService.getAll());
    if (isSystemActivated(settings)) {
      return settings;
    }

    let activationKey = settings[ACTIVATION_SETTING_KEYS.KEY];
    let deviceId = settings[ACTIVATION_SETTING_KEYS.DEVICE_ID];

    if (!activationKey || !deviceId) {
      if (!isTauri()) {
        throw new Error("System activation requires the DukkanPOS desktop app.");
      }

      const generated = await invoke("generate_system_activation");
      activationKey = generated.activation_key;
      deviceId = generated.device_id;

      await settingsService.set(ACTIVATION_SETTING_KEYS.KEY, activationKey);
      await settingsService.set(ACTIVATION_SETTING_KEYS.DEVICE_ID, deviceId);
      await settingsService.set("system_hostname", generated.hostname || "DukkanPOS");
      await settingsService.set(ACTIVATION_SETTING_KEYS.STATUS, ACTIVATION_STATUS.PENDING);
      await settingsService.set(
        ACTIVATION_SETTING_KEYS.CREATED_AT,
        new Date().toISOString()
      );
    } else if (!settings[ACTIVATION_SETTING_KEYS.STATUS]) {
      await settingsService.set(ACTIVATION_SETTING_KEYS.STATUS, ACTIVATION_STATUS.PENDING);
    }

    const latest = await settingsService.getAll();
    return latest;
  }

  async submitRegistration({ name, phone, storeName, address }) {
    const customerName = String(name || "").trim();
    const customerPhone = String(phone || "").trim();
    const customerStore = String(storeName || "").trim();
    const customerAddress = String(address || "").trim();

    if (!customerName) throw new Error("Name is required.");
    if (!customerPhone) throw new Error("Phone number is required.");
    if (!customerStore) throw new Error("Store name is required.");
    if (!customerAddress) throw new Error("Address is required.");

    await settingsService.set(ACTIVATION_SETTING_KEYS.CUSTOMER_NAME, customerName);
    await settingsService.set(ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE, customerPhone);
    await settingsService.set(ACTIVATION_SETTING_KEYS.CUSTOMER_STORE, customerStore);
    await settingsService.set(ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS, customerAddress);

    const settings = await settingsService.getAll();
    const deviceId = settings[ACTIVATION_SETTING_KEYS.DEVICE_ID];
    const activationKey = settings[ACTIVATION_SETTING_KEYS.KEY];

    if (!deviceId || !activationKey) {
      throw new Error("System activation is not ready. Restart the app and try again.");
    }

    const result = await this.sendActivationEmail({
      deviceId,
      activationKey,
      hostname: settings.system_hostname,
      customerName,
      customerPhone,
      storeName: customerStore,
      storeAddress: customerAddress,
    });

    const updated = await settingsService.getAll();
    return { settings: updated, emailSent: result.success, emailError: result.error };
  }

  async sendActivationEmail({
    deviceId,
    activationKey,
    recipient = ACTIVATION_RECIPIENT_EMAIL,
    hostname = "DukkanPOS",
    customerName = "",
    customerPhone = "",
    storeName = "",
    storeAddress = "",
  }) {
    if (!isTauri()) {
      throw new Error("Activation email is only available in the desktop app.");
    }

    const hostLabel =
      typeof hostname === "string" && hostname.trim() ? hostname.trim() : "DukkanPOS";

    const smtp = await this.resolveSmtpCredentials();
    if (!smtp) {
      const message =
        "Activation email is not configured. Create .env.local with VITE_ACTIVATION_GMAIL and VITE_ACTIVATION_GMAIL_APP_PASSWORD (Google App Password), then restart the app.";
      await settingsService.set(ACTIVATION_SETTING_KEYS.EMAIL_SENT, "0");
      await settingsService.set(ACTIVATION_SETTING_KEYS.EMAIL_ERROR, message);
      return { success: false, error: message };
    }

    try {
      await invoke("send_activation_email", {
        recipient,
        deviceId,
        activationKey,
        hostname: hostLabel,
        gmail: smtp.gmail,
        appPassword: smtp.appPassword,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        storeName: storeName || undefined,
        storeAddress: storeAddress || undefined,
      });
      await settingsService.set(ACTIVATION_SETTING_KEYS.EMAIL_SENT, "1");
      await settingsService.set(ACTIVATION_SETTING_KEYS.EMAIL_ERROR, "");
      return { success: true };
    } catch (err) {
      const message = err?.message || String(err);
      await settingsService.set(ACTIVATION_SETTING_KEYS.EMAIL_SENT, "0");
      await settingsService.set(ACTIVATION_SETTING_KEYS.EMAIL_ERROR, message);
      return { success: false, error: message };
    }
  }

  async activate(enteredKey) {
    const normalized = normalizeActivationKey(enteredKey);
    if (!normalized) {
      throw new Error("Activation key is required.");
    }

    const storedKey = normalizeActivationKey(
      await settingsService.get(ACTIVATION_SETTING_KEYS.KEY)
    );
    if (!storedKey) {
      throw new Error("No activation key found for this installation. Restart the app.");
    }
    if (normalized !== storedKey) {
      throw new Error("Invalid activation key. Check the key sent to your email.");
    }

    await settingsService.set(ACTIVATION_SETTING_KEYS.STATUS, ACTIVATION_STATUS.ACTIVATED);

    const storeName = (await settingsService.get(ACTIVATION_SETTING_KEYS.CUSTOMER_STORE)).trim();
    const storeAddress = (await settingsService.get(ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS)).trim();
    if (storeName) await settingsService.set("store_name", storeName);
    if (storeAddress) await settingsService.set("store_address", storeAddress);

    return settingsService.getAll();
  }

  async getActivationState() {
    const settings = await settingsService.getAll();
    return {
      activated: isSystemActivated(settings),
      deviceId: settings[ACTIVATION_SETTING_KEYS.DEVICE_ID] || "",
      emailSent: settings[ACTIVATION_SETTING_KEYS.EMAIL_SENT] === "1",
      emailError: settings[ACTIVATION_SETTING_KEYS.EMAIL_ERROR] || "",
      recipient: ACTIVATION_RECIPIENT_EMAIL,
    };
  }
}

export const activationService = new ActivationService();
