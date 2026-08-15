/** Default email that receives new install activation keys. */
export const ACTIVATION_RECIPIENT_EMAIL = "dev.adnankhan@gmail.com";

/** Default super-admin credentials shown after local installation activation. */
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "9042@Admin02";

/**
 * Gmail credentials for sending activation keys.
 * Dev: create `.env.local` with VITE_ACTIVATION_GMAIL and VITE_ACTIVATION_GMAIL_APP_PASSWORD
 * Production build: same vars in `.env.production.local`, or Rust build env DUKKAN_ACTIVATION_*.
 */
export const ACTIVATION_SETTING_KEYS = {
  KEY: "system_activation_key",
  STATUS: "system_activation_status",
  DEVICE_ID: "system_device_id",
  EMAIL_SENT: "system_activation_email_sent",
  CREATED_AT: "system_activation_created_at",
  EMAIL_ERROR: "system_activation_email_error",
  GMAIL: "activation_gmail",
  GMAIL_APP_PASSWORD: "activation_gmail_app_password",
  CUSTOMER_NAME: "activation_customer_name",
  CUSTOMER_PHONE: "activation_customer_phone",
  CUSTOMER_STORE: "activation_customer_store",
  CUSTOMER_ADDRESS: "activation_customer_address",
  CUSTOMER_VAT: "activation_customer_vat",
  CUSTOMER_CR: "activation_customer_cr",
  REGISTRATION_STATUS: "installation_registration_status",
  MARKET_NAME: "activation_market_name",
  ACTIVATED_AT: "activation_activated_at",
  WELCOME_SHOWN: "welcome_shown",
};

export const ACTIVATION_STATUS = {
  PENDING: "pending",
  ACTIVATED: "activated",
};

export const REGISTRATION_STATUS = {
  PENDING: "pending",
  EMAIL_SENT: "email_sent",
  ACTIVATED: "activated",
};

/** Local installation registration (company details + activation key from email). */
export function isInstallationRegistered(settings) {
  return (
    settings?.[ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS] === REGISTRATION_STATUS.ACTIVATED
  );
}

/** Drupal market connection completed — unlocks sign-in and the app. */
export function isSystemActivated(settings) {
  return settings?.[ACTIVATION_SETTING_KEYS.STATUS] === ACTIVATION_STATUS.ACTIVATED;
}

export function normalizeActivationKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** Read Gmail app password from Vite env (16 chars, no spaces). */
export function resolveActivationSmtpFromEnv() {
  const gmail = String(import.meta.env.VITE_ACTIVATION_GMAIL || "").trim();
  const appPassword = String(import.meta.env.VITE_ACTIVATION_GMAIL_APP_PASSWORD || "")
    .replace(/\s+/g, "");
  if (!gmail || !appPassword) return null;
  return { gmail, appPassword };
}
