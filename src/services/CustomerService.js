import { query, queryOne, execute, insert } from "../database/connection";

class CustomerService {
  async getAll({ search = "", page = 1, limit = 10 } = {}) {
    let sql = "SELECT * FROM customers WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name LIKE $${params.length} OR phone LIKE $${params.length} OR email LIKE $${params.length})`;
    }

    const countRow = await queryOne(sql.replace("SELECT *", "SELECT COUNT(*) as total"), params);
    const total = countRow?.total ?? 0;

    sql += " ORDER BY name ASC";
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit);
    sql += ` OFFSET $${params.length}`;

    const items = await query(sql, params);
    return { items, total, page, limit };
  }

  async getById(id) {
    return queryOne("SELECT * FROM customers WHERE id = $1", [id]);
  }

  async create(data) {
    const id = await insert(
      "INSERT INTO customers (name, phone, email, address, notes) VALUES ($1, $2, $3, $4, $5)",
      [data.name, data.phone || null, data.email || null, data.address || null, data.notes || null]
    );
    return this.getById(id);
  }

  async update(id, data) {
    await execute(
      `UPDATE customers SET name = $1, phone = $2, email = $3, address = $4, notes = $5,
       updated_at = datetime('now') WHERE id = $6`,
      [data.name, data.phone || null, data.email || null, data.address || null, data.notes || null, id]
    );
    return this.getById(id);
  }

  async delete(id) {
    await execute("DELETE FROM customers WHERE id = $1", [id]);
    return true;
  }

  async count() {
    const row = await queryOne("SELECT COUNT(*) as total FROM customers");
    return row?.total ?? 0;
  }

  async getAllForExport({ search = "" } = {}) {
    let sql = "SELECT * FROM customers WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name LIKE $${params.length} OR phone LIKE $${params.length} OR email LIKE $${params.length} OR address LIKE $${params.length})`;
    }

    sql += " ORDER BY name ASC";
    return query(sql, params);
  }
}

export const customerService = new CustomerService();
