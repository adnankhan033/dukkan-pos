import { invoke, isTauri } from "@tauri-apps/api/core";
import { query, queryOne, execute, runInTransaction, clearDatabaseData, clearDatabaseSection } from "../database/connection";
import { settingsService } from "./SettingsService";
import { DATA_CLEAR_SECTIONS } from "../utils/dataClearSections.js";
import {
  BACKUP_SETTING_KEYS,
  BACKUP_TYPES,
  decodeBackupSecret,
  encodeBackupSecret,
  getBackupBusinessDateKey,
  normalizeGmailAppPassword,
} from "../utils/backupSettings.js";
import { APP_NAME, APP_SLUG } from "../utils/appIdentity.js";

const BACKUP_TABLES = [
  "settings",
  "users",
  "user_subscriptions",
  "categories",
  "units",
  "products",
  "customers",
  "suppliers",
  "sales",
  "sale_items",
  "purchases",
  "purchase_items",
  "inventory",
  "expenses",
  "payments",
  "sale_returns",
  "sale_return_items",
  "zatca_invoices",
  "zatca_api_logs",
  "employees",
  "employee_salaries",
  "supplier_payments",
  "customer_payments",
  "import_logs",
  "daily_closes",
  "payment_methods",
];

class BackupService {
  async exportAll() {
    const data = {
      version: 1,
      exported_at: new Date().toISOString(),
      tables: {},
    };

    for (const table of BACKUP_TABLES) {
      try {
        data.tables[table] = await query(`SELECT * FROM ${table}`);
      } catch {
        data.tables[table] = [];
      }
    }

    return data;
  }

  serializeBackup(data) {
    return JSON.stringify(data, null, 2);
  }

  buildBackupFilename(exportedAt) {
    const stamp = String(exportedAt || new Date().toISOString())
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    return `${APP_SLUG}-backup-${stamp}.json`;
  }

  buildDailyBackupFilename(dateKey) {
    return `${APP_SLUG}-daily-${dateKey}.json`;
  }

  async prepareBackup() {
    const data = await this.exportAll();
    const json = this.serializeBackup(data);
    const filename = this.buildBackupFilename(data.exported_at);
    return {
      data,
      json,
      filename,
      tableCount: BACKUP_TABLES.length,
      exported_at: data.exported_at,
      fileSizeBytes: new TextEncoder().encode(json).length,
    };
  }

  async getLocalBackupFolder() {
    if (!isTauri()) return "";
    return invoke("get_backup_folder");
  }

  async saveBackupToLocalFile({ json, filename, backupType, destinationLabel = "local" }) {
    if (!isTauri()) {
      throw new Error("Local backup folder is only available in the desktop app.");
    }

    const fileSizeBytes = new TextEncoder().encode(json).length;
    try {
      const path = await invoke("save_backup_file", { filename, content: json });
      await this.logBackup({
        backupType,
        destination: path,
        status: "success",
        fileSizeBytes,
        tableCount: BACKUP_TABLES.length,
      });
      return path;
    } catch (err) {
      await this.logBackup({
        backupType,
        destination: destinationLabel,
        status: "failed",
        fileSizeBytes,
        tableCount: BACKUP_TABLES.length,
        errorMessage: err?.message || String(err),
      });
      throw err;
    }
  }

