import { ZATCA_ENVIRONMENTS, ZATCA_SETTING_KEYS as K } from "./constants";
import {
  normalizeCertificatePem,
  pemToBase64Token,
  resolveCertificateForMode,
  resolveStoredCertificate,
} from "./certificateUtils";

export const ZATCA_SANDBOX_VAT = "300000000000003";
const SAUDI_VAT_RE = /^3\d{13}3$/;

/** Normalize Saudi VAT — sandbox uses test VAT when real VAT is missing or invalid. */
export function normalizeSaudiVat(vat, environment = ZATCA_ENVIRONMENTS.SANDBOX) {
  const digits = String(vat || "").replace(/\D/g, "");
  if (SAUDI_VAT_RE.test(digits)) return digits;
  if (environment === ZATCA_ENVIRONMENTS.SANDBOX) return ZATCA_SANDBOX_VAT;
  return digits.length === 15 ? digits : "";
}

function decodeBase64Binary(base64) {
  const cleaned = String(base64 || "").replace(/\s/g, "");
  if (typeof atob === "function") {
    return atob(cleaned);
  }
  return "";
}

/** Extract VAT (UID) embedded in a ZATCA CSID certificate — browser-safe, no Node deps. */
export function extractVatFromCertificate(pemOrToken) {
  const pem = normalizeCertificatePem(pemOrToken);
  if (!pem) return "";

  try {
    const inner = pemToBase64Token(pem);
    const binary = decodeBase64Binary(inner);
    const match = binary.match(/3\d{13}3/);
    if (match?.[0]) return match[0];
  } catch {
    /* ignore */
  }

  return "";
}

/**
 * VAT number that must appear on signed invoices / ZATCA API calls.
 * When a certificate exists, ZATCA requires the invoice VAT to match the cert UID exactly.
 * @param {object} config - Parsed ZATCA config
 * @param {{ production?: boolean }} options - Use production CSID VAT when reporting
 */
export function resolveInvoiceVatNumber(config = {}, { production = false } = {}) {
  const credentials = config.credentials || {};
  const certificate = resolveCertificateForMode(credentials, { production });
  if (certificate) {
    const certVat = extractVatFromCertificate(certificate);
    if (certVat) return certVat;
  }

  const storedCertVat = production
    ? config.productionCertificateVat || credentials.productionCertificateVat
    : config.complianceCertificateVat || config.certificateVat || credentials.certificateVat;

  if (storedCertVat) {
    return normalizeSaudiVat(storedCertVat, config.environment);
  }

  return normalizeSaudiVat(config.company?.vatNumber, config.environment);
}

/** Extract seller VAT from signed UBL invoice XML. */
export function extractVatFromInvoiceXml(xml = "") {
  const text = String(xml || "");
  const companyId = text.match(/<cbc:CompanyID>(3\d{13}3)<\/cbc:CompanyID>/);
  if (companyId?.[1]) return companyId[1];

  const schemeId = text.match(
    /<cac:PartyTaxScheme>[\s\S]*?<cbc:CompanyID>(3\d{13}3)<\/cbc:CompanyID>[\s\S]*?<\/cac:PartyTaxScheme>/
  );
  return schemeId?.[1] || "";
}

/** Warn when store VAT differs from certificate VAT (common sandbox setup mistake). */
export function getVatCertificateMismatch(config = {}, { production = false } = {}) {
  const storeVat = normalizeSaudiVat(config.company?.vatNumber, config.environment);
  const invoiceVat = resolveInvoiceVatNumber(config, { production });
  if (!storeVat || !invoiceVat || storeVat === invoiceVat) {
    return null;
  }

  const certLabel = production ? "production certificate" : "certificate";
  return {
    storeVat,
    certificateVat: invoiceVat,
    production,
    message: `Store VAT (${storeVat}) differs from ${certLabel} VAT (${invoiceVat}). Invoices and QR codes use the certificate VAT (${invoiceVat}) automatically. For production, regenerate CSR with your real VAT before requesting a production certificate.`,
  };
}

/** Fail fast when signed invoice VAT does not match the active certificate. */
export function assertInvoiceVatMatchesCertificate(config = {}, xml = "", { production = false } = {}) {
  const expectedVat = resolveInvoiceVatNumber(config, { production });
  const xmlVat = extractVatFromInvoiceXml(xml);
  if (!expectedVat || !xmlVat || expectedVat === xmlVat) {
    return { ok: true, expectedVat, xmlVat };
  }

  const mode = production ? "Production CSID" : "Compliance CSID";
  throw new Error(
    `Invoice VAT (${xmlVat}) does not match ${mode} certificate VAT (${expectedVat}). ` +
      "Re-run Keys & CSR if your store VAT changed, then request new Compliance and Production certificates."
  );
}

/** Persist certificate VAT from CSID if not already stored. */
export function resolveCertificateVatForStorage(config = {}, { production = false } = {}) {
  const key = production ? "productionCertificateVat" : "complianceCertificateVat";
  const existing = String(config[key] || config.certificateVat || "").replace(/\D/g, "");
  if (SAUDI_VAT_RE.test(existing)) return existing;

  const credentials = config.credentials || {};
  const certificate = resolveCertificateForMode(credentials, { production });
  if (!certificate) return "";

  return extractVatFromCertificate(certificate);
}
