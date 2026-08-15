import { invoke, isTauri } from "@tauri-apps/api/core";
import { settingsService } from "./SettingsService";
import {
  BACKUP_SETTING_KEYS,
  decodeBackupSecret,
  encodeBackupSecret,
  normalizeGmailAppPassword,
} from "../utils/backupSettings.js";
import { API_SETTING_KEYS, API_PATH_PREFIX, normalizeApiBaseUrl } from "../api/apiConfig";
import {
  ACTIVATION_RECIPIENT_EMAIL,
  ACTIVATION_SETTING_KEYS,
  ACTIVATION_STATUS,
  isSystemActivated,
  normalizeActivationKey,
  REGISTRATION_STATUS,
  resolveActivationSmtpFromEnv,
} from "../utils/activationConfig";

class ActivationService {
  async activateWithDrupal(apiBaseUrl, activationKey) {
    const base = normalizeApiBaseUrl(apiBaseUrl);
    const key = normalizeActivationKey(activationKey);

    if (!base) {
      throw new Error("Server URL is required. Enter your Drupal market site address.");
    }
    if (!key) {
      throw new Error("Activation key is required.");
    }

    const response = await fetch(`${base}${API_PATH_PREFIX}/activate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify({ activation_key: key }),
    });

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        (response.status === 403
          ? "Invalid activation key. Check the key from Market setup in Drupal admin."
          : `Could not connect (${response.status}). Check the server URL and try again.`);
      throw new Error(message);
    }

    if (!data?.valid) {
      throw new Error("Activation was rejected by the server.");
    }

    await settingsService.set(API_SETTING_KEYS.BASE_URL, base);
    await settingsService.set(ACTIVATION_SETTING_KEYS.STATUS, ACTIVATION_STATUS.ACTIVATED);
    await settingsService.set(ACTIVATION_SETTING_KEYS.KEY, key);
    await settingsService.set(
      ACTIVATION_SETTING_KEYS.MARKET_NAME,
      data.market_name || data.store?.store_name || ""
    );
    await settingsService.set(ACTIVATION_SETTING_KEYS.ACTIVATED_AT, new Date().toISOString());

    if (data.terminal_code) {
      await settingsService.set(API_SETTING_KEYS.TERMINAL_CODE, String(data.terminal_code));
    }

    if (data.store && typeof data.store === "object") {
      for (const [settingKey, value] of Object.entries(data.store)) {
        if (value !== undefined && value !== null) {
          await settingsService.set(settingKey, String(value));
        }
      }
    }

    const settings = await settingsService.getAll();
    return {
      settings,
      marketName: data.market_name || data.store?.store_name || "",
      apiUrl: base,
    };
  }

  /** @deprecated Local email activation — use activateWithDrupal for Drupal-backed markets. */
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

  async saveActivationEmailSettings({ gmail, appPassword }) {
    const address = String(gmail || "").trim();
    const password = normalizeGmailAppPassword(appPassword);
    if (!address) {
      throw new Error("Sender Gmail address is required.");
    }
    if (!password) {
      throw new Error("Gmail App Password is required (16 characters from Google Account → App passwords).");
    }
    if (password.length !== 16) {
      throw new Error("Gmail App Password must be 16 characters (spaces removed).");
    }
    await settingsService.set(ACTIVATION_SETTING_KEYS.GMAIL, address);
    await settingsService.set(
      ACTIVATION_SETTING_KEYS.GMAIL_APP_PASSWORD,
      encodeBackupSecret(password)
    );
    return settingsService.getAll();
  }

  async ensureSystemActivation(existingSettings = null) {
    let settings = existingSettings || (await settingsService.getAll());
    settings = await this.clearLegacyDrupalSetup(settings);

    if (
      settings[ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS] === REGISTRATION_STATUS.ACTIVATED &&
      settings[ACTIVATION_SETTING_KEYS.STATUS] !== ACTIVATION_STATUS.ACTIVATED
    ) {
      await settingsService.set(ACTIVATION_SETTING_KEYS.STATUS, ACTIVATION_STATUS.ACTIVATED);
      settings = await settingsService.getAll();
    }

    const hasKey = Boolean(settings[ACTIVATION_SETTING_KEYS.KEY]?.trim());
    const hasDevice = Boolean(settings[ACTIVATION_SETTING_KEYS.DEVICE_ID]?.trim());

    if (hasKey && hasDevice) {
      return settings;
    }

    if (!isTauri()) {
      return settings;
    }

    try {
      const info = await invoke("generate_system_activation");
      if (info?.device_id) {
        await settingsService.set(ACTIVATION_SETTING_KEYS.DEVICE_ID, info.device_id);
      }
      if (info?.activation_key) {
        await settingsService.set(ACTIVATION_SETTING_KEYS.KEY, info.activation_key);
      }
      if (info?.hostname) {
        await settingsService.set("system_hostname", info.hostname);
      }
      if (!settings[ACTIVATION_SETTING_KEYS.CREATED_AT]) {
        await settingsService.set(
          ACTIVATION_SETTING_KEYS.CREATED_AT,
          new Date().toISOString()
        );
      }
      if (!settings[ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS]) {
        await settingsService.set(
          ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS,
          REGISTRATION_STATUS.PENDING
        );
      }
      return settingsService.getAll();
    } catch (err) {
      console.warn("Could not generate system activation:", err);
      return settings;
    }
  }

  async regenerateActivationCredentials() {
    if (!isTauri()) {
      throw new Error("Activation key generation is only available in the desktop app.");
    }

    const info = await invoke("generate_system_activation");
    if (info?.device_id) {
      await settingsService.set(ACTIVATION_SETTING_KEYS.DEVICE_ID, info.device_id);
    }
    if (info?.activation_key) {
      await settingsService.set(ACTIVATION_SETTING_KEYS.KEY, info.activation_key);
    }
    if (info?.hostname) {
      await settingsService.set("system_hostname", info.hostname);
    }
    await settingsService.set(
      ACTIVATION_SETTING_KEYS.CREATED_AT,
      new Date().toISOString()
    );
    return settingsService.getAll();
  }

  /** Remove old Drupal market connection so local store setup always starts at step 1. */
  async clearLegacyDrupalSetup(settings = null) {
    const all = settings || (await settingsService.getAll());
    const hasLegacyDrupal = Boolean(
      all[API_SETTING_KEYS.BASE_URL]?.trim() ||
      all[ACTIVATION_SETTING_KEYS.MARKET_NAME]?.trim()
    );
    if (!hasLegacyDrupal) {
      return all;
    }
    await settingsService.removeMany([
      API_SETTING_KEYS.BASE_URL,
      ACTIVATION_SETTING_KEYS.MARKET_NAME,
      ACTIVATION_SETTING_KEYS.STATUS,
      ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS,
      ACTIVATION_SETTING_KEYS.EMAIL_SENT,
      ACTIVATION_SETTING_KEYS.EMAIL_ERROR,
      ACTIVATION_SETTING_KEYS.ACTIVATED_AT,
      ACTIVATION_SETTING_KEYS.WELCOME_SHOWN,
    ]);
    return this.ensureSystemActivation(await settingsService.getAll());
  }

  async submitRegistration({ storeName, phone, address, gmail, appPassword }) {
    const customerStore = String(storeName || "").trim();
    const customerPhone = String(phone || "").trim();
    const customerAddress = String(address || "").trim();

    if (!customerStore) throw new Error("Store name is required.");
    if (!customerPhone) throw new Error("Phone number is required.");
    if (!customerAddress) throw new Error("Address is required.");

    const smtpReady = await this.resolveSmtpCredentials();
    if (!smtpReady && gmail && appPassword) {
      await this.saveActivationEmailSettings({ gmail, appPassword });
    } else if (!smtpReady) {
      throw new Error(
        "Email is not configured. Enter your Gmail and App Password below, then submit again."
      );
    }

    let settings = await this.regenerateActivationCredentials();

    await settingsService.set(ACTIVATION_SETTING_KEYS.CUSTOMER_STORE, customerStore);
    await settingsService.set(ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE, customerPhone);
    await settingsService.set(ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS, customerAddress);
    await settingsService.set("store_name", customerStore);
    await settingsService.set("store_address", customerAddress);
    await settingsService.set("store_phone", customerPhone);
    await settingsService.set(
      ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS,
      REGISTRATION_STATUS.PENDING
    );

    settings = await settingsService.getAll();
    const deviceId = settings[ACTIVATION_SETTING_KEYS.DEVICE_ID];
    const activationKey = settings[ACTIVATION_SETTING_KEYS.KEY];

    if (!deviceId || !activationKey) {
      throw new Error("Could not generate activation key. Restart the app and try again.");
    }

    const result = await this.sendActivationEmail({
      deviceId,
      activationKey,
      hostname: settings.system_hostname,
      storeName: customerStore,
      storeAddress: customerAddress,
      customerPhone: customerPhone,
    });

    await settingsService.set(
      ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS,
      result.success ? REGISTRATION_STATUS.EMAIL_SENT : REGISTRATION_STATUS.PENDING
    );

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
    vatNumber = "",
    crNumber = "",
  }) {
    if (!isTauri()) {
      throw new Error("Activation email is only available in the desktop app.");
    }

    const hostLabel =
      typeof hostname === "string" && hostname.trim() ? hostname.trim() : "DukkanPOS";

    const smtp = await this.resolveSmtpCredentials();

    try {
      await invoke("send_activation_email", {
        recipient,
        deviceId,
        activationKey,
        hostname: hostLabel,
        gmail: smtp?.gmail,
        appPassword: smtp?.appPassword,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        storeName: storeName || undefined,
        storeAddress: storeAddress || undefined,
        vatNumber: vatNumber || undefined,
        crNumber: crNumber || undefined,
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

  async activateLocalKey(enteredKey) {
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

    await settingsService.set(
      ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS,
      REGISTRATION_STATUS.ACTIVATED
    );
    await settingsService.set(ACTIVATION_SETTING_KEYS.STATUS, ACTIVATION_STATUS.ACTIVATED);
    await settingsService.set(ACTIVATION_SETTING_KEYS.ACTIVATED_AT, new Date().toISOString());

    const storeName = (await settingsService.get(ACTIVATION_SETTING_KEYS.CUSTOMER_STORE)).trim();
    const storeAddress = (await settingsService.get(ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS)).trim();
    const storePhone = (await settingsService.get(ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE)).trim();
    if (storeName) await settingsService.set("store_name", storeName);
    if (storeAddress) await settingsService.set("store_address", storeAddress);
    if (storePhone) await settingsService.set("store_phone", storePhone);

    const { userService } = await import("./UserService.js");
    await userService.ensureDefaultAdminPassword();

    return {
      settings: await settingsService.getAll(),
    };
  }

  /** @deprecated Use activateLocalKey for installation; activateWithDrupal for market connection. */
  async activate(enteredKey) {
    const result = await this.activateLocalKey(enteredKey);
    await settingsService.set(ACTIVATION_SETTING_KEYS.STATUS, ACTIVATION_STATUS.ACTIVATED);
    return result.settings;
  }

  async getActivationState() {
    const settings = await settingsService.getAll();
    return {
      activated: isSystemActivated(settings),
      registered: settings[ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS] === REGISTRATION_STATUS.ACTIVATED,
      registrationStatus: settings[ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS] || REGISTRATION_STATUS.PENDING,
      deviceId: settings[ACTIVATION_SETTING_KEYS.DEVICE_ID] || "",
      emailSent: settings[ACTIVATION_SETTING_KEYS.EMAIL_SENT] === "1",
      emailError: settings[ACTIVATION_SETTING_KEYS.EMAIL_ERROR] || "",
      recipient: ACTIVATION_RECIPIENT_EMAIL,
    };
  }

  /** Clear setup progress and Drupal connection so onboarding starts at step 1. */
  async resetInstallationSetup() {
    const keys = [
      ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS,
      ACTIVATION_SETTING_KEYS.STATUS,
      ACTIVATION_SETTING_KEYS.KEY,
      ACTIVATION_SETTING_KEYS.DEVICE_ID,
      ACTIVATION_SETTING_KEYS.EMAIL_SENT,
      ACTIVATION_SETTING_KEYS.EMAIL_ERROR,
      ACTIVATION_SETTING_KEYS.CREATED_AT,
      ACTIVATION_SETTING_KEYS.CUSTOMER_NAME,
      ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE,
      ACTIVATION_SETTING_KEYS.CUSTOMER_STORE,
      ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS,
      ACTIVATION_SETTING_KEYS.CUSTOMER_VAT,
      ACTIVATION_SETTING_KEYS.CUSTOMER_CR,
      ACTIVATION_SETTING_KEYS.MARKET_NAME,
      ACTIVATION_SETTING_KEYS.ACTIVATED_AT,
      ACTIVATION_SETTING_KEYS.WELCOME_SHOWN,
      API_SETTING_KEYS.BASE_URL,
    ];

    await settingsService.removeMany(keys);
    return this.ensureSystemActivation(await settingsService.getAll());
  }
}

export const activationService = new ActivationService();
