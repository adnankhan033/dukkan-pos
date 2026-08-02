/** User-facing summary of a stored ZATCA API sync response. */
export function summarizeZatcaSyncResponse(record) {
  if (!record?.response_json) return null;

  let parsed;
  try {
    parsed = typeof record.response_json === "string"
      ? JSON.parse(record.response_json)
      : record.response_json;
  } catch {
    return null;
  }

  const body = parsed?.response || parsed;
  const reportingStatus = body?.reportingStatus || body?.clearanceStatus;
  const validationStatus = body?.validationResults?.status;
  const httpStatus = parsed?.httpStatus;

  const parts = [];
  if (httpStatus) parts.push(`HTTP ${httpStatus}`);
  if (reportingStatus) parts.push(String(reportingStatus));
  if (validationStatus && validationStatus !== reportingStatus) {
    parts.push(`validation ${validationStatus}`);
  }

  if (!parts.length) {
    if (parsed?.success === true || parsed?.status === "synced") {
      return "ZATCA API accepted this invoice.";
    }
    return null;
  }

  return parts.join(" · ");
}

/** True when ZATCA API indicates the invoice was accepted. */
export function isZatcaApiAccepted(record) {
  const summary = summarizeZatcaSyncResponse(record);
  if (!summary) return record?.status === "synced";

  const upper = summary.toUpperCase();
  return (
    upper.includes("REPORTED") ||
    upper.includes("CLEARED") ||
    upper.includes("PASS") ||
    upper.includes("HTTP 200")
  );
}
