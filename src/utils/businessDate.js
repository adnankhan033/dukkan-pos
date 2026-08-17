import { localDateISO, localDateTimeISO, getPeriodDateRange } from "./format";
import {
  DEFAULT_BUSINESS_TIMEZONE,
  getDateTimePartsInTimezone,
  getTimezoneOption,
  resolveBusinessTimezone,
  toTimezoneDateISO,
  toTimezoneDateTimeISO,
  formatDateTimeInTimezone,
} from "./timezones";

export { formatDateTimeInTimezone, getTimezoneOption, resolveBusinessTimezone };

/** Live business date/time in the store's selected region (optional manual override). */
export function getBusinessDateTime(settings) {
  const iso = getBusinessDateTimeISO(settings);
  return parseExpenseDate(iso);
}

export function getBusinessDateISO(settings) {
  const dateOverride = settings?.business_date_override?.trim();
  if (dateOverride) return dateOverride.slice(0, 10);

  const tz = resolveBusinessTimezone(settings);
  const parts = getDateTimePartsInTimezone(new Date(), tz);
  return toTimezoneDateISO(parts);
}

export function getBusinessDateTimeISO(settings) {
  const dateOverride = settings?.business_date_override?.trim();
  const timeOverride = settings?.business_time_override?.trim();
  const tz = resolveBusinessTimezone(settings);

  if (dateOverride) {
    const datePart = dateOverride.slice(0, 10);
    if (timeOverride) {
      const [h, m] = timeOverride.split(":");
      return `${datePart} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    }
    const parts = getDateTimePartsInTimezone(new Date(), tz);
    return `${datePart} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  const parts = getDateTimePartsInTimezone(new Date(), tz);
  return toTimezoneDateTimeISO(parts);
}

/** Label for UI: region name + formatted live time. */
export function getBusinessDateTimeLabel(settings) {
  const tz = resolveBusinessTimezone(settings);
  const region = getTimezoneOption(tz);
  const when = formatDateTimeInTimezone(new Date(), tz);
  const hasOverride = Boolean(settings?.business_date_override?.trim());
  return {
    region: region.label,
    regionAr: region.labelAr,
    timezone: tz,
    datetime: when,
    isOverride: hasOverride,
  };
}

/** Parse stored expense_date (date or datetime) without UTC shift. */
export function parseExpenseDate(value) {
  if (!value) return new Date();
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return new Date(raw);
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
    const [datePart, timePart] = raw.split(" ");
    const [h, m, s = "0"] = timePart.split(":");
    const [year, month, day] = datePart.split("-").map(Number);
    return new Date(year, month - 1, day, Number(h), Number(m), Number(s), 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  return new Date(raw);
}

/** Value for `<input type="datetime-local" />` using business region time. */
export function toDateTimeLocalValue(value, settings) {
  const d = value instanceof Date ? value : parseExpenseDate(value);
  if (Number.isNaN(d.getTime())) {
    return toDateTimeLocalValue(getBusinessDateTime(settings), settings);
  }
  const datePart = localDateISO(d);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${datePart}T${h}:${min}`;
}

/** Default datetime-local for new expense in business region. */
export function defaultExpenseDateTimeLocal(settings) {
  return toDateTimeLocalValue(getBusinessDateTime(settings), settings);
}

/** Store as `YYYY-MM-DD HH:mm:ss`. */
export function fromDateTimeLocalValue(value) {
  if (!value) return localDateTimeISO(new Date());
  const [datePart, timePart = "00:00"] = value.split("T");
  const [h, m] = timePart.split(":");
  return `${datePart} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Settings preview from form fields (unsaved). */
export function getBusinessDateTimeLabelFromForm(form) {
  return getBusinessDateTimeLabel({
    business_timezone: form.business_timezone,
    business_date_override: form.business_date_override,
    business_time_override: form.business_time_override,
  });
}

/** Last 7 calendar days including today (store business date). */
export function getBusinessRollingWeekRange(settings) {
  const to = getBusinessDateISO(settings);
  const [year, month, day] = to.split("-").map(Number);
  const endRef = new Date(year, month - 1, day, 12, 0, 0, 0);
  const startRef = new Date(endRef);
  startRef.setDate(endRef.getDate() - 6);
  return { from: localDateISO(startRef), to };
}

/** Period ranges (daily / rolling week / monthly) using the store business calendar. */
export function getBusinessPeriodDateRange(periodKey, settings) {
  if (periodKey === "rolling_week") {
    return getBusinessRollingWeekRange(settings);
  }

  const businessDate = getBusinessDateISO(settings);
  const [year, month, day] = businessDate.split("-").map(Number);
  const ref = new Date(year, month - 1, day, 12, 0, 0, 0);
  return getPeriodDateRange(periodKey, ref);
}

export { DEFAULT_BUSINESS_TIMEZONE };
