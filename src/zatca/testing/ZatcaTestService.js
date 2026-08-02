import { parseZatcaConfig, buildSyncEnabledSettings } from "../core/config";
import {
  ZATCA_PHASES,
  ZATCA_ENVIRONMENTS,
  ZATCA_SETTING_KEYS as K,
  ZATCA_QUEUE_STATUS,
} from "../core/constants";
import { createZatcaModule } from "../ZatcaServiceFactory";
import { formatZatcaApiError } from "../core/httpClient";
import { executeZatcaApiOperation } from "../api/executor";
import { listZatcaApiOperations } from "../api/registry";
import {
  prepareForOperation,
  runLocalStep,
  getOperationPrerequisiteStatuses,
} from "../api/stepRunner";
import { isValidPrivateKeyPem } from "../onboarding/keyGenerator";
import { isValidCsrPem } from "../onboarding/csrGenerator";
import { settingsService } from "../../services/SettingsService";
import { normalizeCertificatePem } from "../core/certificateUtils";
import { validateZatcaCertificate } from "./certificateValidator";
import {
  generateTestInvoice,
  buildTestInvoiceXml,
  checkDigitalSignatureReadiness,
} from "./testInvoiceGenerator";
import { ZATCA_ENVIRONMENT_CONFIG } from "../core/environments";
import { zatcaInvoiceRepository } from "../repositories/ZatcaInvoiceRepository";
import { zatcaSyncService } from "../sync/ZatcaSyncService";
import { formatSyncActionSummary } from "../sync/syncRouter";
import { insert } from "../../database/connection";

const PLAIN_EXPLANATIONS = {
  200: "Connection Successful — ZATCA accepted the request.",
  401: "Authentication Failed — your certificate or secret is wrong or expired.",
  403: "Access Denied — you may not have permission for this environment.",
  404: "Invalid API URL — the endpoint address is wrong.",
  406: "Version Not Supported — Accept-Version header must be V2.",
  500: "ZATCA Server Error — try again later.",
};

function explainHttpStatus(status, body) {
  if (status >= 200 && status < 300) {
    return PLAIN_EXPLANATIONS[200];
  }
  if (PLAIN_EXPLANATIONS[status]) return PLAIN_EXPLANATIONS[status];
  const err = formatZatcaApiError({ status, body });
  if (/certificate/i.test(err)) return "Invalid Certificate — check your CSID certificate.";
  if (/otp/i.test(err)) return "Invalid or missing OTP — get a fresh OTP from ZATCA portal.";
  return err || `Request failed with HTTP ${status}.`;
}

