import { query, queryOne, execute, enqueueDbOperation } from "../database/connection";

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
      [key, String(value)]
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
    const entries = Object.entries(settings || {});
    if (entries.length === 0) {
      return this.getAll();
    }

    return enqueueDbOperation(async (db) => {
      await db.execute("BEGIN IMMEDIATE");
      try {
        for (const [key, value] of entries) {
          await db.execute(
            `INSERT INTO settings (key, value) VALUES ($1, $2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [key, String(value)]
          );
        }
        await db.execute("COMMIT");
      } catch (err) {
        try {
          await db.execute("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      }
      return db.select("SELECT key, value FROM settings");
    }).then((rows) =>
      rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {})
    );
  }
}

export const settingsService = new SettingsService();
