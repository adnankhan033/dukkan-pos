import { query, queryOne, execute } from "../database/connection";
import { formatDbError } from "../utils/format";

class UnitService {
  async getAll({ search = "" } = {}) {
    const term = search.trim();
    let sql = `
      SELECT u.*,
             COALESCE(pu.product_count, 0) AS product_count
      FROM units u
      LEFT JOIN (
        SELECT unit_id, COUNT(*) AS product_count
        FROM products
        WHERE unit_id IS NOT NULL
        GROUP BY unit_id
      ) pu ON pu.unit_id = u.id`;

    if (term) {
      const like = `%${term}%`;
      sql += `
       WHERE u.name LIKE $1
          OR u.symbol LIKE $1
          OR COALESCE(u.example, '') LIKE $1
       ORDER BY u.name ASC`;
      return query(sql, [like]);
    }

    sql += ` ORDER BY u.name ASC`;
    return query(sql);
  }

  async getById(id) {
    return queryOne("SELECT * FROM units WHERE id = $1", [Number(id)]);
  }

  async getBySymbol(symbol) {
    const trimmed = String(symbol || "").trim();
    if (!trimmed) return null;

    return queryOne(
      "SELECT * FROM units WHERE lower(trim(symbol)) = $1",
      [trimmed.toLowerCase()]
    );
  }

  async getDefaultUnit() {
    const bySymbol = await this.getBySymbol("pcs");
    if (bySymbol) return bySymbol;

    return queryOne("SELECT * FROM units ORDER BY id ASC LIMIT 1");
  }

  async findByNameOrSymbol({ name, symbol }, excludeId = null) {
    const normName = String(name || "").trim().toLowerCase();
    const normSymbol = String(symbol || "").trim().toLowerCase();
    if (!normName && !normSymbol) return null;

    if (excludeId != null) {
      return queryOne(
        `SELECT * FROM units
         WHERE (lower(trim(name)) = $1 OR lower(trim(symbol)) = $2)
           AND id != $3`,
        [normName, normSymbol, Number(excludeId)]
      );
    }

    return queryOne(
      `SELECT * FROM units
       WHERE lower(trim(name)) = $1 OR lower(trim(symbol)) = $2`,
      [normName, normSymbol]
    );
  }

  async create(data) {
    const name = String(data.name || "").trim();
    const symbol = String(data.symbol || "").trim();
    const example = String(data.example || "").trim();

    if (!symbol) throw new Error("Unit symbol is required");

    const existing = await this.findByNameOrSymbol({ name, symbol });
    if (existing) {
      throw new Error(`Unit "${name}" or symbol "${symbol}" already exists`);
    }

    try {
      const rows = await query(
        `INSERT INTO units (name, symbol, example) VALUES ($1, $2, $3) RETURNING *`,
        [name, symbol, example || null]
      );
      const created = rows?.[0];
      if (!created?.id) {
        throw new Error("Unit was not saved. Please try again.");
      }
      return { ...created, product_count: 0 };
    } catch (err) {
      const msg = formatDbError(err);
      if (/unique|already exists/i.test(msg)) {
        throw new Error(`Unit "${name}" or symbol "${symbol}" already exists`);
      }
      throw new Error(msg || "Failed to save unit");
    }
  }

  async update(id, data) {
    const numId = Number(id);
    const name = String(data.name || "").trim();
    const symbol = String(data.symbol || "").trim();
    const example = String(data.example || "").trim();

    const existing = await this.findByNameOrSymbol({ name, symbol }, numId);
    if (existing) {
      throw new Error(`Unit "${name}" or symbol "${symbol}" already exists`);
    }

    try {
      await execute(
        `UPDATE units SET name = $1, symbol = $2, example = $3, updated_at = datetime('now')
         WHERE id = $4`,
        [name, symbol, example || null, numId]
      );

      const updated = await this.getById(numId);
      if (!updated) throw new Error("Unit not found");
      return updated;
    } catch (err) {
      const msg = formatDbError(err);
      if (/unique|already exists/i.test(msg)) {
        throw new Error(`Unit "${name}" or symbol "${symbol}" already exists`);
      }
      throw new Error(msg || "Failed to update unit");
    }
  }

  async getProductCount(id) {
    const row = await queryOne(
      "SELECT COUNT(*) AS count FROM products WHERE unit_id = $1",
      [Number(id)]
    );
    return Number(row?.count ?? 0);
  }

  async delete(id, { unassignProducts = false } = {}) {
    const numId = Number(id);
    const productCount = await this.getProductCount(numId);

    if (productCount > 0 && !unassignProducts) {
      throw new Error(
        `Cannot delete — ${productCount} product(s) use this unit. Confirm delete to unassign them first.`
      );
    }

    const defaultUnit = await this.getDefaultUnit();

    if (productCount > 0) {
      const fallbackId =
        defaultUnit && Number(defaultUnit.id) !== numId ? defaultUnit.id : null;
      await execute(
        "UPDATE products SET unit_id = $1, updated_at = datetime('now') WHERE unit_id = $2",
        [fallbackId, numId]
      );
    }

    await execute("DELETE FROM units WHERE id = $1", [numId]);

    const stillExists = await queryOne("SELECT id FROM units WHERE id = $1", [numId]);
    if (stillExists) {
      throw new Error("Failed to delete unit. Please restart the app and try again.");
    }

    return { productCount };
  }
}

export const unitService = new UnitService();