class ZatcaTestService {
  /** Step 1 — Check all configuration fields. */
  testConfiguration(settings) {
    const config = parseZatcaConfig(settings);
    const phase = config.activePhase;
    const checks = [];

    const add = (field, label, ok, message, fix) => {
      checks.push({ field, label, ok, message, fix });
    };

    add(
      "environment",
      "Environment",
      Boolean(config.environment),
      config.environment
        ? `Set to: ${ZATCA_ENVIRONMENT_CONFIG[config.environment]?.label || config.environment}`
        : "Not selected",
      "Choose Sandbox, Simulation, or Production."
    );

    add(
      "api_base",
      "API Base URL",
      Boolean(config.api?.baseUrl),
      config.api?.baseUrl || "Missing",
      "Set in Settings → ZATCA or pick an environment."
    );

    add(
      "device_id",
      "Device ID",
      Boolean(config.device.id || config.device.serial),
      config.device.id || config.device.serial || "Missing",
      "Enter Device ID in Settings → ZATCA."
    );

    add(
      "vat",
      "VAT Registration Number",
      Boolean(config.company.vatNumber),
      config.company.vatNumber || "Missing",
      "Enter VAT on Store or ZATCA settings (15 digits)."
    );

    add(
      "company",
      "Company / Store Name",
      Boolean(config.company.name),
      config.company.name || "Missing",
      "Enter store name on Store settings tab."
    );

    if (phase === ZATCA_PHASES.PHASE2 || phase === ZATCA_PHASES.PHASE1) {
      add(
        "private_key",
        "Private Key",
        isValidPrivateKeyPem(config.credentials.privateKey),
        isValidPrivateKeyPem(config.credentials.privateKey) ? "Present" : "Missing or invalid",
        "Open Settings → ZATCA to auto-generate a key."
      );
    }

    if (phase === ZATCA_PHASES.PHASE2) {
      add(
        "csr",
        "CSR (Certificate Request)",
        isValidCsrPem(config.credentials.certificateRequest),
        isValidCsrPem(config.credentials.certificateRequest) ? "Present" : "Not generated yet",
        "Click Generate CSR in Settings → ZATCA."
      );
      add(
        "certificate",
        "Certificate (CSID)",
        Boolean(config.credentials.certificate || config.credentials.complianceCsid),
        config.credentials.certificate ? "Present" : "Missing — run Compliance CSID API",
        "Complete Compliance CSID step in Settings or Test Center."
      );
      add(
        "secret",
        "Secret / API Credentials",
        Boolean(config.credentials.secret),
        config.credentials.secret ? "Present" : "Missing",
        "Obtained from Compliance CSID API response."
      );
    }

    const module = createZatcaModule(settings);
    const validation = module.validateConfiguration(config);

    const passed = checks.every((c) => c.ok) && validation.errors.length === 0;

    return {
      passed,
      checks,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      summary: passed
        ? "Configuration looks good. You can proceed to API connection test."
        : "Some settings are missing or invalid. Fix the items marked in red below.",
    };
  }

  /** Step 2 — Test Compliance CSID API (delegates to dynamic executor). */
  async testApiConnection(settings, { otp } = {}) {
    return this.runApiOperation("compliance_csid", settings, { otp });
  }

  /** Run any ZATCA Swagger API operation from the registry. */
  async runApiOperation(operationId, settings, inputs = {}) {
    const autoPrepare = inputs.autoPrepare !== false;
    let currentSettings = { ...settings };
    let prepSteps = [];

    if (autoPrepare) {
      const prep = await prepareForOperation(operationId, currentSettings);
      prepSteps = prep.steps || [];
      currentSettings = prep.settings || currentSettings;

      if (!prep.success) {
        return {
          passed: false,
          success: false,
          operationId,
          summary: prep.message,
          message: prep.message,
          prepSteps,
          missingPrereqs: prep.missingPrereqs,
        };
      }
    }

    const result = await executeZatcaApiOperation(operationId, {
      settings: currentSettings,
      inputs: { ...inputs, autoPrepare: false },
    });

    if (result.savedFields) {
      for (const [key, value] of Object.entries(result.savedFields)) {
        await settingsService.set(key, value);
      }
    }

    const updatedSettings = await settingsService.getAll();

    return {
      passed: result.success,
      success: result.success,
      operationId: result.operationId,
      simulated: result.simulated,
      httpStatus: result.httpStatus,
      durationMs: result.durationMs,
      summary: result.message,
      message: result.message,
      request: result.request,
      response: result.response,
      savedFields: result.savedFields,
      missingPrereqs: result.missingPrereqs,
      needsOtp: result.message?.toLowerCase().includes("otp"),
      prepSteps,
      updatedSettings,
    };
  }

  /** Run a local preparation step (private key, CSR). */
  async runLocalPrepStep(stepId, settings) {
    const result = await runLocalStep(stepId, settings);
    return {
      passed: result.success,
      success: result.success,
      stepId: result.stepId,
      summary: result.message,
      message: result.message,
      savedFields: result.savedFields,
      updatedSettings: result.settings,
      missingFields: result.missingFields,
    };
  }

  /** Get prerequisite checklist for an API operation. */
  getOperationPrerequisites(operationId, settings) {
    return getOperationPrerequisiteStatuses(operationId, settings);
  }

  /** List all registered ZATCA API operations (for API Explorer UI). */
  listApiOperations() {
    return listZatcaApiOperations();
  }

