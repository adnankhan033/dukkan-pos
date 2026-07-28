import { query, queryOne, execute, insert } from "../database/connection";

class SupplierService {
  async getAll({ search = "", page = 1, limit = 10 } = {}) {
    let sql = "SELECT * FROM suppliers WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (company LIKE $${params.length} OR contact_person LIKE $${params.length} OR phone LIKE $${params.length})`;
    }

    const countRow = await queryOne(sql.replace("SELECT *", "SELECT COUNT(*) as total"), params);
    const total = countRow?.total ?? 0;

    sql += " ORDER BY company ASC";
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push((page - 1) * limit);
    sql += ` OFFSET $${params.length}`;

    const items = await query(sql, params);
    return { items, total, page, limit };
  }

  async getById(id) {
    return queryOne("SELECT * FROM suppliers WHERE id = $1", [id]);
  }

  async create(data) {
    const id = await insert(
      "INSERT INTO suppliers (company, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5)",
      [data.company, data.contact_person || null, data.phone || null, data.email || null, data.address || null]
    );
    return this.getById(id);
  }

  async update(id, data) {
    await execute(
      `UPDATE suppliers SET company = $1, contact_person = $2, phone = $3, email = $4, address = $5,
       updated_at = datetime('now') WHERE id = $6`,
      [data.company, data.contact_person || null, data.phone || null, data.email || null, data.address || null, id]
    );
    return this.getById(id);
  }

  async delete(id) {
    await execute("DELETE FROM suppliers WHERE id = $1", [id]);
    return true;
  }
}

export const supplierService = new SupplierService();
