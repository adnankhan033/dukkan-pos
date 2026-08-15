import { query, queryOne, execute, insert } from "../database/connection";
import bcrypt from "bcryptjs";
import { ROLES } from "../utils/roles";
import { apiClient } from "../api/ApiClient";
import { isDrupalMode, normalizeUser } from "../api/drupalMode";
import { isDrupalConfigured, withResolvedApiUrl } from "../api/apiConfig";
import { settingsService } from "./SettingsService";
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
} from "../utils/activationConfig";

class UserService {
  async authenticate(username, password) {
    const settings = await settingsService.getAll();
    if (isDrupalConfigured(settings)) {
      const session = await apiClient.login(username, password, {
        ...settings,
        api_base_url: resolveApiBaseUrl(settings),
      });
      if (!session?.user) {
        return null;
      }
      return {
        user: normalizeUser(session.user),
        session: {
          token: session.token,
          terminal: session.terminal,
        },
      };
    }

    const user = await queryOne(
      "SELECT * FROM users WHERE username = $1 AND COALESCE(is_active, 1) = 1",
      [username]
    );
    if (!user) return null;

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return null;

    const { password_hash, ...safeUser } = user;
    return { user: safeUser, session: {} };
  }

  async getById(id) {
    if (await isDrupalMode()) {
      const user = await apiClient.getUser(Number(id));
      return user ? normalizeUser(user) : null;
    }

    const user = await queryOne("SELECT * FROM users WHERE id = $1", [id]);
    if (!user) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async getAll({ page = 1, limit = 10, search = "" } = {}) {
    if (await isDrupalMode()) {
      const result = await apiClient.getUsers({
        page,
        limit,
        search: search.trim() || undefined,
      });
      return {
        items: (result.items || []).map(normalizeUser),
        total: result.total ?? 0,
        page: result.page ?? page,
        limit: result.limit ?? limit,
      };
    }

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
      `SELECT id, username, full_name, phone, email, designation, notes, role, is_active, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );

    return { items, total, page, limit };
  }

  async create({ username, password, full_name, role, is_active = true, phone, email, designation, notes }) {
    if (await isDrupalMode()) {
      const created = await apiClient.createUser({
        username: username.trim(),
        password,
        full_name: full_name?.trim() || username.trim(),
        role: role || ROLES.CASHIER,
        is_active: is_active ? 1 : 0,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        designation: designation?.trim() || null,
        notes: notes?.trim() || null,
      });
      return normalizeUser(created);
    }

    const existing = await queryOne(
      "SELECT id FROM users WHERE username = $1",
      [username.trim()]
    );
    if (existing) throw new Error("Username already exists");

    const passwordHash = bcrypt.hashSync(password, 10);
    const id = await insert(
      `INSERT INTO users (username, password_hash, full_name, phone, email, designation, notes, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        username.trim(),
        passwordHash,
        full_name?.trim() || username.trim(),
        phone?.trim() || null,
        email?.trim() || null,
        designation?.trim() || null,
        notes?.trim() || null,
        role || ROLES.CASHIER,
        is_active ? 1 : 0,
      ]
    );
    return this.getById(id);
  }

  async update(id, { username, full_name, role, is_active, password, phone, email, designation, notes }) {
    if (await isDrupalMode()) {
      const body = {};
      if (username != null) body.username = username.trim();
      if (full_name != null) body.full_name = full_name.trim();
      if (role != null) body.role = role;
      if (is_active != null) body.is_active = is_active ? 1 : 0;
      if (password) body.password = password;
      if (phone != null) body.phone = phone.trim();
      if (email != null) body.email = email.trim();
      if (designation != null) body.designation = designation.trim();
      if (notes != null) body.notes = notes.trim();
      const updated = await apiClient.updateUser(Number(id), body);
      return normalizeUser(updated);
    }

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
    if (phone != null) {
      fields.push(`phone = $${params.length + 1}`);
      params.push(phone.trim() || null);
    }
    if (email != null) {
      fields.push(`email = $${params.length + 1}`);
      params.push(email.trim() || null);
    }
    if (designation != null) {
      fields.push(`designation = $${params.length + 1}`);
      params.push(designation.trim() || null);
    }
    if (notes != null) {
      fields.push(`notes = $${params.length + 1}`);
      params.push(notes.trim() || null);
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
    if (await isDrupalMode()) {
      const admins = await this.countAdmins();
      const user = await this.getById(id);
      if (!user) throw new Error("User not found");
      if (user.role === ROLES.ADMIN && admins <= 1) {
        throw new Error("Cannot delete the last active administrator");
      }
      await apiClient.updateUser(Number(id), { is_active: 0 });
      return true;
    }

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
    if (await isDrupalMode()) {
      const result = await apiClient.getUsers({ page: 1, limit: 500 });
      return (result.items || []).filter(
        (u) => u.role === ROLES.ADMIN && Number(u.is_active ?? 1) === 1
      ).length;
    }

    const row = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role = $1 AND COALESCE(is_active, 1) = 1",
      [ROLES.ADMIN]
    );
    return Number(row?.count ?? 0);
  }

  async ensureDefaultAdminPassword() {
    const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
    await execute(
      "UPDATE users SET password_hash = $1, updated_at = datetime('now') WHERE username = $2",
      [hash, DEFAULT_ADMIN_USERNAME]
    );
  }
}

export const userService = new UserService();
