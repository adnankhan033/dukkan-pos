/** ZATCA integration phases. */
export const ZATCA_PHASES = {
  DISABLED: "disabled",
  PHASE1: "phase1",
  PHASE2: "phase2",
};

export const ZATCA_PHASE_LABELS = {
  [ZATCA_PHASES.DISABLED]: "Disabled",
  [ZATCA_PHASES.PHASE1]: "ZATCA Phase 1",
  [ZATCA_PHASES.PHASE2]: "ZATCA Phase 2",
};

export const ZATCA_ENVIRONMENTS = {
  SANDBOX: "sandbox",
  SIMULATION: "simulation",
  PRODUCTION: "production",
};

export const ZATCA_ENVIRONMENT_LABELS = {
  [ZATCA_ENVIRONMENTS.SANDBOX]: "Sandbox (ZATCA Testing)",
  [ZATCA_ENVIRONMENTS.SIMULATION]: "Simulation (Local / No API)",
  [ZATCA_ENVIRONMENTS.PRODUCTION]: "Production (Live)",
};

/** Settings keys — all prefixed with zatca_ for isolation. */
export const ZATCA_SETTING_KEYS = {
  ENABLED: "zatca_enabled",
  ACTIVE_PHASE: "zatca_active_phase",
  ENVIRONMENT: "zatca_environment",

  DEVICE_ID: "zatca_device_id",
  DEVICE_SERIAL: "zatca_device_serial",
  EGS_UNIT_NAME: "zatca_egs_unit_name",
  EGS_MODEL: "zatca_egs_model",
  EGS_VERSION: "zatca_egs_version",

  COMPANY_NAME: "zatca_company_name",
  COMPANY_NAME_AR: "zatca_company_name_ar",
  CR_NUMBER: "zatca_cr_number",
  VAT_NUMBER: "zatca_vat_number",
  COMPANY_ADDRESS: "zatca_company_address",

  BUILDING_NUMBER: "zatca_building_number",
  STREET_NAME_EN: "zatca_street_name_en",
  STREET_NAME_AR: "zatca_street_name_ar",
  DISTRICT: "zatca_district",
  CITY: "zatca_city",
  POSTAL_CODE: "zatca_postal_code",
  ADDITIONAL_NUMBER: "zatca_additional_number",

  CERTIFICATE: "zatca_certificate",
  PRIVATE_KEY: "zatca_private_key",
  CERTIFICATE_REQUEST: "zatca_certificate_request",
  COMPLIANCE_CSID: "zatca_compliance_csid",
  COMPLIANCE_REQUEST_ID: "zatca_compliance_request_id",
  PRODUCTION_CSID: "zatca_production_csid",
  SECRET: "zatca_secret",
  COMPLIANCE_SECRET: "zatca_compliance_secret",
  PRODUCTION_SECRET: "zatca_production_secret",
  COMPLIANCE_AUTH_TOKEN: "zatca_compliance_auth_token",
  PRODUCTION_AUTH_TOKEN: "zatca_production_auth_token",

  API_BASE_URL: "zatca_api_base_url",
  CLIENT_ID: "zatca_client_id",
  CLIENT_SECRET: "zatca_client_secret",
  OTP: "zatca_otp",

  INVOICE_COUNTER: "zatca_invoice_counter",
  PREVIOUS_INVOICE_HASH: "zatca_previous_invoice_hash",
  CERTIFICATE_VAT: "zatca_certificate_vat",
  COMPLIANCE_CERTIFICATE_VAT: "zatca_compliance_certificate_vat",
  PRODUCTION_CERTIFICATE_VAT: "zatca_production_certificate_vat",
};

export const ZATCA_SENSITIVE_KEYS = new Set([
  ZATCA_SETTING_KEYS.PRIVATE_KEY,
  ZATCA_SETTING_KEYS.CERTIFICATE,
  ZATCA_SETTING_KEYS.CERTIFICATE_REQUEST,
  ZATCA_SETTING_KEYS.COMPLIANCE_CSID,
  ZATCA_SETTING_KEYS.PRODUCTION_CSID,
  ZATCA_SETTING_KEYS.SECRET,
  ZATCA_SETTING_KEYS.COMPLIANCE_SECRET,
  ZATCA_SETTING_KEYS.PRODUCTION_SECRET,
  ZATCA_SETTING_KEYS.COMPLIANCE_AUTH_TOKEN,
  ZATCA_SETTING_KEYS.PRODUCTION_AUTH_TOKEN,
  ZATCA_SETTING_KEYS.CLIENT_SECRET,
  ZATCA_SETTING_KEYS.OTP,
]);

/** Queue statuses for Phase 2 offline sync. */
export const ZATCA_QUEUE_STATUS = {
  PENDING: "pending",
  SENDING: "sending",
  SYNCED: "synced",
  FAILED: "failed",
};

export const ZATCA_QUEUE_STATUS_LABELS = {
  [ZATCA_QUEUE_STATUS.PENDING]: "Pending",
  [ZATCA_QUEUE_STATUS.SENDING]: "Sending…",
  [ZATCA_QUEUE_STATUS.SYNCED]: "Synced",
  [ZATCA_QUEUE_STATUS.FAILED]: "Failed",
};

/** User-facing success label (same as synced). */
export const ZATCA_QUEUE_STATUS_SUCCESS = ZATCA_QUEUE_STATUS.SYNCED;

export const ZATCA_SYNC_SETTINGS = {
  LAST_SYNC_AT: "zatca_last_sync_at",
  AUTO_SYNC_ENABLED: "zatca_auto_sync_enabled",
};

export const ZATCA_SYNC_DEFAULTS = {
  [ZATCA_SYNC_SETTINGS.LAST_SYNC_AT]: "",
  [ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED]: "0",
};

export const ZATCA_MAX_RETRY_COUNT = 5;
/** Background worker checks queue every 45 seconds when auto-sync is on. */
export const ZATCA_SYNC_INTERVAL_MS = 45 * 1000;

/** UBL KSA-2 transaction type codes (InvoiceTypeCode/@name). */
export const ZATCA_INVOICE_TYPE_NAMES = {
  STANDARD: "0100000",
  SIMPLIFIED: "0200000",
};

/** Invoice document kinds for ZATCA APIs. */
export const ZATCA_INVOICE_KINDS = {
  STANDARD: "standard",
  SIMPLIFIED: "simplified",
};

/** Sandbox test buyer VAT for standard (B2B) clearance invoices. Must match /^3\\d{13}3$/. */
export const ZATCA_SANDBOX_BUYER_VAT = "301121971500003";
