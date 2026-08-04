import { ZATCA_ENVIRONMENTS } from "../core/constants";

const TEMPLATE_NAMES = {
  [ZATCA_ENVIRONMENTS.SANDBOX]: "TSTZATCA-Code-Signing",
  [ZATCA_ENVIRONMENTS.PRODUCTION]: "ZATCA-Code-Signing",
};

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
    .replaceAll(
      "SET_EGS_SERIAL_NUMBER",
      `1-${solutionName}|2-${egsModel}|3-${egsSerialNumber}`
    )
    .replaceAll("SET_VAT_REGISTRATION_NUMBER", vatNumber)
    .replaceAll("SET_BRANCH_LOCATION", branchLocation)
    .replaceAll("SET_BRANCH_INDUSTRY", branchIndustry)
    .replaceAll("SET_COMMON_NAME", commonName)
    .replaceAll("SET_BRANCH_NAME", branchName)
    .replaceAll("SET_TAXPAYER_NAME", taxpayerName);
}
