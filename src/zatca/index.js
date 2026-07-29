import { createZatcaModule, parseZatcaConfig, resolveActivePhase } from "./ZatcaServiceFactory";
import { zatcaLogger } from "./core/logger";
import { isZatcaEnabled } from "./core/config";

/**
 * Facade service — the rest of the POS uses this class only.
 * It delegates to the active phase module via the factory.
 */
class ZatcaIntegrationService {
  constructor(settingsProvider) {
    this.settingsProvider = settingsProvider;
  }

  _resolveSettings(settings) {
    return settings || this.settingsProvider?.() || {};
  }

  _getModule(settings) {
    return createZatcaModule(this._resolveSettings(settings));
  }

  getActivePhase(settings) {
    return resolveActivePhase(this._resolveSettings(settings));
  }

  isEnabled(settings) {
    return isZatcaEnabled(this._resolveSettings(settings));
  }

  getConfig(settings) {
    return parseZatcaConfig(this._resolveSettings(settings));
  }

  getStatus(settings) {
    const config = this.getConfig(settings);
    return this._getModule(settings).getStatus(config);
  }

  validateConfiguration(settings) {
    const config = this.getConfig(settings);
    return this._getModule(settings).validateConfiguration(config);
  }

  canGenerateReceiptQr({ sale, settings }) {
    if (!this.isEnabled(settings)) return false;
    return this._getModule(settings).canGenerateReceiptQr({ sale, settings });
  }

  async generateReceiptQr({ sale, settings }) {
    if (!this.isEnabled(settings)) return null;

    try {
      return await this._getModule(settings).generateReceiptQr({ sale, settings });
    } catch (err) {
      zatcaLogger.error("Receipt QR generation failed", err);
      return null;
    }
  }

  async processSale({ sale, items, settings }) {
    if (!this.isEnabled(settings)) {
      return { success: true, skipped: true, phase: "disabled" };
    }

    try {
      return await this._getModule(settings).processSale({ sale, items, settings });
    } catch (err) {
      zatcaLogger.error("Sale ZATCA processing failed", err);
      return { success: false, error: err.message };
    }
  }
}

export { ZatcaIntegrationService };