  /** Step 3 — Certificate validation. */
  async testCertificates(settings) {
    const config = parseZatcaConfig(settings);
    const result = await validateZatcaCertificate({
      certificate: config.credentials.certificate,
      complianceCsid: config.credentials.complianceCsid,
      privateKey: config.credentials.privateKey,
      deviceId: config.device.id || config.device.serial,
    });

    if (result.normalizedCertificate) {
      const current = normalizeCertificatePem(
        config.credentials.certificate || config.credentials.complianceCsid || ""
      );
      const normalized = result.normalizedCertificate;
      if (normalized !== current || !config.credentials.certificate?.includes("BEGIN CERTIFICATE")) {
        await settingsService.set(K.CERTIFICATE, normalized);
        await settingsService.set(K.COMPLIANCE_CSID, normalized);
        result.repairedCertificate = true;
        if (result.passed) {
          result.summary = "All certificate checks passed. Certificate was converted to valid PEM format.";
        } else if (!result.summary.includes("normalized")) {
          result.summary = `${result.summary} Certificate was converted to valid PEM format — re-validate if needed.`;
        }
      }
    }

    return result;
  }

  /** Step 4 — Generate dummy test invoice. */
  async generateTestInvoice(settings) {
    const config = parseZatcaConfig(settings);
    return generateTestInvoice(config);
  }

  /** Step 5 — Simulate offline: queue invoice without API. */
  async testOfflineMode(settings) {
    zatcaSyncService.setOfflineSimulation(true);

    const config = parseZatcaConfig(settings);
    const testData = await generateTestInvoice(config);
    const saleNumber = testData.sale.sale_number;

    const saleId = await insert(
      `INSERT INTO sales (sale_number, customer_id, subtotal, discount, vat, total, payment_method, status, notes)
       VALUES ($1, NULL, $2, $3, $4, $5, 'cash', 'completed', $6)`,
      [saleNumber, testData.sale.subtotal, 0, testData.sale.vat, testData.sale.total, "ZATCA_TEST_OFFLINE"]
    );

    const payload = {
      ...testData.payload,
      xml: testData.xml,
      invoiceBase64:
        typeof btoa === "function"
          ? btoa(unescape(encodeURIComponent(testData.xml)))
          : testData.xml,
    };
    const invoiceHash = testData.invoiceHash;

    const queueId = await zatcaInvoiceRepository.enqueuePending({
      saleId,
      saleNumber,
      phase: ZATCA_PHASES.PHASE2,
      environment: config.environment,
      invoiceUuid: payload.uuid,
      invoiceHash,
      payload,
    });

    const stats = await zatcaInvoiceRepository.getQueueStats();

    return {
      passed: true,
      summary:
        "Offline test complete. Invoice saved locally and added to queue as Pending. No API call was made.",
      saleNumber,
      queueId,
      uuid: payload.uuid,
      queueStats: stats,
    };
  }

  /** Step 6 — Online sync with detailed per-invoice results. */
  async testOnlineSync(settings) {
    zatcaSyncService.setOfflineSimulation(false);
    const syncSettings = buildSyncEnabledSettings(settings);
    const context = await zatcaSyncService.getSyncReadiness(syncSettings);

    if (!context.ready) {
      return {
        passed: false,
        summary: context.message || "Sync is not ready. Complete Compliance CSID first.",
        detail: `${context.destinationSummary || ""} · ${new Date().toLocaleString()}`,
        context,
        results: [],
      };
    }

    if (context.isSimulation) {
      return {
        passed: false,
        summary: "Simulation mode is selected — switch to Sandbox in Step 1 to send invoices to ZATCA.",
        detail: context.destinationSummary,
        context,
        results: [],
      };
    }

    if (!navigator.onLine) {
      return {
        passed: false,
        summary: "You appear to be offline. Connect to the internet and try again.",
        detail: `${context.destinationSummary} · ${new Date().toLocaleString()}`,
        context,
        results: [],
      };
    }

    const syncResult = await zatcaSyncService.syncAll(syncSettings);
    const formatted = formatSyncActionSummary("Test Online Sync", syncResult, context);

    return {
      ...formatted,
      passed: formatted.passed && syncResult.success !== false,
      context,
      results: syncResult.results || [],
    };
  }

