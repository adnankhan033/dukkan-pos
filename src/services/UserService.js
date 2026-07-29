import { query, queryOne, execute, insert, runInTransaction } from "../database/connection";
import bcrypt from "bcryptjs";
import { ROLES } from "../utils/roles";

class UserService {
  async authenticate(username, password) {
    const user = await queryOne(
      "SELECT * FROM users WHERE username = $1 AND COALESCE(is_active, 1) = 1",
      [username]
    );
    if (!user) return null;

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return null;

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async getById(id) {
    const user = await queryOne("SELECT * FROM users WHERE id = $1", [id]);
    if (!user) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async getAll({ page = 1, limit = 10, search = "" } = {}) {
    const params = [];
    let where = "";
    if (search.trim()) {
      where = "WHERE username LIKE $1 OR full_name LIKE $1";
      params.push(`%${search.trim()}%`);
    }

    const countRow = await queryOne(
      `SELECT COUNT(*) as total FROM users ${where}`,
      params
    );
    const total = countRow?.total ?? 0;

    const items = await query(
      `SELECT id, username, full_name, role, is_active, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );

    return { items, total, page, limit };
  }

  async create({ username, password, full_name, role, is_active = true }) {
    const existing = await queryOne(
      "SELECT id FROM users WHERE username = $1",
      [username.trim()]
    );
    if (existing) throw new Error("Username already exists");

    const passwordHash = bcrypt.hashSync(password, 10);
    const id = await insert(
      `INSERT INTO users (username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        username.trim(),
        passwordHash,
        full_name?.trim() || username.trim(),
        role || ROLES.CASHIER,
        is_active ? 1 : 0,
      ]
    );
    return this.getById(id);
  }

  async update(id, { username, full_name, role, is_active, password }) {
    const user = await this.getById(id);
    if (!user) throw new Error("User not found");

    if (username && username.trim() !== user.username) {
      const existing = await queryOne(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username.trim(), id]
      );
      if (existing) throw new Error("Username already exists");
    }

    const fields = [];
    const params = [];

    if (username != null) {
      fields.push(`username = $${params.length + 1}`);
      params.push(username.trim());
    }
    if (full_name != null) {
      fields.push(`full_name = $${params.length + 1}`);
      params.push(full_name.trim());
    }
    if (role != null) {
      fields.push(`role = $${params.length + 1}`);
      params.push(role);
    }
    if (is_active != null) {
      fields.push(`is_active = $${params.length + 1}`);
      params.push(is_active ? 1 : 0);
    }
    if (password) {
      fields.push(`password_hash = $${params.length + 1}`);
      params.push(bcrypt.hashSync(password, 10));
    }

    if (fields.length === 0) return user;

    fields.push("updated_at = datetime('now')");
    params.push(id);

    await execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${params.length}`,
      params
    );
    return this.getById(id);
  }

  async delete(id) {
    const admins = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role = $1 AND COALESCE(is_active, 1) = 1",
      [ROLES.ADMIN]
    );
    const user = await this.getById(id);
    if (!user) throw new Error("User not found");
    if (user.role === ROLES.ADMIN && Number(admins?.count ?? 0) <= 1) {
      throw new Error("Cannot delete the last active administrator");
    }
    await execute("DELETE FROM users WHERE id = $1", [id]);
    return true;
  }

  async countAdmins() {
    const row = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role = $1 AND COALESCE(is_active, 1) = 1",
      [ROLES.ADMIN]
    );
    return Number(row?.count ?? 0);
  }
}

export const userService = new UserService();
