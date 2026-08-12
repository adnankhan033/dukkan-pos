import {
  resolveBusinessTimezone,
  getDateTimePartsInTimezone,
  toTimezoneDateISO,
} from "./timezones";

export const BACKUP_SETTING_KEYS = {
  GMAIL_ENABLED: "backup_gmail_enabled",
  GMAIL_ADDRESS: "backup_gmail_address",
  GMAIL_APP_PASSWORD: "backup_gmail_app_password",
  GMAIL_RECIPIENT: "backup_gmail_recipient",
  DAILY_TIME: "backup_daily_time",
  LAST_AUTO_DATE: "backup_last_auto_date",
};

export const BACKUP_TYPES = {
  MANUAL_EMAIL: "manual_email",
  DAILY_EMAIL: "daily_email",
  DAILY_LOCAL: "daily_local",
  DOWNLOAD: "download",
};

export const DEFAULT_BACKUP_DAILY_TIME = "23:00";

export function isBackupEmailEnabled(settings = {}) {
  return settings[BACKUP_SETTING_KEYS.GMAIL_ENABLED] === "1";
}

export function getBackupBusinessDateKey(settings = {}, now = new Date()) {
  const tz = resolveBusinessTimezone(settings);
  const parts = getDateTimePartsInTimezone(now, tz);
  return toTimezoneDateISO(parts);
}

export function encodeBackupSecret(value) {
  if (!value) return "";
  return btoa(unescape(encodeURIComponent(normalizeGmailAppPassword(value))));
}

export function decodeBackupSecret(value) {
  if (!value) return "";
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return "";
  }
}

/** Gmail app passwords are 16 chars; Google often displays them with spaces. */
export function normalizeGmailAppPassword(value) {
  return String(value || "").replace(/\s+/g, "");
}

export function formatBackupFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function backupTypeLabel(type) {
  switch (type) {
    case BACKUP_TYPES.MANUAL_EMAIL:
      return "Full Backup";
    case BACKUP_TYPES.DAILY_EMAIL:
      return "Daily Gmail";
    case BACKUP_TYPES.DAILY_LOCAL:
      return "Daily Local";
    case BACKUP_TYPES.DOWNLOAD:
      return "Local Download";
    default:
      return type || "Unknown";
  }
}

export function isDailyBackupDue(settings = {}, now = new Date()) {
  if (!isBackupEmailEnabled(settings)) return false;

  const address = settings[BACKUP_SETTING_KEYS.GMAIL_ADDRESS]?.trim();
  const password = decodeBackupSecret(settings[BACKUP_SETTING_KEYS.GMAIL_APP_PASSWORD]);
  if (!address || !password) return false;

  const dailyTime = settings[BACKUP_SETTING_KEYS.DAILY_TIME]?.trim() || DEFAULT_BACKUP_DAILY_TIME;
  const [hourStr, minuteStr] = dailyTime.split(":");
  const targetHour = Number(hourStr);
  const targetMinute = Number(minuteStr);
  if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) return false;

  const todayKey = getBackupBusinessDateKey(settings, now);
  const lastAutoDate = settings[BACKUP_SETTING_KEYS.LAST_AUTO_DATE]?.trim();
  if (lastAutoDate === todayKey) return false;

  const tz = resolveBusinessTimezone(settings);
  const parts = getDateTimePartsInTimezone(now, tz);
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const targetMinutes = targetHour * 60 + targetMinute;
  return currentMinutes >= targetMinutes;
}
