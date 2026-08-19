import {
  ZATCA_PHASES,
  ZATCA_ENVIRONMENTS,
  ZATCA_SETTING_KEYS,
  ZATCA_SYNC_SETTINGS,
} from "./constants";
import { resolveApiBaseUrl, resolveEnvironmentConfig, resolveApiUrls } from "./environments";

function settingOn(value) {
  return value === "1" || value === "true";
}

function pick(settings, key, fallbackKey) {
  const value = settings?.[key]?.trim();
  if (value) return value;
  if (fallbackKey) return settings?.[fallbackKey]?.trim() || "";
  return "";
}

/** Parse raw settings into a structured ZATCA configuration object. */
export function parseZatcaConfig(settings = {}) {
  const environment =
    settings[ZATCA_SETTING_KEYS.ENVIRONMENT] || ZATCA_ENVIRONMENTS.SANDBOX;
  const envConfig = resolveEnvironmentConfig(environment);

  return {
    enabled: settingOn(settings[ZATCA_SETTING_KEYS.ENABLED]),
    activePhase: settings[ZATCA_SETTING_KEYS.ACTIVE_PHASE] || ZATCA_PHASES.DISABLED,
    environment,
    environmentLabel: envConfig.label,

    device: {
      id: settings[ZATCA_SETTING_KEYS.DEVICE_ID] || "",
      serial: settings[ZATCA_SETTING_KEYS.DEVICE_SERIAL] || "",
      egsUnitName: settings[ZATCA_SETTING_KEYS.EGS_UNIT_NAME] || "",
      model: settings[ZATCA_SETTING_KEYS.EGS_MODEL] || "Nexttel POS",
      version: settings[ZATCA_SETTING_KEYS.EGS_VERSION] || "1.0.0",
    },

    company: {
      name: pick(settings, ZATCA_SETTING_KEYS.COMPANY_NAME, "store_name"),
      nameAr: pick(settings, ZATCA_SETTING_KEYS.COMPANY_NAME_AR, "store_name_ar"),
      crNumber: pick(settings, ZATCA_SETTING_KEYS.CR_NUMBER, "cr_number"),
      vatNumber: pick(settings, ZATCA_SETTING_KEYS.VAT_NUMBER, "vat_registration"),
      address: pick(settings, ZATCA_SETTING_KEYS.COMPANY_ADDRESS, "store_address"),
      buildingNumber: settings[ZATCA_SETTING_KEYS.BUILDING_NUMBER] || "",
      streetNameEn: settings[ZATCA_SETTING_KEYS.STREET_NAME_EN] || "",
      streetNameAr: settings[ZATCA_SETTING_KEYS.STREET_NAME_AR] || "",
      district: settings[ZATCA_SETTING_KEYS.DISTRICT] || "",
      city: settings[ZATCA_SETTING_KEYS.CITY] || "",
      postalCode: settings[ZATCA_SETTING_KEYS.POSTAL_CODE] || "",
      additionalNumber: settings[ZATCA_SETTING_KEYS.ADDITIONAL_NUMBER] || "",
    },

    credentials: {
      certificate: settings[ZATCA_SETTING_KEYS.CERTIFICATE] || "",
      privateKey: settings[ZATCA_SETTING_KEYS.PRIVATE_KEY] || "",
      certificateRequest: settings[ZATCA_SETTING_KEYS.CERTIFICATE_REQUEST] || "",
      complianceCsid: settings[ZATCA_SETTING_KEYS.COMPLIANCE_CSID] || "",
      complianceRequestId: settings[ZATCA_SETTING_KEYS.COMPLIANCE_REQUEST_ID] || "",
      productionCsid: settings[ZATCA_SETTING_KEYS.PRODUCTION_CSID] || "",
      secret: settings[ZATCA_SETTING_KEYS.SECRET] || "",
      complianceSecret:
        settings[ZATCA_SETTING_KEYS.COMPLIANCE_SECRET] ||
        settings[ZATCA_SETTING_KEYS.SECRET] ||
        "",
      productionSecret:
        settings[ZATCA_SETTING_KEYS.PRODUCTION_SECRET] ||
        settings[ZATCA_SETTING_KEYS.SECRET] ||
        "",
      complianceAuthToken: settings[ZATCA_SETTING_KEYS.COMPLIANCE_AUTH_TOKEN] || "",
      productionAuthToken: settings[ZATCA_SETTING_KEYS.PRODUCTION_AUTH_TOKEN] || "",
      clientId: settings[ZATCA_SETTING_KEYS.CLIENT_ID] || "",
      clientSecret: settings[ZATCA_SETTING_KEYS.CLIENT_SECRET] || "",
      otp: settings[ZATCA_SETTING_KEYS.OTP] || "",
    },

    api: resolveApiUrls(environment, settings[ZATCA_SETTING_KEYS.API_BASE_URL]),

    chain: {
      invoiceCounter: Number(settings[ZATCA_SETTING_KEYS.INVOICE_COUNTER] || 0),
      previousInvoiceHash: settings[ZATCA_SETTING_KEYS.PREVIOUS_INVOICE_HASH] || "",
    },

    certificateVat: settings[ZATCA_SETTING_KEYS.CERTIFICATE_VAT] || "",
    complianceCertificateVat:
      settings[ZATCA_SETTING_KEYS.COMPLIANCE_CERTIFICATE_VAT] ||
      settings[ZATCA_SETTING_KEYS.CERTIFICATE_VAT] ||
      "",
    productionCertificateVat: settings[ZATCA_SETTING_KEYS.PRODUCTION_CERTIFICATE_VAT] || "",

    vatPercent: Number(settings.vat_percent || 15),
  };
}

