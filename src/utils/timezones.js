/** Common regions for Saudi/GCC baqala and international use. */
export const DEFAULT_BUSINESS_TIMEZONE = "Asia/Riyadh";

export const BUSINESS_TIMEZONES = [
  { id: "Asia/Riyadh", label: "Saudi Arabia — Riyadh", labelAr: "السعودية — الرياض", default: true },
  { id: "Asia/Dubai", label: "UAE — Dubai", labelAr: "الإمارات — دبي" },
  { id: "Asia/Kuwait", label: "Kuwait", labelAr: "الكويت" },
  { id: "Asia/Qatar", label: "Qatar — Doha", labelAr: "قطر — الدوحة" },
  { id: "Asia/Bahrain", label: "Bahrain", labelAr: "البحرين" },
  { id: "Asia/Muscat", label: "Oman — Muscat", labelAr: "عُمان — مسقط" },
  { id: "Africa/Cairo", label: "Egypt — Cairo", labelAr: "مصر — القاهرة" },
  { id: "Asia/Amman", label: "Jordan — Amman", labelAr: "الأردن — عمّان" },
  { id: "Asia/Karachi", label: "Pakistan — Karachi", labelAr: "باكستان — كراتشي" },
  { id: "Asia/Kolkata", label: "India — Kolkata", labelAr: "الهند" },
  { id: "Europe/London", label: "United Kingdom — London", labelAr: "المملكة المتحدة" },
  { id: "America/New_York", label: "USA — New York (EST)", labelAr: "أمريكا — نيويورك" },
  { id: "UTC", label: "UTC", labelAr: "UTC" },
];

export function getTimezoneOption(id) {
  return BUSINESS_TIMEZONES.find((t) => t.id === id) || BUSINESS_TIMEZONES[0];
}

export function resolveBusinessTimezone(settings) {
  const tz = settings?.business_timezone?.trim();
  if (tz && BUSINESS_TIMEZONES.some((t) => t.id === tz)) return tz;
  return DEFAULT_BUSINESS_TIMEZONE;
}

/** Calendar + clock parts in a specific IANA timezone. */
export function getDateTimePartsInTimezone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function formatDateTimeInTimezone(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function toTimezoneDateISO(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toTimezoneDateTimeISO(parts) {
  return `${toTimezoneDateISO(parts)} ${parts.hour}:${parts.minute}:${parts.second}`;
}
