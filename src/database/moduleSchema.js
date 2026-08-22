/** Module manager persistence. Additive — does not rename existing POS tables. */

export const MODULE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_modules (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    enabled INTEGER NOT NULL DEFAULT 0,
    configured INTEGER NOT NULL DEFAULT 0,
    installed_at TEXT,
    enabled_at TEXT,
    disabled_at TEXT,
    config_json TEXT,
    migration_status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_app_modules_status ON app_modules(status, enabled)`,
];
