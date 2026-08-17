import { resolveBusinessTimezone, wallClockInTimezoneToIso } from "./timezones";

function normalizeClock(value, fallback) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(raw)) {
    if (raw === "23:59") return "23:59:59";
    return `${raw}:00`;
  }
  return fallback;
}

function buildWallClockRange(range) {
  const fromTime = normalizeClock(range.fromTime, "00:00:00");
  const toTime = normalizeClock(range.toTime, "23:59:59");

  return {
    fromDateTime: `${range.from} ${fromTime}`,
    toDateTime: `${range.to} ${toTime}`,
    fromTime,
    toTime,
  };
}

/**
 * SQL filter matching timestamps stored as ISO UTC (…T…Z) or business wall-clock (YYYY-MM-DD HH:mm:ss).
 * Supports optional fromTime / toTime on the range object (HH:mm or HH:mm:ss).
 */
export function appendBusinessDateRangeFilter(column, range, params, settings = {}) {
  const tz = resolveBusinessTimezone(settings);
  const { fromDateTime, toDateTime } = buildWallClockRange(range);

  params.push(fromDateTime, toDateTime);
  const fromWallIdx = params.length - 1;
  const toWallIdx = params.length;

  const startIso = wallClockInTimezoneToIso(fromDateTime, tz);
  const endIso = wallClockInTimezoneToIso(toDateTime, tz);
  params.push(startIso, endIso);
  const startIdx = params.length - 1;
  const endIdx = params.length;

  return ` AND (
    (${column} LIKE '%T%' AND ${column} >= $${startIdx} AND ${column} <= $${endIdx})
    OR
    (${column} NOT LIKE '%T%' AND ${column} >= $${fromWallIdx} AND ${column} <= $${toWallIdx})
  )`;
}

export function appendBusinessDateEqualsFilter(column, businessDate, params, settings = {}) {
  return appendBusinessDateRangeFilter(
    column,
    { from: businessDate, to: businessDate, fromTime: "00:00:00", toTime: "23:59:59" },
    params,
    settings
  );
}
