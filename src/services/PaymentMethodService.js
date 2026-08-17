import { query, queryOne, execute } from "../database/connection";
import { DEFAULT_PAYMENT_METHODS } from "../utils/defaultPaymentMethods";
import { slugifyPaymentCode } from "../utils/paymentMethods";
import { dispatchPaymentMethodsChanged } from "./PaymentMethodsSync";
import { formatDbError } from "../utils/format";

function normalizeMethod(row) {
  if (!row) return null;
  return {
    ...row,
    collect_cash: Number(row.collect_cash ?? 0),
    is_default: Number(row.is_default ?? 0),
    is_system: Number(row.is_system ?? 0),
    is_active: Number(row.is_active ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}

class PaymentMethodService {
  async getAll({ includeInactive = false } = {}) {
    let sql = "SELECT * FROM payment_methods";
    if (!includeInactive) {
      sql += " WHERE is_active = 1";
    }
    sql += " ORDER BY sort_order ASC, label ASC";
    const rows = await query(sql);
    return rows.map(normalizeMethod);
  }

  async getActiveForPos() {
    return this.getAll({ includeInactive: false });
  }

  async getById(id) {
    const row = await queryOne("SELECT * FROM payment_methods WHERE id = $1", [Number(id)]);
    return normalizeMethod(row);
  }

  async getByCode(code) {
    const key = String(code || "").trim().toLowerCase();
    if (!key) return null;
    const row = await queryOne(
      "SELECT * FROM payment_methods WHERE lower(code) = $1 LIMIT 1",
      [key]
    );
    return normalizeMethod(row);
  }

  async getDefaultCode() {
    const row = await queryOne(
      "SELECT code FROM payment_methods WHERE is_default = 1 AND is_active = 1 ORDER BY sort_order ASC LIMIT 1"
    );
    if (row?.code) return row.code;
    const cash = await this.getByCode("cash");
    return cash?.code || "cash";
  }

  async getUsageCount(code) {
    const key = String(code || "").trim().toLowerCase();
    const row = await queryOne(
      "SELECT COUNT(*) AS count FROM sales WHERE lower(payment_method) = $1",
      [key]
    );
    return Number(row?.count ?? 0);
  }

  async findByLabel(label, excludeId = null) {
    const norm = String(label || "").trim().toLowerCase();
    if (!norm) return null;
    if (excludeId != null) {
      return queryOne(
        "SELECT * FROM payment_methods WHERE lower(trim(label)) = $1 AND id != $2",
        [norm, Number(excludeId)]
      );
    }
    return queryOne("SELECT * FROM payment_methods WHERE lower(trim(label)) = $1", [norm]);
  }

  async findByCode(code, excludeId = null) {
    const norm = String(code || "").trim().toLowerCase();
    if (!norm) return null;
    if (excludeId != null) {
      return queryOne(
        "SELECT * FROM payment_methods WHERE lower(code) = $1 AND id != $2",
        [norm, Number(excludeId)]
      );
    }
    return queryOne("SELECT * FROM payment_methods WHERE lower(code) = $1", [norm]);
  }

  async generateUniqueCode(label, excludeId = null) {
    let base = slugifyPaymentCode(label);
    let candidate = base;
    let suffix = 2;
    while (await this.findByCode(candidate, excludeId)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async create(data) {
    const label = String(data.label || "").trim();
    if (!label) throw new Error("Payment method name is required");

    const duplicate = await this.findByLabel(label);
    if (duplicate) throw new Error("A payment method with this name already exists");

    const code = data.code?.trim()
      ? slugifyPaymentCode(data.code)
      : await this.generateUniqueCode(label);

    if (await this.findByCode(code)) {
      throw new Error("Payment method code already exists");
    }

    const collectCash = data.collect_cash ? 1 : 0;
    const isActive = data.is_active === false ? 0 : 1;
    const sortOrder = Number(data.sort_order) || 0;

    await execute(
      `INSERT INTO payment_methods
       (code, label, label_ar, icon, collect_cash, is_default, is_system, is_active, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7, datetime('now'))`,
      [
        code,
        label,
        String(data.label_ar || "").trim() || null,
        String(data.icon || "wallet").trim() || "wallet",
        collectCash,
        isActive,
        sortOrder,
      ]
    );

    if (data.is_default) {
      const created = await this.getByCode(code);
      if (created) await this.setDefault(created.id);
    }

    dispatchPaymentMethodsChanged();
    return this.getByCode(code);
  }

  async update(id, data) {
    const existing = await this.getById(id);
    if (!existing) throw new Error("Payment method not found");

    const label = String(data.label ?? existing.label).trim();
    if (!label) throw new Error("Payment method name is required");

    const duplicate = await this.findByLabel(label, id);
    if (duplicate) throw new Error("A payment method with this name already exists");

    let code = existing.code;
    if (!existing.is_system && data.code?.trim()) {
      code = slugifyPaymentCode(data.code);
      const codeDup = await this.findByCode(code, id);
      if (codeDup) throw new Error("Payment method code already exists");
    }

    const collectCash =
      data.collect_cash !== undefined ? (data.collect_cash ? 1 : 0) : existing.collect_cash;
    const isActive =
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;
    const sortOrder =
      data.sort_order !== undefined ? Number(data.sort_order) || 0 : existing.sort_order;

    await execute(
      `UPDATE payment_methods
       SET code = $1,
           label = $2,
           label_ar = $3,
           icon = $4,
           collect_cash = $5,
           is_active = $6,
           sort_order = $7,
           updated_at = datetime('now')
       WHERE id = $8`,
      [
        code,
        label,
        String(data.label_ar ?? existing.label_ar ?? "").trim() || null,
        String(data.icon ?? existing.icon ?? "wallet").trim() || "wallet",
        collectCash,
        isActive,
        sortOrder,
        Number(id),
      ]
    );

    if (data.is_default) {
      await this.setDefault(id);
    } else if (existing.is_default && isActive === 0) {
      await this.ensureDefaultMethod();
    }

    dispatchPaymentMethodsChanged();
    return this.getById(id);
  }

  async setDefault(id) {
    const method = await this.getById(id);
    if (!method) throw new Error("Payment method not found");
    if (!method.is_active) throw new Error("Inactive payment methods cannot be default");

    await execute("UPDATE payment_methods SET is_default = 0");
    await execute(
      "UPDATE payment_methods SET is_default = 1, updated_at = datetime('now') WHERE id = $1",
      [Number(id)]
    );
    dispatchPaymentMethodsChanged();
    return this.getById(id);
  }

  async ensureDefaultMethod() {
    const current = await queryOne(
      "SELECT id FROM payment_methods WHERE is_default = 1 AND is_active = 1 LIMIT 1"
    );
    if (current?.id) return current.id;

    const cash = await this.getByCode("cash");
    if (cash?.id) {
      await this.setDefault(cash.id);
      return cash.id;
    }

    const first = await queryOne(
      "SELECT id FROM payment_methods WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1"
    );
    if (first?.id) {
      await this.setDefault(first.id);
      return first.id;
    }
    return null;
  }

  async delete(id) {
    const method = await this.getById(id);
    if (!method) throw new Error("Payment method not found");
    if (method.is_system) {
      throw new Error("Built-in payment methods cannot be deleted. You can disable them instead.");
    }

    const usage = await this.getUsageCount(method.code);
    if (usage > 0) {
      throw new Error(
        `This payment method was used in ${usage} sale(s). Disable it instead of deleting.`
      );
    }

    await execute("DELETE FROM payment_methods WHERE id = $1", [Number(id)]);
    if (method.is_default) {
      await this.ensureDefaultMethod();
    }
    dispatchPaymentMethodsChanged();
    return true;
  }

  async seedDefaultsIfEmpty() {
    const countRow = await queryOne("SELECT COUNT(*) AS count FROM payment_methods");
    if (Number(countRow?.count ?? 0) > 0) return;

    for (const method of DEFAULT_PAYMENT_METHODS) {
      try {
        await execute(
          `INSERT INTO payment_methods
           (code, label, label_ar, icon, collect_cash, is_default, is_system, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            method.code,
            method.label,
            method.label_ar,
            method.icon,
            method.collect_cash,
            method.is_default,
            method.is_system,
            method.is_active,
            method.sort_order,
          ]
        );
      } catch {
        /* ignore duplicate on race */
      }
    }
  }
}

export const paymentMethodService = new PaymentMethodService();
