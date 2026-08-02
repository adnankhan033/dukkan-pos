import { ZATCA_ENVIRONMENTS } from "./constants";

/** Official ZATCA Fatoora gateway endpoints — switch environment via config only. */
export const ZATCA_ENVIRONMENT_CONFIG = {
  [ZATCA_ENVIRONMENTS.SANDBOX]: {
    id: ZATCA_ENVIRONMENTS.SANDBOX,
    label: "Sandbox (ZATCA Testing)",
    apiBaseUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
    complianceUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance",
    productionCsidsUrl:
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/production/csids",
    reportingUrl:
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single",
    clearanceUrl:
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single",
  },
  [ZATCA_ENVIRONMENTS.SIMULATION]: {
    id: ZATCA_ENVIRONMENTS.SIMULATION,
    label: "Simulation (Local / No API)",
    apiBaseUrl: "local://simulation",
    complianceUrl: "local://simulation/compliance",
    productionCsidsUrl: "local://simulation/production/csids",
    reportingUrl: "local://simulation/invoices/reporting/single",
    clearanceUrl: "local://simulation/invoices/clearance/single",
  },
  [ZATCA_ENVIRONMENTS.PRODUCTION]: {
    id: ZATCA_ENVIRONMENTS.PRODUCTION,
    label: "Production",
    apiBaseUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
    complianceUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance",
    productionCsidsUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids",
    reportingUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/reporting/single",
    clearanceUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/invoices/clearance/single",
  },
};

export function resolveEnvironmentConfig(environmentId) {
  return (
    ZATCA_ENVIRONMENT_CONFIG[environmentId] ||
    ZATCA_ENVIRONMENT_CONFIG[ZATCA_ENVIRONMENTS.SANDBOX]
  );
}

export function resolveApiBaseUrl(environmentId, customBaseUrl) {
  const trimmed = customBaseUrl?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  return resolveEnvironmentConfig(environmentId).apiBaseUrl;
}

export function resolveApiUrls(environmentId, customBaseUrl) {
  if (environmentId === ZATCA_ENVIRONMENTS.SIMULATION) {
    const sim = ZATCA_ENVIRONMENT_CONFIG[ZATCA_ENVIRONMENTS.SIMULATION];
    return {
      baseUrl: sim.apiBaseUrl,
      complianceUrl: sim.complianceUrl,
      complianceInvoicesUrl: `${sim.apiBaseUrl}/compliance/invoices`,
      productionCsidsUrl: sim.productionCsidsUrl,
      reportingUrl: sim.reportingUrl,
      clearanceUrl: sim.clearanceUrl,
    };
  }

  const baseUrl = resolveApiBaseUrl(environmentId, customBaseUrl);
  return {
    baseUrl,
    complianceUrl: `${baseUrl}/compliance`,
    complianceInvoicesUrl: `${baseUrl}/compliance/invoices`,
    productionCsidsUrl: `${baseUrl}/production/csids`,
    reportingUrl: `${baseUrl}/invoices/reporting/single`,
    clearanceUrl: `${baseUrl}/invoices/clearance/single`,
  };
}

/** ZATCA web validator — upload signed XML to verify structure. */
export const ZATCA_XML_VALIDATOR_URLS = {
  [ZATCA_ENVIRONMENTS.SANDBOX]:
    "https://sandbox.zatca.gov.sa/en/e-invoicing/web-based-validator",
  [ZATCA_ENVIRONMENTS.SIMULATION]:
    "https://sandbox.zatca.gov.sa/en/e-invoicing/web-based-validator",
  [ZATCA_ENVIRONMENTS.PRODUCTION]:
    "https://zatca.gov.sa/en/eInvoicing/Pages/default.aspx",
};

export function resolveXmlValidatorUrl(environmentId) {
  return (
    ZATCA_XML_VALIDATOR_URLS[environmentId] ||
    ZATCA_XML_VALIDATOR_URLS[ZATCA_ENVIRONMENTS.SANDBOX]
  );
}
