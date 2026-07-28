import { query, queryOne, execute, getLastInsertId } from "../database/connection";
import bcrypt from "bcryptjs";

class UserService {
  async authenticate(username, password) {
    const user = await queryOne(
      "SELECT * FROM users WHERE username = $1",
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
}

export const userService = new UserService();
