import { ZATCA_SETTING_KEYS as K } from "../core/constants";

/**
 * ZATCA Sandbox / Production API registry — mirrors Fatoora Swagger operations.
 * @see https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal
 */
export const ZATCA_AUTH = {
  NONE: "none",
  OTP: "otp",
  COMPLIANCE_BASIC: "compliance_basic",
  PRODUCTION_BASIC: "production_basic",
  OTP_PRODUCTION_BASIC: "otp_production_basic",
};

/** @typedef {'otp'|'compliance_request_id'|'invoice_uuid'|'invoice_hash'|'invoice_base64'} ZatcaApiField */

/**
 * @typedef {Object} ZatcaApiOperation
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} method
 * @property {string} path
 * @property {string} auth
 * @property {ZatcaApiField[]} fields
 * @property {string[]} prerequisites
 * @property {boolean} [usesTestInvoice]
 * @property {boolean} [swaggerTag]
 */

export const ZATCA_API_OPERATIONS = {
  compliance_csid: {
    id: "compliance_csid",
    name: "Compliance CSID (Certificate)",
    description:
      "Issues an X509 Compliance CSID (CCSID) from CSR + OTP. Prerequisite for compliance testing.",
    method: "POST",
    path: "/compliance",
    auth: ZATCA_AUTH.OTP,
    fields: ["otp"],
    prerequisites: ["private_key", "csr"],
    swaggerTag: "Compliance CSID (Certificate)",
    requestExample: {
      csr: "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0K…",
    },
    responseExample: {
      requestID: 1234567890123,
      dispositionMessage: "ISSUED",
      binarySecurityToken: "…",
      secret: "…",
    },
  },

  compliance_invoice: {
    id: "compliance_invoice",
    name: "Compliance Invoice API",
    description:
      "Validates a signed invoice during compliance testing. Required before Production CSID in live environments.",
    method: "POST",
    path: "/compliance/invoices",
    auth: ZATCA_AUTH.COMPLIANCE_BASIC,
    fields: [],
    prerequisites: ["compliance_csid"],
    usesTestInvoice: true,
    swaggerTag: "Compliance Invoice API",
    requestExample: {
      invoiceHash: "NWZlYWRjZWQ…",
      uuid: "8e6e…",
      invoice: "PD94bWwg…",
    },
  },

  production_csid_onboarding: {
    id: "production_csid_onboarding",
    name: "Production CSID (Onboarding)",
    description:
      "Issues Production CSID (PCSID) using Compliance CSID credentials and compliance request ID.",
    method: "POST",
    path: "/production/csids",
    auth: ZATCA_AUTH.COMPLIANCE_BASIC,
    fields: ["compliance_request_id"],
    prerequisites: ["compliance_csid"],
    swaggerTag: "Production CSID (Onboarding)",
    requestExample: {
      compliance_request_id: 1234567890123,
    },
  },

  production_csid_renewal: {
    id: "production_csid_renewal",
    name: "Production CSID (Renewal)",
    description: "Renews Production CSID with OTP + new CSR. Uses PATCH on /production/csids.",
    method: "PATCH",
    path: "/production/csids",
    auth: ZATCA_AUTH.OTP_PRODUCTION_BASIC,
    fields: ["otp"],
    prerequisites: ["production_csid", "csr"],
    swaggerTag: "Production CSID (Renewal)",
    requestExample: {
      csr: "LS0tLS1CRUdJTi…",
    },
  },

  reporting_single: {
    id: "reporting_single",
    name: "Reporting — Single Invoice",
    description: "Reports a simplified tax invoice to ZATCA (B2C / simplified).",
    method: "POST",
    path: "/invoices/reporting/single",
    auth: ZATCA_AUTH.PRODUCTION_BASIC,
    fields: [],
    prerequisites: ["production_csid"],
    usesTestInvoice: true,
    swaggerTag: "Reporting API",
    requestExample: {
      invoiceHash: "NWZlYWRjZWQ…",
      uuid: "8e6e…",
      invoice: "PD94bWwg…",
    },
  },

  clearance_single: {
    id: "clearance_single",
    name: "Clearance — Single Invoice",
    description: "Clears a standard tax invoice with ZATCA (B2B / standard).",
    method: "POST",
    path: "/invoices/clearance/single",
    auth: ZATCA_AUTH.PRODUCTION_BASIC,
    fields: [],
    prerequisites: ["production_csid"],
    usesTestInvoice: true,
    swaggerTag: "Clearance API",
    requestExample: {
      invoiceHash: "NWZlYWRjZWQ…",
      uuid: "8e6e…",
      invoice: "PD94bWwg…",
    },
  },
};

export const ZATCA_API_FIELD_LABELS = {
  otp: "OTP (from ZATCA Fatoora portal)",
  compliance_request_id: "Compliance request ID (from Compliance CSID response)",
  invoice_uuid: "Invoice UUID",
  invoice_hash: "Invoice hash",
  invoice_base64: "Invoice (base64 XML)",
};

export const ZATCA_PREREQUISITE_LABELS = {
  csr: "CSR generated (Settings → Generate CSR)",
  compliance_csid: "Compliance CSID obtained (POST /compliance)",
  production_csid: "Production CSID obtained (POST /production/csids)",
};

/** Ordered list for API Explorer / documentation. */
export const ZATCA_API_OPERATION_ORDER = [
  "compliance_csid",
  "compliance_invoice",
  "production_csid_onboarding",
  "production_csid_renewal",
  "reporting_single",
  "clearance_single",
];

export function getZatcaApiOperation(operationId) {
  return ZATCA_API_OPERATIONS[operationId] || null;
}

export function listZatcaApiOperations() {
  return ZATCA_API_OPERATION_ORDER.map((id) => ZATCA_API_OPERATIONS[id]).filter(Boolean);
}

export function resolveOperationUrl(config, operation) {
  if (!operation?.path) return "";
  const base = String(config?.api?.baseUrl || "").replace(/\/$/, "");
  if (base.startsWith("local://")) {
    return `${base}${operation.path}`;
  }
  return `${base}${operation.path}`;
}

/**
 * Map successful CSID responses to settings keys.
 * @param {'compliance'|'production'} kind
 */
export function mapCsidResponseToSettings(kind, data, certificatePem) {
  const saved = {};
  if (kind === "compliance") {
    saved[K.COMPLIANCE_CSID] = certificatePem;
    saved[K.CERTIFICATE] = certificatePem;
    saved[K.SECRET] = data.secret;
    saved[K.COMPLIANCE_AUTH_TOKEN] = String(data.binarySecurityToken || "").replace(/\s/g, "");
    if (data.requestID != null) {
      saved[K.COMPLIANCE_REQUEST_ID] = String(data.requestID);
    }
  } else {
    saved[K.PRODUCTION_CSID] = certificatePem;
    saved[K.CERTIFICATE] = certificatePem;
    if (data.secret) saved[K.SECRET] = data.secret;
    saved[K.PRODUCTION_AUTH_TOKEN] = String(data.binarySecurityToken || "").replace(/\s/g, "");
  }
  return saved;
}
