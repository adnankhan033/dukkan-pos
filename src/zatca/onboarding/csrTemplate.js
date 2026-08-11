import { ZATCA_ENVIRONMENTS } from "../core/constants";

const TEMPLATE_NAMES = {
  [ZATCA_ENVIRONMENTS.SANDBOX]: "TSTZATCA-Code-Signing",
  [ZATCA_ENVIRONMENTS.PRODUCTION]: "ZATCA-Code-Signing",
};

/**
 * OpenSSL .cnf values must be a single line. Newlines or unescaped `=` break parsing.
 * Wrap in double quotes for DN / alt_name fields.
 */
export function sanitizeCnfValue(value, { maxLength = 200, fallback = "N/A" } = {}) {
  const cleaned = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/["\\#;]/g, "")
    .trim()
    .slice(0, maxLength);

  const safe = cleaned || fallback;
  return `"${safe.replace(/"/g, "")}"`;
}

/**
 * OpenSSL `.cnf` for a ZATCA-compliant CSR (Fatoora / developer-portal spec).
 */
export function generateCSRTemplate({
  environment,
  solutionName,
  egsModel,
  egsSerialNumber,
  vatNumber,
  branchLocation,
  branchIndustry,
  commonName,
  branchName,
  taxpayerName,
}) {
  const templateName = TEMPLATE_NAMES[environment] || TEMPLATE_NAMES[ZATCA_ENVIRONMENTS.SANDBOX];

  const safeTaxpayer = sanitizeCnfValue(taxpayerName, { fallback: "Taxpayer" });
  const safeBranch = sanitizeCnfValue(branchName, { fallback: "Main Branch" });
  const safeCommon = sanitizeCnfValue(commonName, { fallback: "EGS-001" });
  const safeLocation = sanitizeCnfValue(branchLocation, { fallback: "Riyadh" });
  const safeIndustry = sanitizeCnfValue(branchIndustry, { fallback: "Retail" });
  const safeVat = sanitizeCnfValue(vatNumber, { fallback: "300000000000003", maxLength: 15 });
  const safeEgsSerial = sanitizeCnfValue(
    `1-${solutionName}|2-${egsModel}|3-${egsSerialNumber}`,
    { fallback: "1-PortalPOS|2-DukkanPOS|3-POS-001", maxLength: 250 }
  );

  const template = `oid_section = OIDs

[OIDs]
certificateTemplateName = 1.3.6.1.4.1.311.20.2

[req]
prompt = no
distinguished_name = dn
req_extensions = v3_req

[dn]
C = SA
O = SET_TAXPAYER_NAME
OU = SET_BRANCH_NAME
CN = SET_COMMON_NAME

[v3_req]
certificateTemplateName = ASN1:PRINTABLESTRING:SET_TEMPLATE_NAME
subjectAltName = dirName:alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment

[alt_names]
SN = SET_EGS_SERIAL_NUMBER
UID = SET_VAT_REGISTRATION_NUMBER
title = 1100
registeredAddress = SET_BRANCH_LOCATION
businessCategory = SET_BRANCH_INDUSTRY`;

  return template
    .replaceAll("SET_TEMPLATE_NAME", templateName)
    .replaceAll("SET_EGS_SERIAL_NUMBER", safeEgsSerial)
    .replaceAll("SET_VAT_REGISTRATION_NUMBER", safeVat)
    .replaceAll("SET_BRANCH_LOCATION", safeLocation)
    .replaceAll("SET_BRANCH_INDUSTRY", safeIndustry)
    .replaceAll("SET_COMMON_NAME", safeCommon)
    .replaceAll("SET_BRANCH_NAME", safeBranch)
    .replaceAll("SET_TAXPAYER_NAME", safeTaxpayer);
}
