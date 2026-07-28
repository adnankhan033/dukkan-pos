import { query, queryOne, execute, getLastInsertId } from "../database/connection";

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

  async updateMany(settings) {
    for (const [key, value] of Object.entries(settings)) {
      await this.set(key, value);
    }
    return this.getAll();
  }
}

export const settingsService = new SettingsService();
