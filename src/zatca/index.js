import { createZatcaModule, parseZatcaConfig, resolveActivePhase } from "./ZatcaServiceFactory";
import { zatcaLogger } from "./core/logger";
import { isZatcaEnabled } from "./core/config";
import { zatcaInvoiceRepository } from "./repositories/ZatcaInvoiceRepository";
import { zatcaSyncService } from "./sync/ZatcaSyncService";
import { ZATCA_SYNC_SETTINGS } from "./core/constants";

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

  getQueueItems(options) {
    return zatcaInvoiceRepository.getQueueItems(options);
  }

  getStatusBySaleIds(saleIds) {
    return zatcaInvoiceRepository.getStatusBySaleIds(saleIds);
  }

  getBySaleId(saleId) {
    return zatcaInvoiceRepository.getBySaleId(saleId);
  }

  getSignedXmlForSale(saleId) {
    return zatcaInvoiceRepository.getSignedXmlForSale(saleId);
  }

  getDailySyncDashboard(businessDate = null) {
    return zatcaInvoiceRepository.getDailySyncDashboard(businessDate);
  }

  getSyncPageDashboard(businessDate = null) {
    return zatcaInvoiceRepository.getSyncPageDashboard(businessDate);
  }

  isAutoSyncEnabled(settings = null) {
    const s = settings || this._resolveSettings();
    return s[ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED] === "1";
  }

  getDailySyncStats(businessDate = null) {
    return zatcaInvoiceRepository.getDailySyncStats(businessDate);
  }

  syncInvoiceById(id, settings, options) {
    return zatcaSyncService.syncInvoiceById(
      id,
      settings || this._resolveSettings(),
      options
    );
  }

  getQueueStats() {
    return zatcaSyncService.getDashboardStats();
  }

  refreshQueueStatus() {
    return zatcaSyncService.refreshStatus();
  }

  syncAll(settings) {
    return zatcaSyncService.syncAll(settings || this._resolveSettings());
  }

  syncSelected(ids, settings) {
    return zatcaSyncService.syncSelected(ids, settings || this._resolveSettings());
  }

  retryFailed(ids, settings) {
    return zatcaSyncService.retryFailed(ids, settings || this._resolveSettings());
  }

  subscribeSyncEvents(listener) {
    return zatcaSyncService.subscribe(listener);
  }

  startBackgroundSync() {
    zatcaSyncService.startBackgroundSync(this.settingsProvider);
  }

  restartBackgroundSync() {
    zatcaSyncService.restartBackgroundSync(this.settingsProvider);
  }
}

export { ZatcaIntegrationService };
