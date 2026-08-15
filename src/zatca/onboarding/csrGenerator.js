import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseZatcaConfig } from "../core/config";
import { ZATCA_ENVIRONMENTS, ZATCA_SETTING_KEYS as K } from "../core/constants";
import { isValidPrivateKeyPem } from "./keyGenerator";
import { generateCSRTemplate } from "./csrTemplate";

const SOLUTION_NAME = "PortalPOS";
const SANDBOX_VAT_PLACEHOLDER = "300000000000003";

function pick(...values) {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeVatNumber(vat, environment) {
  if (environment === ZATCA_ENVIRONMENTS.SANDBOX) {
    return SANDBOX_VAT_PLACEHOLDER;
  }
  const digits = String(vat || "").replace(/\D/g, "");
  if (/^3\d{13}3$/.test(digits)) return digits;
  return "";
}

export function buildCsrParams(settings = {}) {
  const config = parseZatcaConfig(settings);
  const environment = config.environment || ZATCA_ENVIRONMENTS.SANDBOX;

  const vatNumber = normalizeVatNumber(config.company.vatNumber, environment);
  const taxpayerName = pick(config.company.name, settings.store_name, "DukkanPOS Store");
  const branchName = pick(config.device.egsUnitName, taxpayerName, "Main Branch");
  const branchLocation = pick(config.company.address, settings.store_address, "Riyadh");
  const branchIndustry = "Retail";
  const egsModel = pick(config.device.model, "DukkanPOS", "1.0.0");
  const egsSerialNumber = pick(
    config.device.serial,
    config.device.id,
    settings[K.DEVICE_SERIAL],
    "POS-001"
  );
  const commonName = pick(config.device.id, config.device.egsUnitName, egsSerialNumber, "EGS-001");

  const missing = [];
  if (!vatNumber) {
    missing.push("VAT registration (15 digits, starts and ends with 3) on Store or ZATCA tab");
  }
  if (!pick(config.device.serial, config.device.id)) {
    missing.push("Device ID or Device serial on the Device (EGS) section");
  }

  return {
    environment,
    vatNumber,
    taxpayerName,
    branchName,
    branchLocation,
    branchIndustry,
    egsModel,
    egsSerialNumber,
    commonName,
    solutionName: SOLUTION_NAME,
    missing,
    usedSandboxVatPlaceholder:
      environment === ZATCA_ENVIRONMENTS.SANDBOX &&
      vatNumber === SANDBOX_VAT_PLACEHOLDER &&
      !/^3\d{13}3$/.test(String(config.company.vatNumber || "").replace(/\D/g, "")),
  };
}

/**
 * Encode CSR PEM for ZATCA POST /compliance body.
 * Swagger example decodes to "-----BEGIN CERTIFICATE REQUEST-----" (full PEM, UTF-8, then base64).
 */
export function csrPemToBase64(pem) {
  const normalized = String(pem || "").trim();
  if (!normalized) return "";

  if (normalized.includes("BEGIN CERTIFICATE REQUEST")) {
    const pemText = normalized.endsWith("\n") ? normalized : `${normalized}\n`;
    if (typeof btoa === "function") {
      return btoa(pemText);
    }
    return Buffer.from(pemText, "utf8").toString("base64");
  }

  // Fallback: already stripped to inner base64 — wrap as full PEM for ZATCA API
  const inner = normalized.replace(/\s/g, "");
  const pemText = `-----BEGIN CERTIFICATE REQUEST-----\n${inner.match(/.{1,64}/g)?.join("\n") ?? inner}\n-----END CERTIFICATE REQUEST-----\n`;
  if (typeof btoa === "function") {
    return btoa(pemText);
  }
  return Buffer.from(pemText, "utf8").toString("base64");
}

export function isValidCsrPem(value) {
  const pem = String(value || "").trim();
  return pem.includes("-----BEGIN CERTIFICATE REQUEST-----") && pem.includes("-----END CERTIFICATE REQUEST-----");
}

export async function generateZatcaCsr(settings = {}) {
  const privateKey = pick(settings[K.PRIVATE_KEY]);
  if (!isValidPrivateKeyPem(privateKey)) {
    throw new Error("Generate or paste a private key first (Settings → ZATCA).");
  }

  const params = buildCsrParams(settings);
  if (params.missing.length > 0) {
    throw new Error(`Fill in required fields first:\n• ${params.missing.join("\n• ")}`);
  }

  const csrConfig = generateCSRTemplate({
    environment: params.environment,
    solutionName: params.solutionName,
    egsModel: params.egsModel,
    egsSerialNumber: params.egsSerialNumber,
    vatNumber: params.vatNumber,
    branchLocation: params.branchLocation,
    branchIndustry: params.branchIndustry,
    commonName: params.commonName,
    branchName: params.branchName,
    taxpayerName: params.taxpayerName,
  });

  if (!isTauri()) {
    throw new Error("CSR generation runs inside the Tauri desktop app (not in the browser preview).");
  }

  const pem = await invoke("generate_zatca_csr", {
    privateKeyPem: privateKey,
    csrConfig,
    csrFields: {
      environment: params.environment,
      commonName: params.commonName,
      taxpayerName: params.taxpayerName,
      branchName: params.branchName,
      branchLocation: params.branchLocation,
      branchIndustry: params.branchIndustry,
      vatNumber: params.vatNumber,
      egsSerial: `1-${params.solutionName}|2-${params.egsModel}|3-${params.egsSerialNumber}`,
    },
  }).catch((err) => {
    const msg =
      typeof err === "string" ? err : err?.message || String(err ?? "CSR generation failed");
    throw new Error(msg);
  });

  return {
    pem,
    base64: csrPemToBase64(pem),
    params,
  };
}
