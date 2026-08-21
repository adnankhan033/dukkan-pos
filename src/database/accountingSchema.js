/** Double-entry accounting tables. Applied on new installs and via ensureAccountingSchema(). */

export const ACCOUNTING_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS account_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT,
    type TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT,
    type TEXT NOT NULL,
    subtype TEXT,
    normal_balance TEXT NOT NULL DEFAULT 'debit',
    is_system INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    partner_id INTEGER,
    linked_type TEXT,
    linked_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES account_groups(id)
  )`,

  `CREATE TABLE IF NOT EXISTS fiscal_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    is_current INTEGER NOT NULL DEFAULT 0,
    closed_at TEXT,
    closed_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    ownership_percent REAL NOT NULL DEFAULT 0,
    profit_share_percent REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    capital_account_id INTEGER,
    drawings_account_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS partner_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    cash_account_id INTEGER,
    journal_entry_id INTEGER,
    entry_date TEXT NOT NULL,
    reference TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (partner_id) REFERENCES partners(id)
  )`,

  `CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    entry_type TEXT NOT NULL,
    source_type TEXT,
    source_id INTEGER,
    fiscal_period_id INTEGER,
    entry_date TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'posted',
    reverses_id INTEGER,
    reversed_by_id INTEGER,
    created_by INTEGER,
    created_by_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id)
  )`,

  `CREATE TABLE IF NOT EXISTS journal_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0,
    description TEXT,
    partner_id INTEGER,
    customer_id INTEGER,
    supplier_id INTEGER,
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`,

  `CREATE TABLE IF NOT EXISTS accounting_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    reference TEXT,
    previous_value TEXT,
    new_value TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS accounting_sequences (
    name TEXT PRIMARY KEY,
    last_value INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(group_id)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type, is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_linked ON accounts(linked_type, linked_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date, status)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_period ON journal_entries(fiscal_period_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_customer ON journal_lines(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_supplier ON journal_lines(supplier_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_partner ON journal_lines(partner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_partner_tx_partner ON partner_transactions(partner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date)`,
];

export const ACCOUNTING_BACKUP_TABLES = [
  "account_groups",
  "accounts",
  "fiscal_periods",
  "partners",
  "partner_transactions",
  "journal_entries",
  "journal_lines",
  "accounting_audit_log",
  "accounting_sequences",
];