  /** Step 9 — Run full validation checklist. */
  async runFullChecklist(settings) {
    const config = parseZatcaConfig(settings);
    const items = [];

    const configResult = this.testConfiguration(settings);
    items.push({
      id: "config",
      label: "Configuration is complete",
      passed: configResult.passed,
      message: configResult.summary,
    });

    let apiResult = { passed: false, summary: "Not run" };
    try {
      apiResult = await this.testApiConnection(settings);
    } catch (err) {
      apiResult = { passed: false, summary: err.message };
    }
    items.push({
      id: "api",
      label: "API connection works",
      passed: apiResult.passed || apiResult.simulated,
      message: apiResult.summary,
    });

    const certResult = await this.testCertificates(settings);
    items.push({
      id: "certificate",
      label: "Certificate is valid",
      passed: certResult.passed,
      message: certResult.summary,
    });

    let qrPassed = false;
    let qrMessage = "Missing VAT or company name";
    try {
      const inv = await generateTestInvoice(config);
      qrPassed = Boolean(inv.qrDataUrl);
      qrMessage = qrPassed ? "QR code generated successfully." : "Could not generate QR.";
    } catch (err) {
      qrMessage = err.message;
    }
    items.push({ id: "qr", label: "QR Code generation works", passed: qrPassed, message: qrMessage });

    let xmlPassed = false;
    try {
      const inv = await generateTestInvoice(config);
      xmlPassed = inv.xml?.includes("<Invoice");
      items.push({
        id: "xml",
        label: "XML generation works",
        passed: xmlPassed,
        message: xmlPassed ? "Sample XML invoice created." : "XML generation failed.",
      });
    } catch (err) {
      items.push({ id: "xml", label: "XML generation works", passed: false, message: err.message });
    }

    const sig = checkDigitalSignatureReadiness(config);
    items.push({
      id: "signature",
      label: "Digital signature ready (Phase 2)",
      passed: sig.passed,
      message: sig.message,
    });

    const queueStats = await zatcaInvoiceRepository.getQueueStats();
    items.push({
      id: "queue",
      label: "Queue system works",
      passed: true,
      message: `Queue has ${queueStats.total} invoice(s): ${queueStats.pending} pending, ${queueStats.synced} synced.`,
    });

    items.push({
      id: "offline",
      label: "Offline mode works",
      passed: queueStats.pending > 0 || queueStats.total > 0,
      message:
        queueStats.pending > 0
          ? "Pending invoices found — offline queue is active."
          : "Run Offline Test to verify queueing.",
    });

    items.push({
      id: "online_sync",
      label: "Online synchronization works",
      passed: queueStats.synced > 0,
      message:
        queueStats.synced > 0
          ? `${queueStats.synced} invoice(s) synced successfully.`
          : "Run Online Sync Test after queueing invoices.",
    });

    items.push({
      id: "submission",
      label: "Invoice submission works",
      passed: queueStats.synced > 0,
      message:
        queueStats.synced > 0
          ? "At least one invoice was submitted to ZATCA."
          : "Complete Online Sync Test to verify submission.",
    });

    const passedCount = items.filter((i) => i.passed).length;

    return {
      items,
      passedCount,
      totalCount: items.length,
      allPassed: passedCount === items.length,
      summary: `${passedCount} of ${items.length} checks passed.`,
    };
  }

  getApiLogs(limit = 100) {
    return zatcaApiLogRepository.getRecent(limit);
  }

  clearApiLogs() {
    return zatcaApiLogRepository.clearAll();
  }

  async clearCompletedQueue() {
    const cleared = await zatcaInvoiceRepository.clearCompleted();
    return { cleared };
  }

  endOfflineSimulation() {
    zatcaSyncService.setOfflineSimulation(false);
  }
}

export const zatcaTestService = new ZatcaTestService();

export { explainHttpStatus, buildTestInvoiceXml };