export function resolveActivePhase(settings) {
  const config = parseZatcaConfig(settings);
  if (!config.enabled) return ZATCA_PHASES.DISABLED;

  if (config.activePhase === ZATCA_PHASES.PHASE1) return ZATCA_PHASES.PHASE1;
  if (config.activePhase === ZATCA_PHASES.PHASE2) return ZATCA_PHASES.PHASE2;

  return ZATCA_PHASES.DISABLED;
}

export function isZatcaEnabled(settings) {
  return resolveActivePhase(settings) !== ZATCA_PHASES.DISABLED;
}

/** Force Phase 2 enabled — used by Test Center sync so queue items can sync without changing global settings. */
export function buildSyncEnabledSettings(settings = {}) {
  return {
    ...settings,
    [ZATCA_SETTING_KEYS.ENABLED]: "1",
    [ZATCA_SETTING_KEYS.ACTIVE_PHASE]: ZATCA_PHASES.PHASE2,
  };
}

/** Default ZATCA settings for seeding / forms. */
export function getZatcaDefaultSettings() {
  return {
    [ZATCA_SETTING_KEYS.ENABLED]: "0",
    [ZATCA_SETTING_KEYS.ACTIVE_PHASE]: ZATCA_PHASES.DISABLED,
    [ZATCA_SETTING_KEYS.ENVIRONMENT]: ZATCA_ENVIRONMENTS.SANDBOX,
    [ZATCA_SETTING_KEYS.DEVICE_ID]: "",
    [ZATCA_SETTING_KEYS.DEVICE_SERIAL]: "",
    [ZATCA_SETTING_KEYS.EGS_UNIT_NAME]: "",
    [ZATCA_SETTING_KEYS.EGS_MODEL]: "Nexttel POS",
    [ZATCA_SETTING_KEYS.EGS_VERSION]: "1.0.0",
    [ZATCA_SETTING_KEYS.COMPANY_NAME]: "",
    [ZATCA_SETTING_KEYS.COMPANY_NAME_AR]: "",
    [ZATCA_SETTING_KEYS.CR_NUMBER]: "",
    [ZATCA_SETTING_KEYS.VAT_NUMBER]: "",
    [ZATCA_SETTING_KEYS.COMPANY_ADDRESS]: "",
    [ZATCA_SETTING_KEYS.BUILDING_NUMBER]: "",
    [ZATCA_SETTING_KEYS.STREET_NAME_EN]: "",
    [ZATCA_SETTING_KEYS.STREET_NAME_AR]: "",
    [ZATCA_SETTING_KEYS.DISTRICT]: "",
    [ZATCA_SETTING_KEYS.CITY]: "",
    [ZATCA_SETTING_KEYS.POSTAL_CODE]: "",
    [ZATCA_SETTING_KEYS.ADDITIONAL_NUMBER]: "",
    [ZATCA_SETTING_KEYS.CERTIFICATE]: "",
    [ZATCA_SETTING_KEYS.PRIVATE_KEY]: "",
    [ZATCA_SETTING_KEYS.CERTIFICATE_REQUEST]: "",
    [ZATCA_SETTING_KEYS.COMPLIANCE_CSID]: "",
    [ZATCA_SETTING_KEYS.COMPLIANCE_REQUEST_ID]: "",
    [ZATCA_SETTING_KEYS.PRODUCTION_CSID]: "",
    [ZATCA_SETTING_KEYS.SECRET]: "",
    [ZATCA_SETTING_KEYS.COMPLIANCE_SECRET]: "",
    [ZATCA_SETTING_KEYS.PRODUCTION_SECRET]: "",
    [ZATCA_SETTING_KEYS.COMPLIANCE_AUTH_TOKEN]: "",
    [ZATCA_SETTING_KEYS.PRODUCTION_AUTH_TOKEN]: "",
    [ZATCA_SETTING_KEYS.API_BASE_URL]: "",
    [ZATCA_SETTING_KEYS.CLIENT_ID]: "",
    [ZATCA_SETTING_KEYS.CLIENT_SECRET]: "",
    [ZATCA_SETTING_KEYS.OTP]: "",
    [ZATCA_SETTING_KEYS.INVOICE_COUNTER]: "0",
    [ZATCA_SETTING_KEYS.PREVIOUS_INVOICE_HASH]: "",
    [ZATCA_SETTING_KEYS.CERTIFICATE_VAT]: "",
    [ZATCA_SETTING_KEYS.COMPLIANCE_CERTIFICATE_VAT]: "",
    [ZATCA_SETTING_KEYS.PRODUCTION_CERTIFICATE_VAT]: "",
    [ZATCA_SYNC_SETTINGS.LAST_SYNC_AT]: "",
    [ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED]: "0",
  };
}
