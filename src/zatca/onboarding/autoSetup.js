import { ZATCA_SETTING_KEYS as K, ZATCA_PHASES } from "../core/constants";
import { parseZatcaConfig } from "../core/config";
import { settingsService } from "../../services/SettingsService";
import { ensurePrivateKey } from "./ensurePrivateKey";
import {
  buildCsrParams,
  generateZatcaCsr,
  isValidCsrPem,
  csrPemToBase64,
} from "./csrGenerator";
import { isValidPrivateKeyPem } from "./keyGenerator";

/** Map Store tab fields → ZATCA company fields when ZATCA fields are empty. */
const STORE_TO_ZATCA_MAP = [
  ["store_name", K.COMPANY_NAME],
  ["store_name_ar", K.COMPANY_NAME_AR],
  ["cr_number", K.CR_NUMBER],
  ["vat_registration", K.VAT_NUMBER],
  ["store_address", K.COMPANY_ADDRESS],
];

function generateDeviceId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `EGS-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Copy store settings into empty ZATCA company fields. */
export function syncStoreToZatcaFields(settings = {}) {
  const updates = {};
  for (const [storeKey, zatcaKey] of STORE_TO_ZATCA_MAP) {
    const storeVal = settings[storeKey]?.trim();
    const zatcaVal = settings[zatcaKey]?.trim();
    if (storeVal && !zatcaVal) {
      updates[zatcaKey] = storeVal;
    }
  }
  return updates;
}

/** Auto-fill device ID, serial, and EGS unit name when missing. */
export function ensureDeviceDefaults(settings = {}) {
  const updates = {};
  const merged = { ...settings };
  const config = parseZatcaConfig(merged);

  const hasId = Boolean(config.device.id?.trim());
  const hasSerial = Boolean(config.device.serial?.trim());

  if (!hasId && !hasSerial) {
    const deviceId = generateDeviceId();
    updates[K.DEVICE_ID] = deviceId;
    updates[K.DEVICE_SERIAL] = deviceId;
  } else if (!hasSerial && hasId) {
    updates[K.DEVICE_SERIAL] = config.device.id;
  } else if (!hasId && hasSerial) {
    updates[K.DEVICE_ID] = config.device.serial;
  }

  if (!config.device.egsUnitName?.trim()) {
    const name =
      pick(config.company.name, settings.store_name, settings[K.COMPANY_NAME]) ||
      "Main POS";
    updates[K.EGS_UNIT_NAME] = name;
  }

  if (!config.device.model?.trim()) {
    updates[K.EGS_MODEL] = "Dukkan POS";
  }
  if (!config.device.version?.trim()) {
    updates[K.EGS_VERSION] = "1.0.0";
  }

  return updates;
}

function pick(...values) {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** Check whether company details are sufficient for CSR generation. */
export function getCompanyReadiness(settings = {}) {
  const config = parseZatcaConfig(settings);
  const params = buildCsrParams(settings);
  const missing = [];

  if (!config.company.name && !settings.store_name?.trim()) {
    missing.push("Company name");
  }
  if (params.missing.some((m) => m.includes("VAT"))) {
    missing.push(
      config.environment === "sandbox"
        ? "VAT registration (optional in sandbox — test VAT 300000000000003 is used automatically)"
        : "VAT registration (15 digits, starts and ends with 3)"
    );
  }

  return { ready: missing.length === 0, missing, config, csrParams: params };
}

/** Return step-by-step onboarding progress (Fatoora-style). */
export function getSetupProgress(settings = {}) {
  const config = parseZatcaConfig(settings);
  const company = getCompanyReadiness(settings);
  const hasKey = isValidPrivateKeyPem(settings[K.PRIVATE_KEY]);
  const hasCsr = isValidCsrPem(settings[K.CERTIFICATE_REQUEST]);
  const hasCompliance = Boolean(config.credentials.complianceCsid?.trim());
  const hasProduction = Boolean(config.credentials.productionCsid?.trim());
  const phase = config.activePhase;

  const steps =
    phase === ZATCA_PHASES.PHASE1
      ? [
          {
            id: "company",
            label: "Company Details",
            done: company.ready,
            description: "Store name, VAT, CR, and address",
          },
          {
            id: "qr",
            label: "QR Ready",
            done: company.ready,
            description: "Phase 1 QR codes on receipts",
          },
        ]
      : [
          {
            id: "company",
            label: "Company Details",
            done: company.ready,
            description: "Store name, VAT, CR, and address",
          },
          {
            id: "keys",
            label: "Keys & CSR",
            done: hasKey && hasCsr,
            description: "Private key and certificate signing request",
          },
          {
            id: "compliance",
            label: "Compliance Certificate",
            done: hasCompliance,
            description: "OTP from Fatoora portal → Compliance CSID",
          },
          {
            id: "production",
            label: "Production Certificate",
            done: hasProduction,
            description: "Activate live e-invoicing",
          },
        ];

  let activeStepId = steps[0]?.id;
  for (const step of steps) {
    if (!step.done) {
      activeStepId = step.id;
      break;
    }
    activeStepId = step.id;
  }

  return {
    steps,
    activeStepId,
    complete: steps.every((s) => s.done),
    company,
    hasKey,
    hasCsr,
    hasCompliance,
    hasProduction,
    phase,
  };
}

async function persistFields(savedFields) {
  for (const [key, value] of Object.entries(savedFields)) {
    if (value != null && value !== "") {
      await settingsService.set(key, value);
    }
  }
}

/**
 * One-click setup: sync store fields, create device defaults, generate private key + CSR.
 * Same flow as Fatoora platform — add company details, everything else is automatic.
 */
export async function runAutoSetup(settings = {}, { forceCsr = false } = {}) {
  const savedFields = {};
  const messages = [];

  Object.assign(savedFields, syncStoreToZatcaFields(settings));
  let merged = { ...settings, ...savedFields };

  Object.assign(savedFields, ensureDeviceDefaults(merged));
  merged = { ...merged, ...savedFields };

  const keyResult = await ensurePrivateKey({ settings: merged, persist: false });
  if (keyResult.privateKey) {
    savedFields[K.PRIVATE_KEY] = keyResult.privateKey;
    if (keyResult.generated) {
      messages.push("Private key generated on this device");
    }
  }
  merged = { ...merged, [K.PRIVATE_KEY]: keyResult.privateKey };

  const params = buildCsrParams(merged);
  if (params.missing.length > 0) {
    await persistFields(savedFields);
    return {
      success: false,
      messages,
      savedFields,
      missing: params.missing,
      message: `Complete company details first:\n• ${params.missing.join("\n• ")}`,
    };
  }

  const needsCsr = forceCsr || !isValidCsrPem(merged[K.CERTIFICATE_REQUEST]);

  if (needsCsr) {
    try {
      const csrResult = await generateZatcaCsr(merged);
      savedFields[K.CERTIFICATE_REQUEST] = csrResult.pem;
      if (csrResult.params?.vatNumber) {
        savedFields[K.CERTIFICATE_VAT] = csrResult.params.vatNumber;
      }
      messages.push("CSR generated automatically");

      await persistFields(savedFields);

      let message =
        "Setup complete! Private key and CSR are ready. Enter your OTP from the Fatoora portal to get your Compliance certificate.";
      if (csrResult.params?.usedSandboxVatPlaceholder) {
        message +=
          " (Using sandbox test VAT — set your real VAT on the Store tab for production.)";
      }

      return {
        success: true,
        messages,
        savedFields,
        csrPem: csrResult.pem,
        csrBase64: csrResult.base64,
        message,
      };
    } catch (err) {
      await persistFields(savedFields);
      return {
        success: false,
        messages,
        savedFields,
        message: err.message || "Could not generate CSR.",
      };
    }
  }

  await persistFields(savedFields);

  return {
    success: true,
    messages: messages.length ? messages : ["Already configured"],
    savedFields,
    csrPem: merged[K.CERTIFICATE_REQUEST],
    csrBase64: csrPemToBase64(merged[K.CERTIFICATE_REQUEST]),
    message: "Device is already configured. CSR is ready — enter OTP to continue.",
  };
}

/** Run auto-setup after store settings save when ZATCA Phase 2 is active. */
export async function autoSetupOnStoreSave(settings = {}) {
  const phase = settings[K.ACTIVE_PHASE];
  if (phase !== ZATCA_PHASES.PHASE2) {
    return { skipped: true, reason: "Phase 2 not active" };
  }

  const company = getCompanyReadiness(settings);
  if (!company.ready) {
    return { skipped: true, reason: "Company details incomplete" };
  }

  return runAutoSetup(settings);
}
