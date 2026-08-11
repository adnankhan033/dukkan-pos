import { query, queryOne, execute, runInTransaction, clearDatabaseData, clearDatabaseSection } from "../database/connection";
import { DATA_CLEAR_SECTIONS } from "../utils/dataClearSections.js";

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
  "import_logs",
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

  downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async createBackupDownload() {
    const data = await this.exportAll();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.downloadJson(data, `dukkan-pos-backup-${stamp}.json`);
    return { tableCount: BACKUP_TABLES.length, exported_at: data.exported_at };
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
