import Database from "@tauri-apps/plugin-sql";
import { DB_NAME } from "../utils/constants";
import { SCHEMA_STATEMENTS } from "./schema";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../utils/constants";

let dbInstance = null;
let schemaInitialized = false;

export async function getDatabase() {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME);
    await dbInstance.execute("PRAGMA foreign_keys = OFF");
  }
  return dbInstance;
}

export async function ensureReturnSchema() {
  const db = await getDatabase();
  await ensureReturnTables(db);
}

export async function initializeDatabase() {
  const db = await getDatabase();

  const ready = await db.select(
    "SELECT value FROM settings WHERE key = '_schema_ready' LIMIT 1"
  );

  if (ready.length === 0) {
    for (const statement of SCHEMA_STATEMENTS) {
      await db.execute(statement);
    }
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ('_schema_ready', '1')"
    );
  }

  await seedDefaultData(db);
  await runMigrations(db);
  schemaInitialized = true;
  return db;
}

async function getProductColumns(db) {
  return db.select("PRAGMA table_info(products)");
}

async function runMigrations(db) {
  let cols = await getProductColumns(db);
  const hasCol = (name) => cols.some((c) => c.name === name);

  if (!hasCol("published")) {
    await db.execute(
      "ALTER TABLE products ADD COLUMN published INTEGER NOT NULL DEFAULT 1"
    );
    cols = await getProductColumns(db);
  }

  if (!hasCol("name_ar")) {
    await db.execute("ALTER TABLE products ADD COLUMN name_ar TEXT");
    cols = await getProductColumns(db);
  }

  // Record migration so older builds know schema is current
  const migrated = await db.select(
    "SELECT value FROM settings WHERE key = '_products_name_ar' LIMIT 1"
  );
  if (migrated.length === 0 && cols.some((c) => c.name === "name_ar")) {
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ('_products_name_ar', '1')"
    );
  }

  await ensureReturnTables(db);
}

async function ensureReturnTables(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS sale_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT NOT NULL UNIQUE,
      sale_id INTEGER NOT NULL,
      total_refund REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS sale_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      sale_item_id INTEGER,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`
  );
}

async function seedDefaultData(db) {
  const users = await db.select("SELECT id FROM users LIMIT 1");
  if (users.length === 0) {
    const passwordHash = bcrypt.hashSync("admin123", 10);
    await db.execute(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)",
      ["admin", passwordHash, "Administrator", "admin"]
    );
  }

  const settings = await db.select(
    "SELECT key FROM settings WHERE key = 'store_name' LIMIT 1"
  );
  if (settings.length === 0) {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.execute(
        "INSERT INTO settings (key, value) VALUES ($1, $2)",
        [key, value]
      );
    }
  }
}

export async function query(sql, params = []) {
  const db = await getDatabase();
  return db.select(sql, params);
}

export async function execute(sql, params = []) {
  const db = await getDatabase();
  return db.execute(sql, params);
}

/** Run INSERT and return the new row id from the Tauri SQL plugin. */
export async function insert(sql, params = []) {
  const result = await execute(sql, params);
  const id = result?.lastInsertId;
  if (id == null || Number(id) <= 0) {
    throw new Error("Insert failed: could not get new record id");
  }
  return Number(id);
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/** @deprecated Prefer insert() — last_insert_rowid() returns 0 in Tauri SQL. */
export async function getLastInsertId() {
  const row = await queryOne("SELECT last_insert_rowid() as id");
  const id = row?.id != null ? Number(row.id) : null;
  return id && id > 0 ? id : null;
}
