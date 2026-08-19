import { invoke, isTauri } from "@tauri-apps/api/core";
import { settingsService } from "./SettingsService";
import {
  BACKUP_SETTING_KEYS,
  decodeBackupSecret,
  encodeBackupSecret,
  normalizeGmailAppPassword,
} from "../utils/backupSettings.js";
import {
  ACTIVATION_RECIPIENT_EMAIL,
  ACTIVATION_SETTING_KEYS,
  ACTIVATION_STATUS,
  isSystemActivated,
  isValidActivationKey,
  normalizeActivationKey,
  REGISTRATION_STATUS,
  resolveActivationSenderEmail,
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

  async saveActivationEmailSettings({ gmail, appPassword }) {
    const address = String(gmail || resolveActivationSenderEmail()).trim();
    const password = normalizeGmailAppPassword(appPassword);
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
      throw new Error("Could not send email. Restart the app and try again.");
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
    hostname = "Nexttel POS",
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
      typeof hostname === "string" && hostname.trim() ? hostname.trim() : "Nexttel POS";

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
    if (!isValidActivationKey(normalized)) {
      throw new Error("Enter the 6-digit activation key from your email.");
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

  /** @deprecated Use activateLocalKey. */
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

  /** Clear setup progress so onboarding starts at step 1. */
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
      ACTIVATION_SETTING_KEYS.ACTIVATED_AT,
      ACTIVATION_SETTING_KEYS.WELCOME_SHOWN,
    ];

    await settingsService.removeMany(keys);
    return this.ensureSystemActivation(await settingsService.getAll());
  }
}

export const activationService = new ActivationService();
