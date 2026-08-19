import { query, queryOne, execute, enqueueDbOperation } from "../database/connection";

function stringifySettingValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

class SettingsService {
  async getAll() {
    const rows = await query("SELECT key, value FROM settings");
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async get(key, defaultValue = "") {
    const row = await queryOne("SELECT value FROM settings WHERE key = $1", [key]);
    return row?.value ?? defaultValue;
  }

  async set(key, value) {
    await execute(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [String(key), stringifySettingValue(value)]
    );
  }

  async remove(key) {
    await execute("DELETE FROM settings WHERE key = $1", [key]);
  }

  async removeMany(keys) {
    for (const key of keys) {
      await this.remove(key);
    }
  }

  async updateMany(settings) {
    const entries = Object.entries(settings || {})
      .filter(([key]) => Boolean(key))
      .map(([key, value]) => [String(key), stringifySettingValue(value)]);

    if (entries.length === 0) {
      return this.getAll();
    }

    await enqueueDbOperation(async (db) => {
      try {
        await db.execute("ROLLBACK");
      } catch {
        /* no open transaction */
      }

      for (const [key, value] of entries) {
        await db.execute(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, value]
        );
      }
    });

    return this.getAll();
  }
}

export const settingsService = new SettingsService();