  downloadJson(data, filename) {
    const blob = new Blob([this.serializeBackup(data)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async logBackup({
    backupType,
    destination,
    status,
    fileSizeBytes = null,
    tableCount = null,
    errorMessage = null,
  }) {
    await execute(
      `INSERT INTO backup_logs (backup_type, destination, status, file_size_bytes, table_count, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        backupType,
        destination,
        status,
        fileSizeBytes,
        tableCount,
        errorMessage,
      ]
    );
  }

  async getBackupLogs({ limit = 50 } = {}) {
    return query(
      `SELECT id, backup_type, destination, status, file_size_bytes, table_count, error_message, created_at
       FROM backup_logs
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT $1`,
      [limit]
    );
  }

  async getBackupStats() {
    const row = await queryOne(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
         MAX(CASE WHEN status = 'success' THEN created_at END) AS last_success_at
       FROM backup_logs`
    );
    return {
      total: Number(row?.total ?? 0),
      successCount: Number(row?.success_count ?? 0),
      failedCount: Number(row?.failed_count ?? 0),
      lastSuccessAt: row?.last_success_at || null,
    };
  }

  async readGmailConfig() {
    const settings = await settingsService.getAll();
    return {
      enabled: settings[BACKUP_SETTING_KEYS.GMAIL_ENABLED] === "1",
      gmail: settings[BACKUP_SETTING_KEYS.GMAIL_ADDRESS]?.trim() || "",
      appPassword: decodeBackupSecret(settings[BACKUP_SETTING_KEYS.GMAIL_APP_PASSWORD]),
      recipient:
        settings[BACKUP_SETTING_KEYS.GMAIL_RECIPIENT]?.trim() ||
        settings[BACKUP_SETTING_KEYS.GMAIL_ADDRESS]?.trim() ||
        "",
      dailyTime: settings[BACKUP_SETTING_KEYS.DAILY_TIME]?.trim() || "23:00",
      lastAutoDate: settings[BACKUP_SETTING_KEYS.LAST_AUTO_DATE]?.trim() || "",
    };
  }

  async saveGmailConfig({ enabled, gmail, appPassword, recipient, dailyTime }) {
    const payload = {
      [BACKUP_SETTING_KEYS.GMAIL_ENABLED]: enabled ? "1" : "0",
      [BACKUP_SETTING_KEYS.GMAIL_ADDRESS]: gmail?.trim() || "",
      [BACKUP_SETTING_KEYS.GMAIL_RECIPIENT]: recipient?.trim() || gmail?.trim() || "",
      [BACKUP_SETTING_KEYS.DAILY_TIME]: dailyTime?.trim() || "23:00",
    };
    if (appPassword?.trim()) {
      payload[BACKUP_SETTING_KEYS.GMAIL_APP_PASSWORD] = encodeBackupSecret(
        normalizeGmailAppPassword(appPassword)
      );
    }
    await settingsService.updateMany(payload);
    return this.readGmailConfig();
  }

  async syncToGmail({ enabled, gmail, appPassword, recipient, dailyTime } = {}) {
    const trimmedGmail = gmail?.trim() || "";
    const trimmedPassword = normalizeGmailAppPassword(appPassword || "");
    const existing = await this.readGmailConfig();

    if (!trimmedGmail) {
      throw new Error("Gmail address is required.");
    }
    if (!trimmedPassword && !existing.appPassword) {
      throw new Error("Gmail app password is required.");
    }

    await this.saveGmailConfig({
      enabled: enabled ?? existing.enabled,
      gmail: trimmedGmail,
      appPassword: trimmedPassword,
      recipient: recipient?.trim() || trimmedGmail,
      dailyTime: dailyTime ?? existing.dailyTime,
    });

    return this.emailBackup({ type: BACKUP_TYPES.MANUAL_EMAIL });
  }

  async createBackupDownload() {
    const { data, json, filename } = await this.prepareBackup();
    this.downloadJson(data, filename);

    await this.logBackup({
      backupType: BACKUP_TYPES.DOWNLOAD,
      destination: "local",
      status: "success",
      fileSizeBytes: new TextEncoder().encode(json).length,
      tableCount: BACKUP_TABLES.length,
    });

    return { tableCount: BACKUP_TABLES.length, exported_at: data.exported_at, filename };
  }

  async sendEmailWithPayload({ json, filename, type = BACKUP_TYPES.MANUAL_EMAIL }) {
    if (!isTauri()) {
      throw new Error("Email backup is only available in the desktop app.");
    }

    const config = await this.readGmailConfig();
    if (!config.gmail || !config.appPassword) {
      throw new Error("Configure Gmail address and app password in Settings → Backup first.");
    }
    if (!config.recipient) {
      throw new Error("Recipient email is required.");
    }

    const storeName = (await settingsService.get("store_name")) || APP_NAME;
    const backupType = type === BACKUP_TYPES.DAILY_EMAIL ? BACKUP_TYPES.DAILY_EMAIL : BACKUP_TYPES.MANUAL_EMAIL;
    const exportedAt = JSON.parse(json).exported_at || new Date().toISOString();
    const subject =
      backupType === BACKUP_TYPES.DAILY_EMAIL
        ? `${storeName} — Daily Backup ${exportedAt.slice(0, 10)}`
        : `${storeName} — Manual Backup ${exportedAt.slice(0, 10)}`;

    const bodyText = [
      `${storeName} database backup`,
      "",
      `Exported: ${exportedAt}`,
      `Tables: ${BACKUP_TABLES.length}`,
      `Type: ${backupType === BACKUP_TYPES.DAILY_EMAIL ? "Daily automatic" : "Manual"}`,
      "",
      `Attach this JSON file to restore your store in ${APP_NAME} → Settings → Backup → Restore.`,
    ].join("\n");

    const fileSizeBytes = new TextEncoder().encode(json).length;

    try {
      await invoke("send_backup_email", {
        gmail: config.gmail,
        appPassword: normalizeGmailAppPassword(config.appPassword),
        recipient: config.recipient,
        subject,
        bodyText,
        attachmentName: filename,
        attachmentJson: json,
      });

      await this.logBackup({
        backupType,
        destination: config.recipient,
        status: "success",
        fileSizeBytes,
        tableCount: BACKUP_TABLES.length,
      });

      return {
        tableCount: BACKUP_TABLES.length,
        exported_at: exportedAt,
        filename,
        recipient: config.recipient,
      };
    } catch (err) {
      await this.logBackup({
        backupType,
        destination: config.recipient,
        status: "failed",
        fileSizeBytes,
        tableCount: BACKUP_TABLES.length,
        errorMessage: err?.message || String(err),
      });
      throw err;
    }
  }

  async emailBackup({ type = BACKUP_TYPES.MANUAL_EMAIL } = {}) {
    const payload = await this.prepareBackup();
    return this.sendEmailWithPayload({
      json: payload.json,
      filename: payload.filename,
      type,
    });
  }

  async runDailyBackup() {
    if (!isTauri()) return { localPath: null, email: null };

    const settings = await settingsService.getAll();
    const todayKey = getBackupBusinessDateKey(settings);
    const payload = await this.prepareBackup();
    const dailyFilename = this.buildDailyBackupFilename(todayKey);

    let localPath = null;
    try {
      localPath = await this.saveBackupToLocalFile({
        json: payload.json,
        filename: dailyFilename,
        backupType: BACKUP_TYPES.DAILY_LOCAL,
      });
    } catch (err) {
      console.warn("Daily local backup failed:", err);
    }

    let emailResult = null;
    try {
      emailResult = await this.sendEmailWithPayload({
        json: payload.json,
        filename: payload.filename,
        type: BACKUP_TYPES.DAILY_EMAIL,
      });
    } catch (err) {
      console.warn("Daily Gmail backup failed:", err);
    }

    if (!localPath && !emailResult) {
      throw new Error("Daily backup failed — could not save locally or send to Gmail.");
    }

    return { localPath, email: emailResult, todayKey };
  }

  parseBackupFile(text) {
    const data = JSON.parse(text);
    if (!data?.tables || typeof data.tables !== "object") {
      throw new Error("Invalid backup file format");
    }
    return data;
  }

  async restoreFromBackup(data, { clearExisting = true } = {}) {
    if (!data?.tables) throw new Error("Invalid backup data");

    await runInTransaction(async ({ execute: txExecute }) => {
      if (clearExisting) {
        for (const table of [...BACKUP_TABLES].reverse()) {
          try {
            await txExecute(`DELETE FROM ${table}`);
          } catch {
            /* table may not exist */
          }
        }
      }

      for (const table of BACKUP_TABLES) {
        const rows = data.tables[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        for (const row of rows) {
          const keys = Object.keys(row);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
          const values = keys.map((k) => row[k]);
          await txExecute(
            `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
            values
          );
        }
      }
    });

    return true;
  }

  /** Delete all data and restore default admin, cashier, settings, and units. */
  async clearAllData() {
    await clearDatabaseData();
    return true;
  }

  async getSectionRowCounts() {
    const counts = {};
    for (const section of DATA_CLEAR_SECTIONS) {
      let total = 0;
      for (const table of section.tables) {
        try {
          const row = await queryOne(`SELECT COUNT(*) AS count FROM ${table}`);
          total += Number(row?.count ?? 0);
        } catch {
          /* table may not exist */
        }
      }
      counts[section.id] = total;
    }
    return counts;
  }

  async clearSection(sectionId) {
    await clearDatabaseSection(sectionId);
    return true;
  }
}

export const backupService = new BackupService();
