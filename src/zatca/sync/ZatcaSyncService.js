import { parseZatcaConfig, resolveActivePhase } from "../core/config";
import {
  ZATCA_PHASES,
  ZATCA_QUEUE_STATUS,
  ZATCA_SYNC_SETTINGS,
  ZATCA_MAX_RETRY_COUNT,
  ZATCA_SYNC_INTERVAL_MS,
} from "../core/constants";
import { zatcaLogger } from "../core/logger";
import { zatcaInvoiceRepository } from "../repositories/ZatcaInvoiceRepository";
import { ZatcaApiClient } from "../phase2/apiClient";
import { signZatcaInvoice } from "../phase2/invoiceSigner";
import { assertInvoiceVatMatchesCertificate } from "../core/vatResolver";
import { settingsService } from "../../services/SettingsService";
import { isOnline, subscribeNetworkStatus } from "./networkMonitor";
import {
  resolveSyncApiOperation,
  explainSyncHttpError,
  buildSyncContext,
  describeSandboxVerification,
} from "./syncRouter";
import { formatZatcaApiError } from "../core/httpClient";

class ZatcaSyncService {
  constructor() {
    this.isRunning = false;
    this.isSyncing = false;
    this.offlineSimulation = false;
    this.intervalId = null;
    this.unsubscribeNetwork = null;
    this.settingsProvider = null;
    this.listeners = new Set();
  }

  setOfflineSimulation(enabled) {
    this.offlineSimulation = Boolean(enabled);
    zatcaLogger.info(`Offline simulation ${this.offlineSimulation ? "enabled" : "disabled"}`);
  }

  isOfflineSimulation() {
    return this.offlineSimulation;
  }

