import { ZATCA_PHASES, ZATCA_PHASE_LABELS } from "../core/constants";
import { parseZatcaConfig } from "../core/config";
import { zatcaLogger } from "../core/logger";
import { Phase1ZatcaModule } from "./Phase1Module";
import { ZatcaApiClient } from "../phase2/apiClient";
import {
  buildSimplifiedInvoicePayload,
  computePlaceholderInvoiceHash,
} from "../phase2/invoiceBuilder";
import { zatcaInvoiceRepository } from "../repositories/ZatcaInvoiceRepository";

/** Phase 2 — Phase 1 QR + e-invoice submission to ZATCA Fatoora API. */
export class Phase2ZatcaModule extends Phase1ZatcaModule {
  constructor() {
    super();
    this.phase = ZATCA_PHASES.PHASE2;
  }

  validateConfiguration(config) {
    const base = super.validateConfiguration(config);
    const errors = [...base.errors];
    const warnings = [...base.warnings];

    if (!config.device.serial) {
      warnings.push("Device serial number recommended for Phase 2 onboarding.");
    }
    if (!config.credentials.certificate || !config.credentials.privateKey) {
      warnings.push("Certificate and private key required before live Phase 2 submission.");
    }
    if (config.environment === "production" && !config.credentials.productionCsid) {
      errors.push("Production CSID required for production environment.");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getStatus(config) {
    const validation = this.validateConfiguration(config);
    return {
      phase: ZATCA_PHASES.PHASE2,
      enabled: true,
      label: ZATCA_PHASE_LABELS[ZATCA_PHASES.PHASE2],
      environment: config.environmentLabel,
      ready: validation.valid && validation.warnings.length === 0,
      messages: validation.valid
        ? validation.warnings.length
          ? validation.warnings
          : ["Phase 2 ready — QR + sandbox/production API submission enabled."]
        : validation.errors,
    };
  }

  async processSale(context) {
    const config = parseZatcaConfig(context.settings);
    const { sale, items } = context;

    zatcaLogger.info("Phase 2 processing sale", {
      saleNumber: sale?.sale_number,
      environment: config.environment,
    });

    const invoicePayload = buildSimplifiedInvoicePayload({ sale, items, config });
    const invoiceHash = computePlaceholderInvoiceHash(invoicePayload);
    const apiClient = new ZatcaApiClient(config);

    let apiResult;
    try {
      apiResult = await apiClient.submitReportingInvoice(invoicePayload);
    } catch (err) {
      zatcaLogger.error("Phase 2 API submission failed", err);
      await zatcaInvoiceRepository.recordSubmission({
        saleId: sale.id,
        saleNumber: sale.sale_number,
        phase: ZATCA_PHASES.PHASE2,
        environment: config.environment,
        status: "error",
        invoiceUuid: invoicePayload.uuid,
        invoiceHash,
        response: { error: err.message },
      });
      return {
        success: false,
        phase: ZATCA_PHASES.PHASE2,
        error: err.message,
      };
    }

    await zatcaInvoiceRepository.recordSubmission({
      saleId: sale.id,
      saleNumber: sale.sale_number,
      phase: ZATCA_PHASES.PHASE2,
      environment: config.environment,
      status: apiResult.status,
      invoiceUuid: apiResult.invoiceUuid || invoicePayload.uuid,
      invoiceHash,
      response: apiResult,
    });

    return {
      success: apiResult.success !== false,
      phase: ZATCA_PHASES.PHASE2,
      invoiceUuid: apiResult.invoiceUuid,
      invoiceHash,
      sandbox: apiResult.sandbox,
      message: apiResult.message,
      warnings: apiResult.warnings,
    };
  }
}

export const phase2ZatcaModule = new Phase2ZatcaModule();
