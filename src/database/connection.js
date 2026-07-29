import Database from "@tauri-apps/plugin-sql";
import { DB_NAME } from "../utils/constants";
import { SCHEMA_STATEMENTS } from "./schema";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../utils/constants";
import { DEFAULT_UNITS } from "../utils/defaultUnits";

let dbInstance = null;
let dbConfigured = false;
let schemaInitialized = false;
/** Serializes all DB access — prevents SQLite "database is locked" in Tauri. */
let dbQueue = Promise.resolve();

function enqueueDb(operation) {
  const run = dbQueue.then(operation, operation);
  dbQueue = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function configureDatabase(db) {
  if (dbConfigured) return;

  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA synchronous = NORMAL");
  await db.execute("PRAGMA busy_timeout = 10000");
  await db.execute("PRAGMA foreign_keys = OFF");

  // Clear any interrupted transaction from a prior crash or cancelled import.
  try {
    await db.execute("ROLLBACK");
  } catch {
    /* no open transaction */
  }

  dbConfigured = true;
}

export async function getDatabase() {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME);
    await configureDatabase(dbInstance);
  }
  return dbInstance;
}

/** Recover from a stale SQLite write lock. Safe to call on app startup. */
export async function recoverDatabase() {
  return enqueueDb(async () => {
    const db = await getDatabase();
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
  });
}

export async function ensureReturnSchema() {
  await ensureReturnTables();
}

export async function initializeDatabase() {
  await recoverDatabase();

  const ready = await query(
    "SELECT value FROM settings WHERE key = '_schema_ready' LIMIT 1"
  );

  if (ready.length === 0) {
    for (const statement of SCHEMA_STATEMENTS) {
      await execute(statement);
    }
    await execute(
      "INSERT INTO settings (key, value) VALUES ('_schema_ready', '1')"
    );
  }

  await seedDefaultData();
  await runMigrations();
  schemaInitialized = true;
  return getDatabase();
}

async function getProductColumns() {
  return query("PRAGMA table_info(products)");
}

async function runMigrations() {
  let cols = await getProductColumns();
  const hasCol = (name) => cols.some((c) => c.name === name);

  if (!hasCol("published")) {
    await execute(
      "ALTER TABLE products ADD COLUMN published INTEGER NOT NULL DEFAULT 1"
    );
    cols = await getProductColumns();
  }

  if (!hasCol("name_ar")) {
    await execute("ALTER TABLE products ADD COLUMN name_ar TEXT");
    cols = await getProductColumns();
  }

  const migrated = await query(
    "SELECT value FROM settings WHERE key = '_products_name_ar' LIMIT 1"
  );
  if (migrated.length === 0 && cols.some((c) => c.name === "name_ar")) {
    await execute(
      "INSERT INTO settings (key, value) VALUES ('_products_name_ar', '1')"
    );
  }

  await ensureReturnTables();
  await ensureUnitsSchema();
}

async function ensureUnitsSchema() {
  await execute(
    `CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL UNIQUE,
      example TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );

  let cols = await getProductColumns();
  if (!cols.some((c) => c.name === "unit_id")) {
    await execute("ALTER TABLE products ADD COLUMN unit_id INTEGER REFERENCES units(id)");
  }

  await execute("CREATE INDEX IF NOT EXISTS idx_products_unit ON products(unit_id)");

  const unitCount = await queryOne("SELECT COUNT(*) AS count FROM units");
  if (Number(unitCount?.count ?? 0) === 0) {
    for (const unit of DEFAULT_UNITS) {
      await execute(
        "INSERT INTO units (name, symbol, example) VALUES ($1, $2, $3)",
        [unit.name, unit.symbol, unit.example]
      );
    }
  }

  const defaultUnit = await queryOne(
    "SELECT id FROM units WHERE lower(trim(symbol)) = 'pcs' LIMIT 1"
  );
  if (defaultUnit?.id) {
    await execute(
      "UPDATE products SET unit_id = $1 WHERE unit_id IS NULL",
      [defaultUnit.id]
    );
  }
}

async function ensureReturnTables() {
  await execute(
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
  await execute(
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

async function seedDefaultData() {
  const users = await query("SELECT id FROM users LIMIT 1");
  if (users.length === 0) {
    const passwordHash = bcrypt.hashSync("admin123", 10);
    await execute(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)",
      ["admin", passwordHash, "Administrator", "admin"]
    );
  }

  const settings = await query(
    "SELECT key FROM settings WHERE key = 'store_name' LIMIT 1"
  );
  if (settings.length === 0) {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await execute(
        "INSERT INTO settings (key, value) VALUES ($1, $2)",
        [key, value]
      );
    }
  }
}

export async function query(sql, params = []) {
  return enqueueDb(async () => {
    const db = await getDatabase();
    return db.select(sql, params);
  });
}

export async function execute(sql, params = []) {
  return enqueueDb(async () => {
    const db = await getDatabase();
    return db.execute(sql, params);
  });
}

/** Run INSERT and return the new row id from the Tauri SQL plugin. */
export async function insert(sql, params = []) {
  return enqueueDb(async () => {
    const db = await getDatabase();
    const result = await db.execute(sql, params);
    const id = result?.lastInsertId;
    if (id == null || Number(id) <= 0) {
      throw new Error("Insert failed: could not get new record id");
    }
    return Number(id);
  });
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/** Run multiple statements in one SQLite transaction (serialized). */
export async function runInTransaction(fn) {
  return enqueueDb(async () => {
    const db = await getDatabase();
    await db.execute("BEGIN IMMEDIATE");
    try {
      const result = await fn({ query: (s, p) => db.select(s, p), execute: (s, p) => db.execute(s, p) });
      await db.execute("COMMIT");
      return result;
    } catch (err) {
      try {
        await db.execute("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    }
  });
}

/** @deprecated Prefer insert() — last_insert_rowid() returns 0 in Tauri SQL. */
export async function getLastInsertId() {
  const row = await queryOne("SELECT last_insert_rowid() as id");
  const id = row?.id != null ? Number(row.id) : null;
  return id && id > 0 ? id : null;
}

export { schemaInitialized };
