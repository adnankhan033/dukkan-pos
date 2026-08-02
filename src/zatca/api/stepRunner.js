import { ZATCA_SETTING_KEYS as K } from "../core/constants";
import { parseZatcaConfig } from "../core/config";
import { ensurePrivateKey } from "../onboarding/ensurePrivateKey";
import { generateZatcaCsr, isValidCsrPem, buildCsrParams } from "../onboarding/csrGenerator";
import { isValidPrivateKeyPem } from "../onboarding/keyGenerator";
import { settingsService } from "../../services/SettingsService";
import { getZatcaApiOperation, ZATCA_PREREQUISITE_LABELS } from "./registry";

/** Local (on-device) steps that prepare data before ZATCA API calls. */
export const ZATCA_LOCAL_STEPS = {
  private_key: {
    id: "private_key",
    name: "Private Key",
    description: "Generate secp256k1 private key on this device (required for CSR).",
    type: "local",
    prerequisites: [],
  },
  generate_csr: {
    id: "generate_csr",
    name: "Generate CSR",
    description:
      "Create Certificate Signing Request per ZATCA Developer Portal section 4.3 — sent as base64 in POST /compliance.",
    type: "local",
    prerequisites: ["private_key"],
  },
};

export const PREREQ_LOCAL_STEP = {
  private_key: "private_key",
  csr: "generate_csr",
};

export function checkPrerequisiteStatus(prereqId, settings) {
  const config = parseZatcaConfig(settings);
  const creds = config.credentials;

  switch (prereqId) {
    case "private_key":
      return {
        id: prereqId,
        ready: isValidPrivateKeyPem(settings[K.PRIVATE_KEY] || creds.privateKey),
        label: "Private key on device",
        localStepId: "private_key",
      };
    case "csr":
      return {
        id: prereqId,
        ready: isValidCsrPem(settings[K.CERTIFICATE_REQUEST] || creds.certificateRequest),
        label: ZATCA_PREREQUISITE_LABELS.csr,
        localStepId: "generate_csr",
      };
    case "compliance_csid":
      return {
        id: prereqId,
        ready: Boolean(creds.complianceCsid || (creds.certificate && creds.secret)),
        label: ZATCA_PREREQUISITE_LABELS.compliance_csid,
        localStepId: null,
      };
    case "production_csid":
      return {
        id: prereqId,
        ready: Boolean(creds.productionCsid),
        label: ZATCA_PREREQUISITE_LABELS.production_csid,
        localStepId: null,
      };
    default:
      return { id: prereqId, ready: true, label: prereqId, localStepId: null };
  }
}

export function getOperationPrerequisiteStatuses(operationId, settings) {
  const operation = getZatcaApiOperation(operationId);
  if (!operation) return [];

  const seen = new Set();
  const statuses = [];

  function addPrereq(id) {
    if (seen.has(id)) return;
    seen.add(id);
    const status = checkPrerequisiteStatus(id, settings);
    statuses.push(status);
    if (status.localStepId) {
      const localStep = ZATCA_LOCAL_STEPS[status.localStepId];
      for (const dep of localStep?.prerequisites || []) {
        addPrereq(dep);
      }
    }
  }

  for (const prereq of operation.prerequisites || []) {
    addPrereq(prereq);
  }

  return statuses.sort((a, b) => {
    const order = ["private_key", "csr", "compliance_csid", "production_csid"];
    return order.indexOf(a.id) - order.indexOf(b.id);
  });
}

async function persistSettings(fields) {
  for (const [key, value] of Object.entries(fields)) {
    await settingsService.set(key, value);
  }
  return settingsService.getAll();
}

/** Run a single local preparation step. */
export async function runLocalStep(stepId, settings) {
  switch (stepId) {
    case "private_key": {
      const existing = settings[K.PRIVATE_KEY]?.trim();
      if (isValidPrivateKeyPem(existing)) {
        return {
          success: true,
          stepId,
          message: "Private key already exists.",
          settings,
          savedFields: null,
        };
      }
      const result = await ensurePrivateKey({ settings, persist: true });
      const updated = await settingsService.getAll();
      return {
        success: Boolean(result.privateKey),
        stepId,
        message: result.generated
          ? "Private key generated and saved."
          : "Private key is ready.",
        settings: updated,
        savedFields: result.generated ? { [K.PRIVATE_KEY]: result.privateKey } : null,
      };
    }

    case "generate_csr": {
      const keyCheck = checkPrerequisiteStatus("private_key", settings);
      if (!keyCheck.ready) {
        const keyResult = await runLocalStep("private_key", settings);
        if (!keyResult.success) return keyResult;
        settings = keyResult.settings;
      }

      const csrPem = settings[K.CERTIFICATE_REQUEST];
      if (isValidCsrPem(csrPem)) {
        return {
          success: true,
          stepId,
          message: "CSR already generated.",
          settings,
          savedFields: null,
          csrBase64: csrPem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""),
        };
      }

      const params = buildCsrParams(settings);
      if (params.missing.length) {
        return {
          success: false,
          stepId,
          message: `Fill required fields first:\n• ${params.missing.join("\n• ")}`,
          settings,
          missingFields: params.missing,
        };
      }

      const result = await generateZatcaCsr(settings);
      await persistSettings({ [K.CERTIFICATE_REQUEST]: result.pem });
      const updated = await settingsService.getAll();

      return {
        success: true,
        stepId,
        message: params.usedSandboxVatPlaceholder
          ? "CSR generated (using sandbox VAT placeholder 300000000000003)."
          : "CSR generated successfully.",
        settings: updated,
        savedFields: { [K.CERTIFICATE_REQUEST]: result.pem },
        csrBase64: result.base64,
        csrPreview: `${result.base64.slice(0, 32)}…`,
      };
    }

    default:
      return { success: false, stepId, message: `Unknown local step: ${stepId}` };
  }
}

/**
 * Auto-run local steps needed before an API operation.
 * Returns updated settings after each successful step.
 */
export async function prepareForOperation(operationId, settings, { onlyStepId = null } = {}) {
  const operation = getZatcaApiOperation(operationId);
  if (!operation) {
    return { success: false, settings, steps: [], message: "Unknown operation." };
  }

  let current = { ...settings };
  const steps = [];

  const toRun = onlyStepId
    ? [onlyStepId]
    : (operation.prerequisites || [])
        .map((p) => PREREQ_LOCAL_STEP[p])
        .filter(Boolean);

  const ordered = ["private_key", "generate_csr"].filter((id) => toRun.includes(id));

  for (const stepId of ordered) {
    const status = checkPrerequisiteStatus(
      stepId === "generate_csr" ? "csr" : stepId,
      current
    );
    if (status.ready) {
      steps.push({ stepId, success: true, skipped: true, message: "Already ready." });
      continue;
    }

    const result = await runLocalStep(stepId, current);
    steps.push({
      stepId,
      success: result.success,
      message: result.message,
      savedFields: result.savedFields,
    });

    if (!result.success) {
      return {
        success: false,
        settings: current,
        steps,
        message: result.message,
      };
    }

    current = result.settings || current;
  }

  const missing = (operation.prerequisites || [])
    .map((p) => checkPrerequisiteStatus(p, current))
    .filter((s) => !s.ready && !s.localStepId);

  if (missing.length) {
    return {
      success: false,
      settings: current,
      steps,
      message: `Still missing: ${missing.map((m) => m.label).join("; ")}`,
      missingPrereqs: missing.map((m) => m.label),
    };
  }

  return { success: true, settings: current, steps, message: "All prerequisites ready." };
}
