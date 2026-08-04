function decodeBase64Utf8(base64) {
  const cleaned = String(base64 || "").replace(/\s/g, "");
  if (typeof atob === "function") {
    return atob(cleaned);
  }
  return Buffer.from(cleaned, "base64").toString("utf8");
}

function encodeBase64Utf8(text) {
  if (typeof btoa === "function") {
    return btoa(text);
  }
  return Buffer.from(text, "utf8").toString("base64");
}

function wrapPemBody(innerBase64, label = "CERTIFICATE") {
  const cleaned = String(innerBase64 || "").replace(/\s/g, "");
  if (!cleaned) return "";
  const lines = cleaned.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function isInnerCertBody(value) {
  const cleaned = String(value || "").replace(/\s/g, "");
  return /^MII[A-Za-z0-9+/=]+$/.test(cleaned);
}

/**
 * Convert ZATCA binarySecurityToken → PEM X.509.
 * ZATCA returns base64(PEM-body) — decode once to get MIIC… then wrap in PEM headers.
 * @see https://zatca1.discourse.group/t/decoding-binary-security-token/2776
 */
export function base64TokenToPem(base64Token, label = "CERTIFICATE") {
  const cleaned = String(base64Token || "").replace(/\s/g, "");
  if (!cleaned) return "";

  if (cleaned.includes("BEGIN")) {
    return cleaned.includes("BEGIN CERTIFICATE") ? `${cleaned.trim()}\n` : wrapPemBody(cleaned, label);
  }

  // Inner PEM body already (MIIC…)
  if (isInnerCertBody(cleaned)) {
    return wrapPemBody(cleaned, label);
  }

  // Outer ZATCA binarySecurityToken (TUlJ… → decode → MIIC…)
  try {
    const decoded = decodeBase64Utf8(cleaned);
    if (decoded.includes("BEGIN CERTIFICATE")) {
      return `${decoded.trim()}\n`;
    }
    const inner = decoded.replace(/\s/g, "");
    if (isInnerCertBody(inner)) {
      return wrapPemBody(inner, label);
    }
  } catch {
    /* fall through */
  }

  return wrapPemBody(cleaned, label);
}

/** Extract inner MIIC… body from PEM (used for signing). */
export function pemToBase64Token(pem) {
  return String(pem || "")
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
}

/**
 * binarySecurityToken for ZATCA Basic auth (username).
 * Re-encodes inner PEM body to outer base64 token format.
 */
export function pemToZatcaAuthToken(pemOrToken) {
  const text = String(pemOrToken || "").trim();
  if (!text) return "";

  if (!text.includes("BEGIN CERTIFICATE")) {
    return text.replace(/\s/g, "");
  }

  const inner = pemToBase64Token(text);
  if (!inner) return "";
  return encodeBase64Utf8(inner);
}

/** True if value looks like a PEM certificate or raw ZATCA base64 token. */
export function isCertificateLike(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (text.includes("BEGIN CERTIFICATE")) return true;
  const cleaned = text.replace(/\s/g, "");
  return cleaned.length > 64 && /^[A-Za-z0-9+/=]+$/.test(cleaned);
}

/**
 * Normalize any ZATCA certificate input to PEM X.509.
 */
export function normalizeCertificatePem(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  if (text.includes("BEGIN CERTIFICATE")) {
    const body = pemToBase64Token(text);
    return base64TokenToPem(body);
  }

  return base64TokenToPem(text);
}

/** Pick the best certificate from settings (Compliance CSID or active cert). */
export function resolveStoredCertificate(credentials = {}) {
  const candidates = [
    credentials.complianceCsid,
    credentials.certificate,
    credentials.productionCsid,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeCertificatePem(candidate);
    if (normalized) return normalized;
  }
  return "";
}
