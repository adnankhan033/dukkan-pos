import { ZATCA_ENVIRONMENTS } from "./constants";

/** Official ZATCA Fatoora gateway endpoints — switch environment via config only. */
export const ZATCA_ENVIRONMENT_CONFIG = {
  [ZATCA_ENVIRONMENTS.SANDBOX]: {
    id: ZATCA_ENVIRONMENTS.SANDBOX,
    label: "Sandbox (Testing)",
    apiBaseUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
    complianceUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance",
    reportingUrl:
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single",
    clearanceUrl:
      "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single",
  },
  [ZATCA_ENVIRONMENTS.PRODUCTION]: {
    id: ZATCA_ENVIRONMENTS.PRODUCTION,
    label: "Production",
    apiBaseUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
    complianceUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance",
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
