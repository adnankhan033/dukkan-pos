/** Wholesale + product pack units. Created only when the Wholesale module is installed. */

export const WHOLESALE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS price_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    kind TEXT NOT NULL DEFAULT 'wholesale',
    currency TEXT NOT NULL DEFAULT 'SAR',
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS price_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_list_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_unit_id INTEGER,
    min_qty REAL NOT NULL DEFAULT 1,
    price REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(price_list_id, product_id, product_unit_id, min_qty)
  )`,

  `CREATE TABLE IF NOT EXISTS customer_price_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    price_list_id INTEGER NOT NULL,
    credit_limit REAL DEFAULT 0,
    min_order_qty REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(customer_id, price_list_id)
  )`,

  `CREATE TABLE IF NOT EXISTS product_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    unit_id INTEGER,
    name TEXT NOT NULL,
    conversion_factor REAL NOT NULL DEFAULT 1,
    is_base INTEGER NOT NULL DEFAULT 0,
    barcode TEXT,
    cost_price REAL,
    selling_price REAL,
    wholesale_price REAL,
    is_purchase_unit INTEGER NOT NULL DEFAULT 0,
    is_sales_unit INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_price_list_items_product ON price_list_items(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_product_units_product ON product_units(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_price_lists_customer ON customer_price_lists(customer_id)`,
];
