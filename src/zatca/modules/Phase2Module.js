import { ZATCA_PHASES, ZATCA_PHASE_LABELS } from "../core/constants";
import { parseZatcaConfig } from "../core/config";
import { zatcaLogger } from "../core/logger";
import { Phase1ZatcaModule } from "./Phase1Module";
import {
  buildSimplifiedInvoicePayload,
  computePlaceholderInvoiceHash,
} from "../phase2/invoiceBuilder";
import { zatcaInvoiceRepository } from "../repositories/ZatcaInvoiceRepository";

/** Phase 2 — Phase 1 QR + queued e-invoice submission to ZATCA. */
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
      ready: validation.valid,
      messages: validation.valid
        ? [
            "Phase 2 ready — receipts print QR immediately; invoices queue locally. Sync manually from Sales → ZATCA Sync.",
            ...(validation.warnings.length ? validation.warnings : []),
          ]
        : validation.errors,
    };
  }

  async processSale(context) {
    const config = parseZatcaConfig(context.settings);
    const { sale, items } = context;

    if (!sale?.id) {
      return { success: true, skipped: true, phase: ZATCA_PHASES.PHASE2 };
    }

    const alreadyQueued = await zatcaInvoiceRepository.hasActiveQueueEntry(sale.id);
    if (alreadyQueued) {
      zatcaLogger.debug("Sale already in ZATCA queue", { saleNumber: sale.sale_number });
      return {
        success: true,
        phase: ZATCA_PHASES.PHASE2,
        queued: true,
        skipped: true,
      };
    }

    zatcaLogger.info("Phase 2 queuing sale for ZATCA sync", {
      saleNumber: sale?.sale_number,
      environment: config.environment,
    });

    const invoicePayload = buildSimplifiedInvoicePayload({ sale, items, config });
    const invoiceHash = computePlaceholderInvoiceHash(invoicePayload);

    const queueId = await zatcaInvoiceRepository.enqueuePending({
      saleId: sale.id,
      saleNumber: sale.sale_number,
      phase: ZATCA_PHASES.PHASE2,
      environment: config.environment,
      invoiceUuid: invoicePayload.uuid,
      invoiceHash,
      payload: invoicePayload,
    });

    return {
      success: true,
      phase: ZATCA_PHASES.PHASE2,
      queued: true,
      queueId,
      qrRequired: true,
      message: "Invoice saved locally. Sync manually from Sales → ZATCA Sync when ready.",
    };
  }
}

export const phase2ZatcaModule = new Phase2ZatcaModule();
