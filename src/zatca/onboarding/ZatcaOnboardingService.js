import { ZATCA_SETTING_KEYS as K, ZATCA_PHASES } from "../core/constants";
import { parseZatcaConfig } from "../core/config";
import { createZatcaModule } from "../ZatcaServiceFactory";
import { ensurePrivateKey } from "./ensurePrivateKey";
import { generateZatcaCsr, isValidCsrPem } from "./csrGenerator";
import { isValidPrivateKeyPem } from "./keyGenerator";
import { generateQrDataUrl } from "../phase1/qrGenerator";
import { settingsService } from "../../services/SettingsService";
import { executeZatcaApiOperation } from "../api/executor";
import { prepareForOperation } from "../api/stepRunner";
import { getOnboardingStepsForPhase } from "./onboardingSteps";

class ZatcaOnboardingService {
  getStepsForPhase(phase) {
    return getOnboardingStepsForPhase(phase);
  }

  async runStep(stepId, { settings, formOverrides = {} }) {
    const merged = { ...settings, ...formOverrides };
    const steps = [
      ...getOnboardingStepsForPhase(ZATCA_PHASES.PHASE1),
      ...getOnboardingStepsForPhase(ZATCA_PHASES.PHASE2),
    ];
    const stepDef = steps.find((s) => s.id === stepId);

    if (stepDef?.apiId) {
      return this._runApiStep(stepDef, merged, formOverrides);
    }

    switch (stepId) {
      case "phase1_config":
        return this._runPhase1Config(merged);
      case "phase1_qr":
        return this._runPhase1Qr(merged);
      case "phase2_config":
        return this._runPhase2Config(merged);
      case "private_key":
        return this._runPrivateKey(merged);
      case "generate_csr":
        return this._runGenerateCsr(merged);
      default:
        return { success: false, message: `Unknown onboarding step: ${stepId}` };
    }
  }

  async _runApiStep(stepDef, settings, formOverrides) {
    const inputs = {
      otp: formOverrides.otp || settings[K.OTP],
      compliance_request_id:
        formOverrides.compliance_request_id || settings[K.COMPLIANCE_REQUEST_ID],
      csrBase64: formOverrides.csrBase64,
    };

    const prep = await prepareForOperation(stepDef.apiId, settings);
    const currentSettings = prep.settings || settings;

    if (!prep.success) {
      return {
        success: false,
        message: prep.message,
        prepSteps: prep.steps,
      };
    }

    const result = await executeZatcaApiOperation(stepDef.apiId, {
      settings: currentSettings,
      inputs,
    });

    if (result.savedFields) {
      for (const [key, value] of Object.entries(result.savedFields)) {
        await settingsService.set(key, value);
      }
    }

    return {
      success: result.success,
      message: result.message,
      httpStatus: result.httpStatus,
      response: result.response,
      request: result.request,
      savedFields: result.savedFields,
      simulated: result.simulated,
      prepSteps: prep.steps,
    };
  }

  async _runPhase1Config(settings) {
    const module = createZatcaModule({ ...settings, [K.ACTIVE_PHASE]: ZATCA_PHASES.PHASE1, [K.ENABLED]: "1" });
    const config = parseZatcaConfig(settings);
    const validation = module.validateConfiguration(config);

    return {
      success: validation.valid,
      message: validation.valid
        ? "Phase 1 configuration is valid."
        : validation.errors.join("; "),
      details: validation,
    };
  }

  async _runPhase1Qr(settings) {
    const config = parseZatcaConfig(settings);
    if (!config.company.vatNumber || !config.company.name) {
      return {
        success: false,
        message: "VAT number and company name are required.",
      };
    }

    const sampleSale = {
      total: 115,
      vat: 15,
      created_at: new Date().toISOString(),
    };

    try {
      const qrDataUrl = await generateQrDataUrl({
        sellerName: config.company.name,
        vatNumber: config.company.vatNumber,
        sale: sampleSale,
      });
      return {
        success: Boolean(qrDataUrl),
        message: "Sample Phase 1 QR generated successfully.",
        qrDataUrl,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async _runPhase2Config(settings) {
    const module = createZatcaModule({ ...settings, [K.ACTIVE_PHASE]: ZATCA_PHASES.PHASE2, [K.ENABLED]: "1" });
    const config = parseZatcaConfig(settings);
    const validation = module.validateConfiguration(config);

    return {
      success: validation.errors.length === 0,
      message:
        validation.errors.length === 0
          ? validation.warnings.length
            ? `Configuration OK with warnings: ${validation.warnings.join("; ")}`
            : "Phase 2 configuration is valid."
          : validation.errors.join("; "),
      details: validation,
    };
  }

  async _runPrivateKey(settings) {
    const existing = settings[K.PRIVATE_KEY]?.trim();
    if (isValidPrivateKeyPem(existing)) {
      return { success: true, message: "Private key already exists on this device.", persisted: true };
    }

    const result = await ensurePrivateKey({ settings, persist: true });
    return {
      success: Boolean(result.privateKey),
      message: result.generated
        ? "New secp256k1 private key generated and saved."
        : "Private key is ready.",
      persisted: true,
    };
  }

  async _runGenerateCsr(settings) {
    if (!isValidPrivateKeyPem(settings[K.PRIVATE_KEY])) {
      return { success: false, message: "Complete Step 2 (private key) first." };
    }

    const result = await generateZatcaCsr(settings);
    await settingsService.set(K.CERTIFICATE_REQUEST, result.pem);

    return {
      success: true,
      message: "CSR generated successfully.",
      csrPem: result.pem,
      csrBase64: result.base64,
      savedFields: { [K.CERTIFICATE_REQUEST]: result.pem },
    };
  }
}

export const zatcaOnboardingService = new ZatcaOnboardingService();
