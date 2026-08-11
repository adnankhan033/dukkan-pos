import { ZATCA_PHASES, ZATCA_PHASE_LABELS } from "../core/constants";
import { parseZatcaConfig } from "../core/config";
import { resolveInvoiceVatNumber } from "../core/vatResolver";
import { zatcaLogger } from "../core/logger";
import { generateQrDataUrl } from "../phase1/qrGenerator";
import { BaseZatcaModule } from "./BaseZatcaModule";

export class Phase1ZatcaModule extends BaseZatcaModule {
  constructor() {
    super(ZATCA_PHASES.PHASE1);
  }

  validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    if (!config.company.vatNumber) {
      errors.push("VAT registration number is required for Phase 1 QR codes.");
    }
    if (!config.company.name) {
      errors.push("Company / store name is required for Phase 1 QR codes.");
    }
    if (config.environment === "production") {
      warnings.push("Phase 1 in production does not require API credentials — QR only.");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  getStatus(config) {
    const validation = this.validateConfiguration(config);
    return {
      phase: ZATCA_PHASES.PHASE1,
      enabled: true,
      label: ZATCA_PHASE_LABELS[ZATCA_PHASES.PHASE1],
      environment: config.environmentLabel,
      ready: validation.valid,
      messages: validation.valid
        ? ["Phase 1 ready — simplified tax invoice QR will print on receipts."]
        : validation.errors,
    };
  }

  canGenerateReceiptQr(context) {
    const config = parseZatcaConfig(context.settings);
    return Boolean(config.company.vatNumber && config.company.name);
  }

  async generateReceiptQr(context) {
    if (!this.canGenerateReceiptQr(context)) {
      zatcaLogger.warn("Phase 1 QR skipped — missing VAT or company name");
      return null;
    }

    const config = parseZatcaConfig(context.settings);
    const vatNumber = resolveInvoiceVatNumber(config);
    try {
      return await generateQrDataUrl({
        sellerName: config.company.name,
        vatNumber,
        sale: context.sale,
      });
    } catch (err) {
      zatcaLogger.error("Phase 1 QR generation failed", err);
      throw err;
    }
  }

  async processSale(context) {
    zatcaLogger.debug("Phase 1 sale processed (QR-only, no API submission)", {
      saleNumber: context.sale?.sale_number,
    });
    return {
      success: true,
      phase: ZATCA_PHASES.PHASE1,
      qrRequired: true,
    };
  }
}

export const phase1ZatcaModule = new Phase1ZatcaModule();
