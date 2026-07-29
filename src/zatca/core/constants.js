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
  PRODUCTION: "production",
};

export const ZATCA_ENVIRONMENT_LABELS = {
  [ZATCA_ENVIRONMENTS.SANDBOX]: "Sandbox (Testing)",
  [ZATCA_ENVIRONMENTS.PRODUCTION]: "Production",
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

  CERTIFICATE: "zatca_certificate",
  PRIVATE_KEY: "zatca_private_key",
  CERTIFICATE_REQUEST: "zatca_certificate_request",
  COMPLIANCE_CSID: "zatca_compliance_csid",
  PRODUCTION_CSID: "zatca_production_csid",
  SECRET: "zatca_secret",

  API_BASE_URL: "zatca_api_base_url",
  CLIENT_ID: "zatca_client_id",
  CLIENT_SECRET: "zatca_client_secret",
  OTP: "zatca_otp",

  INVOICE_COUNTER: "zatca_invoice_counter",
  PREVIOUS_INVOICE_HASH: "zatca_previous_invoice_hash",
};

export const ZATCA_SENSITIVE_KEYS = new Set([
  ZATCA_SETTING_KEYS.PRIVATE_KEY,
  ZATCA_SETTING_KEYS.CERTIFICATE,
  ZATCA_SETTING_KEYS.CERTIFICATE_REQUEST,
  ZATCA_SETTING_KEYS.COMPLIANCE_CSID,
  ZATCA_SETTING_KEYS.PRODUCTION_CSID,
  ZATCA_SETTING_KEYS.SECRET,
  ZATCA_SETTING_KEYS.CLIENT_SECRET,
  ZATCA_SETTING_KEYS.OTP,
]);
