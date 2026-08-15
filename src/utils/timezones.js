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

function normalizeClockHour(hour) {
  const h = String(hour ?? "00").padStart(2, "0");
  return h === "24" ? "00" : h;
}

/** Fixed offsets for regions without DST (GCC / common business zones). */
const TIMEZONE_OFFSETS = {
  "Asia/Riyadh": "+03:00",
  "Asia/Dubai": "+04:00",
  "Asia/Kuwait": "+03:00",
  "Asia/Qatar": "+03:00",
  "Asia/Bahrain": "+03:00",
  "Asia/Muscat": "+04:00",
  "Africa/Cairo": "+02:00",
  "Asia/Amman": "+03:00",
  "Asia/Karachi": "+05:00",
  "Asia/Kolkata": "+05:30",
  "Europe/London": "+00:00",
  "America/New_York": "-05:00",
  UTC: "Z",
};

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
    hour: normalizeClockHour(get("hour")),
    minute: get("minute"),
    second: get("second"),
  };
}

export function formatDateTimeInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const dayPeriod = get("dayPeriod").toUpperCase();
  return `${get("day")} ${get("month")} ${get("year")} at ${get("hour")}:${get("minute")} ${dayPeriod}`;
}

/** Parse DB timestamps into a Date instant. Wall-clock strings use the store timezone (default Riyadh). */
export function parseStoredTimestampToInstant(raw, timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const hasZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
    const normalized = hasZone ? value : `${value.replace(/\.\d{3}$/, "")}Z`;
    const instant = new Date(normalized);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) {
    const iso = wallClockInTimezoneToIso(value, timeZone);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return null;
    const instant = new Date(iso);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }

  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function toTimezoneDateISO(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toTimezoneDateTimeISO(parts) {
  return `${toTimezoneDateISO(parts)} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** SQLite `datetime('now')` wall-clock string (UTC) → ISO instant. */
export function utcSqliteStringToIso(raw) {
  const value = String(raw ?? "").trim();
  if (!value || /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) return value;
  const instant = new Date(`${value.slice(0, 10)}T${value.slice(11, 19)}Z`);
  return Number.isNaN(instant.getTime()) ? value : instant.toISOString();
}

/** Business-local wall clock `YYYY-MM-DD HH:mm:ss` → ISO instant. */
export function wallClockInTimezoneToIso(raw, timeZone) {
  const value = String(raw ?? "").trim();
  if (!value || /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)) return value;

  const [datePart, timePart] = value.split(" ");
  const time = timePart.slice(0, 8);
  const offset = TIMEZONE_OFFSETS[timeZone] || "+00:00";
  const instant = new Date(`${datePart}T${time}${offset === "Z" ? "Z" : offset}`);
  return Number.isNaN(instant.getTime()) ? value : instant.toISOString();
}

/** SQLite `datetime('now')` values are UTC wall-clock strings without a timezone suffix. */
export function convertUtcSqliteDatetimeToBusiness(dateStr, timeZone) {
  const raw = String(dateStr ?? "").trim();
  if (!raw) return raw;

  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const instant = new Date(raw);
    if (Number.isNaN(instant.getTime())) return raw;
    return toTimezoneDateTimeISO(getDateTimePartsInTimezone(instant, timeZone));
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
    const instant = new Date(`${raw.slice(0, 10)}T${raw.slice(11, 19)}Z`);
    if (Number.isNaN(instant.getTime())) return raw;
    return toTimezoneDateTimeISO(getDateTimePartsInTimezone(instant, timeZone));
  }

  return raw;
}

/** Pretty-print a business-local `YYYY-MM-DD HH:mm:ss` value (no timezone conversion). */
export function formatWallClockDateTime(raw) {
  const [datePart, timePart = "00:00:00"] = String(raw).trim().split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [h24, m] = timePart.split(":").map(Number);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "short" });

  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(day).padStart(2, "0")} ${monthLabel} ${year} at ${h12}:${String(m).padStart(2, "0")} ${period}`;
}
