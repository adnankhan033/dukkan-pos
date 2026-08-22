import { query, queryOne, execute, ensureExpenseCategoriesSchema } from "../database/connection";
import { formatDbError } from "../utils/format";

function slugifyCategoryCode(name) {
  const ascii = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return ascii || `cat_${Date.now().toString(36)}`;
}

class ExpenseCategoryService {
  async getAll() {
    await ensureExpenseCategoriesSchema();
    return query(
      "SELECT * FROM expense_categories ORDER BY sort_order ASC, name ASC"
    );
  }

  async findByName(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return null;
    return queryOne(
      "SELECT * FROM expense_categories WHERE lower(trim(name)) = $1",
      [trimmed.toLowerCase()]
    );
  }

  async findByCode(code) {
    const trimmed = String(code || "").trim();
    if (!trimmed) return null;
    return queryOne("SELECT * FROM expense_categories WHERE code = $1", [trimmed]);
  }

  async create({ name }) {
    await ensureExpenseCategoriesSchema();
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new Error("Category name is required");

    const existingName = await this.findByName(trimmed);
    if (existingName) {
      throw new Error(`Category "${trimmed}" already exists`);
    }

    let code = slugifyCategoryCode(trimmed);
    let suffix = 2;
    while (await this.findByCode(code)) {
      code = `${slugifyCategoryCode(trimmed)}_${suffix}`;
      suffix += 1;
    }

    try {
      const rows = await query(
        `INSERT INTO expense_categories (code, name, is_system, sort_order)
         VALUES ($1, $2, 0, 100)
         RETURNING *`,
        [code, trimmed]
      );
      const created = rows?.[0];
      if (!created?.id) throw new Error("Category was not saved. Please try again.");
      return created;
    } catch (err) {
      const msg = formatDbError(err);
      if (/unique|already exists/i.test(msg)) {
        throw new Error(`Category "${trimmed}" already exists`);
      }
      throw new Error(msg || "Failed to save category");
    }
  }

  labelFor(code, categories = []) {
    const match = categories.find((item) => item.code === code);
    if (match) return match.name;
    return code || "Other";
  }
}

export const expenseCategoryService = new ExpenseCategoryService();
