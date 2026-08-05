import Database from "@tauri-apps/plugin-sql";
import { DB_NAME } from "../utils/constants";
import { SCHEMA_STATEMENTS } from "./schema";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../utils/constants";
import { DEFAULT_UNITS } from "../utils/defaultUnits";
import {
  convertUtcSqliteDatetimeToBusiness,
  resolveBusinessTimezone,
  utcSqliteStringToIso,
  wallClockInTimezoneToIso,
} from "../utils/timezones";

let dbInstance = null;
let dbConfigured = false;
let schemaInitialized = false;
let initPromise = null;
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
  if (schemaInitialized) {
    return getDatabase();
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = bootstrapDatabase();
  try {
    await initPromise;
    return getDatabase();
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

async function bootstrapDatabase() {
  await recoverDatabase();

  const hasSettings = await tableExists("settings");
  let schemaReady = false;

  if (hasSettings) {
    const ready = await query(
      "SELECT value FROM settings WHERE key = '_schema_ready' LIMIT 1"
    );
    schemaReady = ready.length > 0;
  }

  if (!schemaReady) {
    for (const statement of SCHEMA_STATEMENTS) {
      await execute(statement);
    }
    await execute(
      "INSERT OR IGNORE INTO settings (key, value) VALUES ('_schema_ready', '1')"
    );
  }

  await runMigrations();
  await seedDefaultData();
  schemaInitialized = true;
}

async function tableExists(name) {
  const rows = await query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = $1",
    [name]
  );
  return rows.length > 0;
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
  await ensureUsersAndExpensesSchema();
  await ensureSupplierLedgerSchema();
  await ensureZatcaSchema();
  await ensureCashierModuleDefaults();
  await ensureReceiptTemplateDefault();
  await ensureSettingsKeys();
  await migrateUtcTimestampsToBusinessTimezone();
  await migrateSalesTimestampsToIsoUtc();
  await fixSalesUtcTimestampsForRiyadh();
}

async function ensureZatcaColumn(table, column, definition) {
  const cols = await query(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensureZatcaSchema() {
  await execute(
    `CREATE TABLE IF NOT EXISTS zatca_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      sale_number TEXT NOT NULL,
      phase TEXT NOT NULL,
      environment TEXT NOT NULL,
      status TEXT NOT NULL,
      invoice_uuid TEXT,
      invoice_hash TEXT,
      response_json TEXT,
      payload_json TEXT,
      retry_count INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      synced_at TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )`
  );

  await ensureZatcaColumn("zatca_invoices", "payload_json", "TEXT");
  await ensureZatcaColumn("zatca_invoices", "retry_count", "INTEGER DEFAULT 0");
  await ensureZatcaColumn("zatca_invoices", "last_attempt_at", "TEXT");
  await ensureZatcaColumn("zatca_invoices", "synced_at", "TEXT");
  await ensureZatcaColumn("zatca_invoices", "error_message", "TEXT");
  await ensureZatcaColumn(
    "zatca_invoices",
    "updated_at",
    "TEXT DEFAULT (datetime('now'))"
  );
  await ensureZatcaColumn("zatca_invoices", "signed_xml", "TEXT");
  await ensureZatcaColumn("zatca_invoices", "qr_tlv", "TEXT");
  await ensureZatcaColumn("zatca_invoices", "next_retry_at", "TEXT");

  await execute(
    "CREATE INDEX IF NOT EXISTS idx_zatca_invoices_sale ON zatca_invoices(sale_id)"
  );
  await execute(
    "CREATE INDEX IF NOT EXISTS idx_zatca_invoices_status ON zatca_invoices(status)"
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS zatca_api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      request_body TEXT,
      response_body TEXT,
      http_status INTEGER,
      success INTEGER DEFAULT 0,
      error_message TEXT,
      duration_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );
  await execute(
    "CREATE INDEX IF NOT EXISTS idx_zatca_api_logs_created ON zatca_api_logs(created_at DESC)"
  );
}

async function ensureCashierModuleDefaults() {
  const migrated = await query(
    "SELECT value FROM settings WHERE key = '_cashier_reports_v1' LIMIT 1"
  );
  if (migrated.length > 0) return;

  await execute(
    "UPDATE settings SET value = '1' WHERE key = 'role_cashier_module_reports'"
  );
  await execute(
    "INSERT INTO settings (key, value) VALUES ('_cashier_reports_v1', '1')"
  );
}

async function ensureReceiptTemplateDefault() {
  const row = await queryOne(
    "SELECT value FROM settings WHERE key = 'receipt_template' LIMIT 1"
  );
  if (!row) {
    await execute(
      "INSERT INTO settings (key, value) VALUES ('receipt_template', 'baqala')"
    );
  }

  const tzRow = await queryOne(
    "SELECT value FROM settings WHERE key = 'business_timezone' LIMIT 1"
  );
  if (!tzRow) {
    await execute(
      "INSERT INTO settings (key, value) VALUES ('business_timezone', 'Asia/Riyadh')"
    );
  }
}

async function ensureSupplierLedgerSchema() {
  let purchaseCols = await query("PRAGMA table_info(purchases)");
  const addPurchaseCol = async (name, ddl) => {
    if (!purchaseCols.some((c) => c.name === name)) {
      await execute(ddl);
      purchaseCols = await query("PRAGMA table_info(purchases)");
    }
  };

  await addPurchaseCol(
    "purchase_type",
    "ALTER TABLE purchases ADD COLUMN purchase_type TEXT DEFAULT 'market'"
  );
  await addPurchaseCol(
    "payment_status",
    "ALTER TABLE purchases ADD COLUMN payment_status TEXT DEFAULT 'paid'"
  );
  await addPurchaseCol(
    "amount_paid",
    "ALTER TABLE purchases ADD COLUMN amount_paid REAL DEFAULT 0"
  );
  await addPurchaseCol("due_date", "ALTER TABLE purchases ADD COLUMN due_date TEXT");

  await execute(
    `UPDATE purchases
     SET payment_status = 'paid', amount_paid = total, purchase_type = COALESCE(purchase_type, 'market')
     WHERE COALESCE(amount_paid, 0) = 0 AND total > 0 AND COALESCE(payment_status, 'paid') = 'paid'`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      purchase_id INTEGER,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id)
    )`
  );
  await execute(
    "CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id)"
  );

  const productCols = await query("PRAGMA table_info(products)");
  if (!productCols.some((c) => c.name === "supplier_id")) {
    await execute(
      "ALTER TABLE products ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)"
    );
  }
}

async function ensureUsersAndExpensesSchema() {
  const userCols = await query("PRAGMA table_info(users)");
  if (!userCols.some((c) => c.name === "is_active")) {
    await execute(
      "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"
    );
  }

  const expenseCols = await query("PRAGMA table_info(expenses)");
  if (!expenseCols.some((c) => c.name === "category")) {
    await execute("ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'other'");
  }
}

async function ensureSettingsKeys() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await execute(
      "INSERT OR IGNORE INTO settings (key, value) VALUES ($1, $2)",
      [key, value]
    );
  }
}

/** One-time: SQLite datetime('now') is UTC — convert stored timestamps to business region. */
async function migrateUtcTimestampsToBusinessTimezone() {
  const done = await queryOne(
    "SELECT value FROM settings WHERE key = '_utc_to_business_tz_v1' LIMIT 1"
  );
  if (done) return;

  const settingsRows = await query("SELECT key, value FROM settings");
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  const tz = resolveBusinessTimezone(settings);

  const targets = [
    { table: "sales", columns: ["created_at"] },
    { table: "sale_returns", columns: ["created_at"] },
    { table: "purchases", columns: ["created_at"] },
    { table: "payments", columns: ["created_at", "payment_date"] },
    { table: "zatca_invoices", columns: ["created_at", "last_attempt_at", "synced_at", "updated_at"] },
    { table: "zatca_api_logs", columns: ["created_at"] },
    { table: "inventory", columns: ["created_at"] },
    { table: "categories", columns: ["created_at"] },
    { table: "units", columns: ["created_at"] },
    { table: "products", columns: ["created_at"] },
    { table: "customers", columns: ["created_at"] },
    { table: "suppliers", columns: ["created_at"] },
  ];

  for (const { table, columns } of targets) {
    if (!(await tableExists(table))) continue;

    const tableCols = await query(`PRAGMA table_info(${table})`);
    const colNames = new Set(tableCols.map((col) => col.name));

    for (const column of columns) {
      if (!colNames.has(column)) continue;

      const rows = await query(
        `SELECT id, ${column} AS ts FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ''`
      );

      for (const row of rows) {
        const converted = convertUtcSqliteDatetimeToBusiness(row.ts, tz);
        if (converted && converted !== row.ts) {
          await execute(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [
            converted,
            row.id,
          ]);
        }
      }
    }
  }

  await execute(
    "INSERT INTO settings (key, value) VALUES ('_utc_to_business_tz_v1', '1')"
  );
}

/** Normalize sales.created_at to ISO UTC for reliable display in business region. */
async function migrateSalesTimestampsToIsoUtc() {
  const done = await queryOne(
    "SELECT value FROM settings WHERE key = '_sales_iso_utc_v2' LIMIT 1"
  );
  if (done) return;

  const settingsRows = await query("SELECT key, value FROM settings");
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  const tz = resolveBusinessTimezone(settings);
  const v1Done = settings._utc_to_business_tz_v1 === "1";

  if (!(await tableExists("sales"))) {
    await execute(
      "INSERT INTO settings (key, value) VALUES ('_sales_iso_utc_v2', '1')"
    );
    return;
  }

  const rows = await query(
    "SELECT id, created_at FROM sales WHERE created_at IS NOT NULL AND created_at != ''"
  );

  for (const row of rows) {
    const raw = String(row.created_at).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) continue;

    const iso = v1Done
      ? wallClockInTimezoneToIso(raw, tz)
      : utcSqliteStringToIso(raw);

    if (iso && iso !== raw) {
      await execute("UPDATE sales SET created_at = $1 WHERE id = $2", [iso, row.id]);
    }
  }

  await execute(
    "INSERT INTO settings (key, value) VALUES ('_sales_iso_utc_v2', '1')"
  );
}

/** Fix order times still stored as UTC sqlite strings → ISO UTC. */
async function fixSalesUtcTimestampsForRiyadh() {
  const done = await queryOne(
    "SELECT value FROM settings WHERE key = '_sales_riyadh_fix_v3' LIMIT 1"
  );
  if (done) return;
  if (!(await tableExists("sales"))) {
    await execute(
      "INSERT INTO settings (key, value) VALUES ('_sales_riyadh_fix_v3', '1')"
    );
    return;
  }

  const rows = await query(
    "SELECT id, created_at FROM sales WHERE created_at IS NOT NULL AND created_at != ''"
  );

  for (const row of rows) {
    const raw = String(row.created_at).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
      const iso = utcSqliteStringToIso(raw);
      if (iso && iso !== raw) {
        await execute("UPDATE sales SET created_at = $1 WHERE id = $2", [iso, row.id]);
      }
    }
  }

  await execute(
    "INSERT INTO settings (key, value) VALUES ('_sales_riyadh_fix_v3', '1')"
  );
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
      try {
        await execute(
          "INSERT INTO units (name, symbol, example) VALUES ($1, $2, $3)",
          [unit.name, unit.symbol, unit.example]
        );
      } catch {
        /* ignore duplicate symbol if seed races on startup */
      }
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
    const adminHash = bcrypt.hashSync("admin123", 10);
    await execute(
      "INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5)",
      ["admin", adminHash, "Administrator", "admin", 1]
    );

    const cashierHash = bcrypt.hashSync("cashier123", 10);
    await execute(
      "INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5)",
      ["cashier", cashierHash, "Cashier", "cashier", 1]
    );
  } else {
    const cashier = await queryOne(
      "SELECT id FROM users WHERE username = 'cashier' LIMIT 1"
    );
    if (!cashier) {
      const cashierHash = bcrypt.hashSync("cashier123", 10);
      await execute(
        "INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5)",
        ["cashier", cashierHash, "Cashier", "cashier", 1]
      );
    }
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

export async function clearDatabaseData() {
  const clearOrder = [
    "sale_return_items",
    "sale_returns",
    "zatca_invoices",
    "sale_items",
    "sales",
    "purchase_items",
    "purchases",
    "payments",
    "inventory",
    "expenses",
    "products",
    "customers",
    "suppliers",
    "categories",
    "units",
    "users",
    "settings",
    "import_logs",
  ];

  await runInTransaction(async ({ execute: txExecute }) => {
    for (const table of clearOrder) {
      try {
        await txExecute(`DELETE FROM ${table}`);
      } catch {
        /* table may not exist */
      }
    }
    try {
      await txExecute("DELETE FROM sqlite_sequence");
    } catch {
      /* ignore */
    }
  });

  await execute(
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('_schema_ready', '1')"
  );
  await seedDefaultData();
  await ensureUnitsSchema();
  await ensureSettingsKeys();
}

export { schemaInitialized };
