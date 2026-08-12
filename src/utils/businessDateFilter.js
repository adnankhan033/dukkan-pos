import { resolveBusinessTimezone, wallClockInTimezoneToIso } from "./timezones";

/**
 * SQL filter matching timestamps stored as ISO UTC (…T…Z) or business wall-clock (YYYY-MM-DD HH:mm:ss).
 */
export function appendBusinessDateRangeFilter(column, range, params, settings = {}) {
  const tz = resolveBusinessTimezone(settings);
  params.push(range.from, range.to);
  const fromIdx = params.length - 1;
  const toIdx = params.length;

  const startIso = wallClockInTimezoneToIso(`${range.from} 00:00:00`, tz);
  const endIso = wallClockInTimezoneToIso(`${range.to} 23:59:59`, tz);
  params.push(startIso, endIso);
  const startIdx = params.length - 1;
  const endIdx = params.length;

  return ` AND (
    (${column} LIKE '%T%' AND ${column} >= $${startIdx} AND ${column} <= $${endIdx})
    OR
    (${column} NOT LIKE '%T%' AND date(${column}) >= date($${fromIdx}) AND date(${column}) <= date($${toIdx}))
  )`;
}

export function appendBusinessDateEqualsFilter(column, businessDate, params, settings = {}) {
  const tz = resolveBusinessTimezone(settings);
  params.push(businessDate);
  const dateIdx = params.length;

  const startIso = wallClockInTimezoneToIso(`${businessDate} 00:00:00`, tz);
  const endIso = wallClockInTimezoneToIso(`${businessDate} 23:59:59`, tz);
  params.push(startIso, endIso);
  const startIdx = params.length - 1;
  const endIdx = params.length;

  return ` AND (
    (${column} LIKE '%T%' AND ${column} >= $${startIdx} AND ${column} <= $${endIdx})
    OR
    (${column} NOT LIKE '%T%' AND date(${column}) = date($${dateIdx}))
  )`;
}
