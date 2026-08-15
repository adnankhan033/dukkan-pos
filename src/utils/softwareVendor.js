import {
  DEFAULT_SOFTWARE_VENDOR,
  VENDOR_SETTING_KEYS,
} from "../config/softwareVendor";

function settingBool(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return value !== "0" && value !== "false";
}

function pick(settings, key, fallback = "") {
  const raw = settings?.[key];
  if (raw === undefined || raw === null) return fallback;
  const trimmed = String(raw).trim();
  return trimmed || fallback;
}

export function resolveSoftwareVendor(settings = {}) {
  const companyName = pick(settings, VENDOR_SETTING_KEYS.COMPANY_NAME, DEFAULT_SOFTWARE_VENDOR.companyName);
  const menuLabel = pick(
    settings,
    VENDOR_SETTING_KEYS.MENU_LABEL,
    companyName || DEFAULT_SOFTWARE_VENDOR.menuLabel
  );

  return {
    enabled: settingBool(settings[VENDOR_SETTING_KEYS.ENABLED], DEFAULT_SOFTWARE_VENDOR.enabled),
    sidebarPulse: settingBool(
      settings[VENDOR_SETTING_KEYS.SIDEBAR_PULSE],
      DEFAULT_SOFTWARE_VENDOR.sidebarPulse
    ),
    menuLabel,
    companyName,
    companyNameAr: pick(settings, VENDOR_SETTING_KEYS.COMPANY_NAME_AR, DEFAULT_SOFTWARE_VENDOR.companyNameAr),
    tagline: pick(settings, VENDOR_SETTING_KEYS.TAGLINE, DEFAULT_SOFTWARE_VENDOR.tagline),
    taglineAr: pick(settings, VENDOR_SETTING_KEYS.TAGLINE_AR, DEFAULT_SOFTWARE_VENDOR.taglineAr),
    website: pick(settings, VENDOR_SETTING_KEYS.WEBSITE),
    email: pick(settings, VENDOR_SETTING_KEYS.EMAIL),
    phone: pick(settings, VENDOR_SETTING_KEYS.PHONE),
    whatsapp: pick(settings, VENDOR_SETTING_KEYS.WHATSAPP),
    address: pick(settings, VENDOR_SETTING_KEYS.ADDRESS),
    supportMessage: pick(
      settings,
      VENDOR_SETTING_KEYS.SUPPORT_MESSAGE,
      DEFAULT_SOFTWARE_VENDOR.supportMessage
    ),
    copyright: pick(settings, VENDOR_SETTING_KEYS.COPYRIGHT),
    initials: getVendorInitials(companyName || menuLabel),
    hasContact: Boolean(
      pick(settings, VENDOR_SETTING_KEYS.WEBSITE) ||
        pick(settings, VENDOR_SETTING_KEYS.EMAIL) ||
        pick(settings, VENDOR_SETTING_KEYS.PHONE) ||
        pick(settings, VENDOR_SETTING_KEYS.WHATSAPP)
    ),
    isConfigured: Boolean(companyName),
  };
}

export function getVendorInitials(name) {
  const parts = String(name || "SP")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "SP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