  configure(settingsProvider) {
    this.settingsProvider = settingsProvider;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        zatcaLogger.error("Sync listener failed", err);
      }
    }
  }

  _getSettings() {
    return this.settingsProvider?.() || {};
  }

  _isPhase2Active(settings) {
    return resolveActivePhase(settings) === ZATCA_PHASES.PHASE2;
  }

  async getDashboardStats() {
    const stats = await zatcaInvoiceRepository.getQueueStats();
    const lastSyncAt = await settingsService.get(ZATCA_SYNC_SETTINGS.LAST_SYNC_AT, "");
    return {
      ...stats,
      lastSyncAt,
      online: isOnline(),
    };
  }

  async refreshStatus() {
    return this.getDashboardStats();
  }

  async getSyncReadiness(settings = null) {
    const config = parseZatcaConfig(settings || this._getSettings());
    return buildSyncContext(config);
  }

  async syncInvoiceById(id, settings = null, { force = false } = {}) {
    if (this.offlineSimulation) {
      return {
        id,
        success: false,
        error: "Offline simulation is active — disable it to sync with ZATCA.",
      };
    }

    const resolvedSettings = settings || this._getSettings();
    const config = parseZatcaConfig(resolvedSettings);
    const row = await zatcaInvoiceRepository.getById(id);

    if (!row) {
      throw new Error("Queue item not found.");
    }
    if (row.status === ZATCA_QUEUE_STATUS.SYNCED) {
      return { id, skipped: true, status: row.status, saleNumber: row.sale_number };
    }
    if (
      !force &&
      row.retry_count >= ZATCA_MAX_RETRY_COUNT &&
      row.status === ZATCA_QUEUE_STATUS.FAILED
    ) {
      throw new Error(
        `Maximum retry count (${ZATCA_MAX_RETRY_COUNT}) reached. Click Sync again to force retry.`
      );
    }

    if (force && row.status === ZATCA_QUEUE_STATUS.FAILED) {
      await zatcaInvoiceRepository.prepareForManualSync(id);
    }

    await zatcaInvoiceRepository.markSending(id);
    this._notify({ type: "item-updated", id, status: ZATCA_QUEUE_STATUS.SENDING });

    let payload = {};
    try {
      payload = JSON.parse(row.payload_json || "{}");
    } catch {
      payload = {};
    }

    const apiClient = new ZatcaApiClient(config, resolvedSettings);
    const syncRoute = resolveSyncApiOperation(config);

    if (!syncRoute.operationId) {
      const message = syncRoute.error || "ZATCA credentials not configured.";
      await zatcaInvoiceRepository.markFailed(id, message, { error: message });
      this._notify({ type: "item-updated", id, status: ZATCA_QUEUE_STATUS.FAILED, error: message });
      return { id, success: false, error: message, saleNumber: row.sale_number };
    }

    const invoicePayload = {
      ...payload,
      uuid: payload.uuid || row.invoice_uuid,
      invoiceHash: payload.invoiceHash || payload.hash || row.invoice_hash,
      saleNumber: payload.saleNumber || row.sale_number,
      created_at: payload.created_at || row.sale_date,
      customer_name: payload.customer_name || row.customer_name,
    };

    const useProductionCert = syncRoute.operationId === "reporting_single";

    let signed;
    try {
      signed = await signZatcaInvoice(config, invoicePayload, {
        production: useProductionCert,
      });
      assertInvoiceVatMatchesCertificate(config, signed.signedXml, {
        production: useProductionCert,
      });
    } catch (signErr) {
      const message = signErr.message || "Failed to sign invoice for ZATCA.";
      await zatcaInvoiceRepository.markFailed(id, message, { error: message });
      this._notify({ type: "item-updated", id, status: ZATCA_QUEUE_STATUS.FAILED, error: message });
      return { id, success: false, error: message, saleNumber: row.sale_number };
    }

    const submitPayload = {
      ...invoicePayload,
      egsUuid: signed.egsUuid,
      invoiceHash: signed.invoiceHash,
      invoiceBase64: signed.invoiceBase64,
      signedXml: signed.signedXml,
    };

    try {
      const apiResult =
        syncRoute.operationId === "compliance_invoice"
          ? await apiClient.submitComplianceInvoice(submitPayload)
          : await apiClient.submitReportingInvoice(submitPayload);

      if (apiResult.success === false) {
        let message = apiResult.message || "ZATCA rejected the invoice.";
        if (apiResult.response) {
          const detail = formatZatcaApiError({ status: apiResult.httpStatus, body: apiResult.response });
          if (detail && detail !== message) message = detail;
        }
        const authHint = explainSyncHttpError(
          apiResult.httpStatus || (message.includes("401") ? 401 : 0),
          syncRoute.authMode,
          syncRoute.operationId
        );
        if (authHint) message = authHint;

        await zatcaInvoiceRepository.markFailed(id, message, apiResult);
        this._notify({ type: "item-updated", id, status: ZATCA_QUEUE_STATUS.FAILED, error: message });
        return {
          id,
          success: false,
          error: message,
          result: apiResult,
          syncRoute,
          saleNumber: row.sale_number,
          httpStatus: apiResult.httpStatus,
        };
      }

      await zatcaInvoiceRepository.markSynced(id, {
        invoiceHash: signed.invoiceHash,
        invoiceUuid: row.invoice_uuid,
        signedXml: signed.signedXml,
        qrTlv: signed.qr,
        response: { ...apiResult, syncRoute, egsUuid: signed.egsUuid },
      });
      this._notify({ type: "item-updated", id, status: ZATCA_QUEUE_STATUS.SYNCED });
      return {
        id,
        success: true,
        result: apiResult,
        syncRoute,
        saleNumber: row.sale_number,
        httpStatus: apiResult.httpStatus,
        verificationHint: describeSandboxVerification(config, apiResult),
      };
    } catch (err) {
      const message = err.message || "Network error while submitting invoice.";
      await zatcaInvoiceRepository.markFailed(id, message, { error: message });
      this._notify({ type: "item-updated", id, status: ZATCA_QUEUE_STATUS.FAILED, error: message });
      return { id, success: false, error: message, saleNumber: row.sale_number };
    }
  }

  async _syncRows(rows, settings) {
    const results = [];

    for (const row of rows) {
      if (row.status === ZATCA_QUEUE_STATUS.SYNCED) continue;
      if (
        row.status === ZATCA_QUEUE_STATUS.FAILED &&
        row.retry_count >= ZATCA_MAX_RETRY_COUNT
      ) {
        results.push({
          id: row.id,
          success: false,
          skipped: true,
          error: "Maximum retries reached",
          saleNumber: row.sale_number,
        });
        continue;
      }

      try {
        const result = await this.syncInvoiceById(row.id, settings);
        results.push(result);
      } catch (err) {
        const message = err.message || "Sync failed unexpectedly.";
        try {
          await zatcaInvoiceRepository.markFailed(row.id, message, { error: message });
        } catch {
          await zatcaInvoiceRepository.recoverStuckSending();
        }
        results.push({
          id: row.id,
          success: false,
          error: message,
          saleNumber: row.sale_number,
        });
      }
    }

    await settingsService.set(ZATCA_SYNC_SETTINGS.LAST_SYNC_AT, new Date().toISOString());
    this._notify({ type: "sync-complete", results });
    return results;
  }

  async syncAll(settings = null) {
    if (this.isSyncing) {
      return { success: false, error: "Sync already in progress." };
    }

    const resolvedSettings = settings || this._getSettings();
    if (!this._isPhase2Active(resolvedSettings)) {
      return { success: false, error: "ZATCA Phase 2 is not active." };
    }
    if (!isOnline()) {
      return { success: false, error: "No internet connection." };
    }

    this.isSyncing = true;
    this._notify({ type: "sync-start" });

    try {
      await zatcaInvoiceRepository.recoverStuckSending();

      const pending = await zatcaInvoiceRepository.getPendingForSync();
      const rows = pending.filter((row) => row.status !== ZATCA_QUEUE_STATUS.SYNCED);
      const results = await this._syncRows(rows, resolvedSettings);
      const synced = results.filter((r) => r.success).length;
      const failed = results.filter((r) => r.success === false && !r.skipped).length;
      return { success: true, synced, failed, total: results.length, results };
    } finally {
      this.isSyncing = false;
    }
  }

  async syncSelected(ids, settings = null) {
    if (!ids?.length) {
      return { success: false, error: "No invoices selected." };
    }
    if (this.isSyncing) {
      return { success: false, error: "Sync already in progress." };
    }
    if (!isOnline()) {
      return { success: false, error: "No internet connection." };
    }

    const resolvedSettings = settings || this._getSettings();
    if (!this._isPhase2Active(resolvedSettings)) {
      return { success: false, error: "ZATCA Phase 2 is not active." };
    }

    this.isSyncing = true;
    this._notify({ type: "sync-start" });

    try {
      await zatcaInvoiceRepository.recoverStuckSending();

      const rows = [];
      for (const id of ids) {
        const row = await zatcaInvoiceRepository.getById(id);
        if (row && row.status !== ZATCA_QUEUE_STATUS.SYNCED) {
          rows.push(row);
        }
      }
      const results = await this._syncRows(rows, resolvedSettings);
      return {
        success: true,
        synced: results.filter((r) => r.success).length,
        failed: results.filter((r) => r.success === false && !r.skipped).length,
        total: results.length,
        results,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  async retryFailed(ids = null, settings = null) {
    const resolvedSettings = settings || this._getSettings();
    if (!this._isPhase2Active(resolvedSettings)) {
      return { success: false, error: "ZATCA Phase 2 is not active." };
    }

    if (ids?.length) {
      await zatcaInvoiceRepository.resetFailedToPending(ids);
    } else {
      await zatcaInvoiceRepository.resetFailedToPending();
    }

    if (!isOnline()) {
      return {
        success: true,
        queued: true,
        message: "Failed invoices reset to pending. Sync when online.",
      };
    }

    return this.syncAll(resolvedSettings);
  }

  _isAutoSyncEnabled(settings = null) {
    const resolved = settings || this._getSettings();
    const value = resolved[ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED];
    if (value === "1" || value === "true") return true;
    if (value === "0" || value === "false") return false;
    return false;
  }

  async tryAutoSync(settings = null) {
    const resolvedSettings = settings || this._getSettings();
    if (!this._isAutoSyncEnabled(resolvedSettings)) {
      return { skipped: true, reason: "manual_sync" };
    }

    if (!this._isPhase2Active(resolvedSettings) || !isOnline() || this.isSyncing) {
      return { skipped: true };
    }

    const stats = await zatcaInvoiceRepository.getQueueStats();
    if (stats.pending === 0 && stats.failed === 0) {
      return { skipped: true };
    }

    zatcaLogger.info("Auto-syncing pending ZATCA invoices", stats);
    return this.syncAll(resolvedSettings);
  }

  startBackgroundSync(settingsProvider) {
    if (this.isRunning) return;
    this.configure(settingsProvider);
    this.isRunning = true;

    zatcaInvoiceRepository.recoverStuckSending().catch((err) => {
      zatcaLogger.warn("Could not recover stuck ZATCA queue items", err);
    });

    this.unsubscribeNetwork = subscribeNetworkStatus((online) => {
      this._notify({ type: "network", online });
      if (online && this._isAutoSyncEnabled()) {
        this.tryAutoSync().catch((err) => {
          zatcaLogger.error("Auto-sync on reconnect failed", err);
        });
      }
    });

    if (this._isAutoSyncEnabled()) {
      this.intervalId = setInterval(() => {
        this.tryAutoSync().catch((err) => {
          zatcaLogger.error("Scheduled auto-sync failed", err);
        });
      }, ZATCA_SYNC_INTERVAL_MS);

      this.tryAutoSync().catch((err) => {
        zatcaLogger.error("Initial auto-sync failed", err);
      });
    } else {
      zatcaLogger.info("ZATCA manual sync mode — background auto-sync disabled");
    }
  }

  stopBackgroundSync() {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  restartBackgroundSync(settingsProvider = null) {
    this.stopBackgroundSync();
    this.startBackgroundSync(settingsProvider || this.settingsProvider);
  }
}

export const zatcaSyncService = new ZatcaSyncService();
