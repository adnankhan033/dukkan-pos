import { query, queryOne, execute, insert, runInTransaction, resolveInsertId, ensureExpenseCategoriesSchema } from "../database/connection";
import { settingsService } from "./SettingsService";
import { useAuthStore } from "../contexts/store";
import {
  ACCOUNTING_SETTING_KEYS,
  ACCOUNT_CODES,
  ACCOUNT_TYPES,
  DEFAULT_ACCOUNT_GROUPS,
  DEFAULT_ACCOUNTS,
  EXPENSE_ACCOUNT_MAP,
  JOURNAL_TYPES,
  applyPartnerOwnershipDefaults,
  dateOnly,
  formatAccountingRef,
  isAccountingEnabled,
  ownershipSharesFromAmounts,
  roundMoney,
  signedBalance,
  signedLineDelta,
} from "../utils/accounting";
import { isPayLaterMethod } from "../utils/paymentMethods";
import { getBusinessDateISO, getBusinessDateTimeISO } from "../utils/businessDate";
import { ACCOUNTING_SCHEMA_STATEMENTS } from "../database/accountingSchema";
import { getExpenseBreakdownInRange, getProfitInRange } from "./FinanceService";
import { EXPENSE_CATEGORIES } from "../utils/constants";

async function txInsert(tx, sql, params = []) {
  const result = await tx.execute(sql, params);
  const rows = await tx.query("SELECT last_insert_rowid() AS id");
  const id = resolveInsertId(result, rows);
  if (!id) throw new Error("Insert failed: could not get new record id");
  return id;
}

function currentUser() {
  const { user } = useAuthStore.getState();
  return user || null;
}

function line(accountId, debit, credit, extra = {}) {
  const d = roundMoney(debit);
  const c = roundMoney(credit);
  if (d === 0 && c === 0) return null;
  return { account_id: accountId, debit: d, credit: c, ...extra };
}

class AccountingService {
  async ensureSchema() {
    for (const statement of ACCOUNTING_SCHEMA_STATEMENTS) {
      await execute(statement);
    }
    await this.ensurePartyColumns();
  }

  async ensurePartyColumns() {
    const addCol = async (table, column, ddl) => {
      const cols = await query(`PRAGMA table_info(${table})`);
      if (!cols.some((c) => c.name === column)) {
        await execute(ddl);
      }
    };
    await addCol("customers", "opening_balance", "ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0");
    await addCol("customers", "credit_limit", "ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT 0");
    await addCol("suppliers", "opening_balance", "ALTER TABLE suppliers ADD COLUMN opening_balance REAL DEFAULT 0");
    await addCol("expenses", "payment_method", "ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'cash'");
    await addCol("expenses", "journal_entry_id", "ALTER TABLE expenses ADD COLUMN journal_entry_id INTEGER");
    await addCol("partners", "shares_manual", "ALTER TABLE partners ADD COLUMN shares_manual INTEGER NOT NULL DEFAULT 0");
  }

  async isEnabled() {
    const value = await settingsService.get(ACCOUNTING_SETTING_KEYS.ENABLED, "0");
    return isAccountingEnabled({ [ACCOUNTING_SETTING_KEYS.ENABLED]: value });
  }

  async businessDate() {
    return getBusinessDateISO(await settingsService.getAll());
  }

  async getStatus() {
    const settings = await settingsService.getAll();
    const enabled = isAccountingEnabled(settings);
    const period = await this.getCurrentPeriod();
    const [accounts, partners, journals] = await Promise.all([
      queryOne("SELECT COUNT(*) AS c FROM accounts WHERE is_active = 1"),
      queryOne("SELECT COUNT(*) AS c FROM partners WHERE is_active = 1"),
      queryOne("SELECT COUNT(*) AS c FROM journal_entries WHERE status = 'posted'"),
    ]);
    return {
      enabled,
      configuredAt: settings[ACCOUNTING_SETTING_KEYS.CONFIGURED_AT] || "",
      startMode: settings[ACCOUNTING_SETTING_KEYS.START_MODE] || "snapshot",
      fiscalStart: settings[ACCOUNTING_SETTING_KEYS.FISCAL_START] || "",
      defaultCashId: Number(settings[ACCOUNTING_SETTING_KEYS.DEFAULT_CASH_ID] || 0) || null,
      defaultBankId: Number(settings[ACCOUNTING_SETTING_KEYS.DEFAULT_BANK_ID] || 0) || null,
      period,
      accountCount: Number(accounts?.c || 0),
      partnerCount: Number(partners?.c || 0),
      journalCount: Number(journals?.c || 0),
    };
  }

  async getOpeningSnapshot() {
    const stock = await this.getLiveInventoryValue();
    const ar = await queryOne(
      `SELECT COALESCE(SUM(COALESCE(original_total, total) - COALESCE(amount_paid, 0)), 0) AS value
       FROM sales
       WHERE customer_id IS NOT NULL
         AND status IN ('completed', 'partial_return')
         AND payment_status IN ('pending', 'partial')
         AND (COALESCE(original_total, total) - COALESCE(amount_paid, 0)) > 0`
    );
    const ap = await queryOne(
      `SELECT COALESCE(SUM(total - COALESCE(amount_paid, 0)), 0) AS value
       FROM purchases
       WHERE supplier_id IS NOT NULL
         AND payment_status IN ('pending', 'partial')
         AND (total - COALESCE(amount_paid, 0)) > 0`
    );
    return {
      inventoryValue: stock.purchaseTotal,
      inventoryQty: stock.quantity,
      accountsReceivable: roundMoney(ar?.value),
      accountsPayable: roundMoney(ap?.value),
    };
  }

  /** On-hand published stock: quantity × cost (purchase) and quantity × selling price. */
  async getLiveInventoryValue() {
    const row = await queryOne(
      `SELECT COALESCE(SUM(quantity * cost_price), 0) AS purchase_total,
              COALESCE(SUM(quantity * selling_price), 0) AS selling_total,
              COALESCE(SUM(quantity), 0) AS quantity,
              COUNT(*) AS product_count
       FROM products
       WHERE COALESCE(published, 1) = 1`
    );
    return {
      purchaseTotal: roundMoney(row?.purchase_total),
      sellingTotal: roundMoney(row?.selling_total),
      quantity: Number(row?.quantity || 0),
      productCount: Number(row?.product_count || 0),
    };
  }

  async getInventoryBookValue(asOf) {
    const inv = await this.getAccountByCode(ACCOUNT_CODES.INVENTORY);
    if (!inv) return 0;
    const balances = await this.accountBalances({ asOf });
    return balances.find((r) => r.id === inv.id)?.balance || 0;
  }

  async postInventoryValueDelta(delta, description = "Inventory value change", sourceId = null, { against = "equity" } = {}) {
    if (!(await this.isEnabled())) return null;
    const value = roundMoney(delta);
    if (!value) return null;
    const invId = await this.accountId(ACCOUNT_CODES.INVENTORY);
    const offsetId = await this.accountId(
      against === "adjust" ? ACCOUNT_CODES.INVENTORY_ADJUST : ACCOUNT_CODES.OPENING_EQUITY
    );
    const abs = Math.abs(value);
    const increase = value > 0;
    return this.postJournal({
      prefix: "JV",
      entryType: JOURNAL_TYPES.INVENTORY,
      sourceType: "inventory_revalue",
      sourceId,
      allowDuplicate: true,
      entryDate: await this.businessDate(),
      description,
      lines: increase
        ? [line(invId, abs, 0, { description }), line(offsetId, 0, abs, { description })]
        : [line(offsetId, abs, 0, { description }), line(invId, 0, abs, { description })],
    });
  }

  async syncInventoryBookToStock({ against = "equity" } = {}) {
    if (!(await this.isEnabled())) return this.getLiveInventoryValue();
    const live = await this.getLiveInventoryValue();
    const asOf = await this.businessDate();
    const book = await this.getInventoryBookValue(asOf);
    const delta = roundMoney(live.purchaseTotal - book);
    if (Math.abs(delta) >= 0.01) {
      await this.postInventoryValueDelta(delta, "Align inventory to on-hand stock at cost", null, { against });
    }
    return live;
  }

  async repairMispostedInventoryRevaluations() {
    if (this._inventoryRevalueRepair) return this._inventoryRevalueRepair;
    this._inventoryRevalueRepair = this._runBooksRepair().finally(() => {
      this._inventoryRevalueRepair = null;
    });
    return this._inventoryRevalueRepair;
  }

  async _runBooksRepair() {
    if (!(await this.isEnabled())) return;
    await this.seedChartOfAccounts();
    await this._repairDuplicateOpeningCash();
    await this._backfillPartnerOwnershipShares();
    await this._repairOpeningEquityRevalues();
    await this._reclassInventoryAdjustmentsToOpeningEquity();
    await this._repairOrphanExpenseReversals();
    await this._backfillMissingSales();
    await this._restateBooksToActual();
  }

  /**
   * Start-from-zero used to post till cash AND partner capital as extra cash.
   * Hide the duplicate opening-cash journal. Do not post a reversing entry —
   * reversed journals are already excluded from balances.
   */
  async _repairDuplicateOpeningCash() {
    const done = await settingsService.get(ACCOUNTING_SETTING_KEYS.OPENING_CASH_DEDUPED, "");
    if (done === "2") return;

    if (done === "1") {
      const extra = await queryOne(
        `SELECT id FROM journal_entries
         WHERE entry_type = 'reversal' AND status = 'posted'
           AND description LIKE 'Remove cash counted twice with partner capital%'`
      );
      if (extra?.id) {
        await execute("UPDATE journal_entries SET status = 'reversed' WHERE id = $1", [extra.id]);
      }
      await settingsService.set(ACCOUNTING_SETTING_KEYS.OPENING_CASH_DEDUPED, "2");
      return;
    }

    const startMode = await settingsService.get(ACCOUNTING_SETTING_KEYS.START_MODE, "snapshot");
    if (startMode !== "zero") {
      await settingsService.set(ACCOUNTING_SETTING_KEYS.OPENING_CASH_DEDUPED, "2");
      return;
    }

    const opening = await queryOne(
      `SELECT * FROM journal_entries
       WHERE entry_type = 'opening' AND status = 'posted' AND source_type = 'opening'
       ORDER BY id ASC LIMIT 1`
    );
    if (!opening) {
      await settingsService.set(ACCOUNTING_SETTING_KEYS.OPENING_CASH_DEDUPED, "2");
      return;
    }

    const cashAccount = await this.getAccountByCode(ACCOUNT_CODES.CASH);
    if (!cashAccount) {
      await settingsService.set(ACCOUNTING_SETTING_KEYS.OPENING_CASH_DEDUPED, "2");
      return;
    }

    const openingCash = roundMoney(
      (
        await queryOne(
          `SELECT COALESCE(SUM(debit - credit), 0) AS value
           FROM journal_lines WHERE journal_entry_id = $1 AND account_id = $2`,
          [opening.id, cashAccount.id]
        )
      )?.value
    );
    const partnerCash = roundMoney(
      (
        await queryOne(
          `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS value
           FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id
           WHERE je.status = 'posted' AND je.entry_type = 'partner'
             AND date(je.entry_date) = date($1)
             AND jl.account_id = $2`,
          [opening.entry_date, cashAccount.id]
        )
      )?.value
    );

    if (openingCash > 0 && partnerCash > 0 && Math.abs(openingCash - partnerCash) < 0.01) {
      await execute("UPDATE journal_entries SET status = 'reversed' WHERE id = $1", [opening.id]);
      await this.audit("reverse", "journal_entry", opening.id, opening.reference, "Duplicate opening cash");
    }
    await settingsService.set(ACCOUNTING_SETTING_KEYS.OPENING_CASH_DEDUPED, "2");
  }

  async _backfillPartnerOwnershipShares() {
    const done = await settingsService.get(ACCOUNTING_SETTING_KEYS.PARTNER_SHARES_BACKFILLED, "");
    if (done === "1") return;
    const rows = await query("SELECT id, ownership_percent FROM partners WHERE is_active = 1");
    if (!rows.length || rows.some((row) => Number(row.ownership_percent) > 0)) {
      await settingsService.set(ACCOUNTING_SETTING_KEYS.PARTNER_SHARES_BACKFILLED, "1");
      return;
    }

    const partners = [];
    for (const row of rows) {
      partners.push(await this.getPartner(row.id));
    }
    const shares = ownershipSharesFromAmounts(partners.map((p) => p.total_invested));
    if (shares.every((n) => n === 0)) {
      await settingsService.set(ACCOUNTING_SETTING_KEYS.PARTNER_SHARES_BACKFILLED, "1");
      return;
    }
    for (let i = 0; i < partners.length; i += 1) {
      const share = shares[i];
      const profit = Number(partners[i].profit_share_percent) > 0 ? Number(partners[i].profit_share_percent) : share;
      await execute(
        `UPDATE partners SET ownership_percent = $1, profit_share_percent = $2, updated_at = datetime('now')
         WHERE id = $3`,
        [share, profit, partners[i].id]
      );
    }
    await settingsService.set(ACCOUNTING_SETTING_KEYS.PARTNER_SHARES_BACKFILLED, "1");
  }

  async _repairOpeningEquityRevalues() {
    const done = await settingsService.get(ACCOUNTING_SETTING_KEYS.INVENTORY_REVALUE_REPAIRED, "");
    if (done === "1") return;

    const journals = await query(
      `SELECT id FROM journal_entries
       WHERE source_type = 'inventory_revalue' AND status = 'posted' AND entry_type != 'reversal'
       ORDER BY id ASC`
    );
    for (const row of journals) {
      await this.reverseJournal(row.id, "Move inventory alignment off opening equity");
    }
    await settingsService.set(ACCOUNTING_SETTING_KEYS.INVENTORY_REVALUE_REPAIRED, "1");
  }

  /** Stock restatement belongs in starting balance, not this period's profit. */
  async _reclassInventoryAdjustmentsToOpeningEquity() {
    const done = await settingsService.get(ACCOUNTING_SETTING_KEYS.INVENTORY_PL_RECLASS, "");
    if (done === "1") return;

    const adj = await this.getAccountByCode(ACCOUNT_CODES.INVENTORY_ADJUST);
    const equity = await this.getAccountByCode(ACCOUNT_CODES.OPENING_EQUITY);
    if (adj && equity) {
      const rows = await this.accountBalances();
      const balance = rows.find((r) => r.id === adj.id)?.balance || 0;
      if (Math.abs(balance) >= 0.01) {
        const abs = Math.abs(balance);
        const description = "Move stock restatement to starting balance";
        await this.postJournal({
          prefix: "JV",
          entryType: JOURNAL_TYPES.INVENTORY,
          sourceType: "inventory_reclass",
          sourceId: 1,
          allowDuplicate: true,
          entryDate: await this.businessDate(),
          description,
          lines:
            balance > 0
              ? [line(equity.id, abs, 0, { description }), line(adj.id, 0, abs, { description })]
              : [line(adj.id, abs, 0, { description }), line(equity.id, 0, abs, { description })],
        });
      }
    }
    await settingsService.set(ACCOUNTING_SETTING_KEYS.INVENTORY_PL_RECLASS, "1");
    await this.syncInventoryBookToStock({ against: "equity" });
  }

  /** Expense edits reversed the old journal then reused that reversal as the live entry. */
  async _repairOrphanExpenseReversals() {
    const done = await settingsService.get(ACCOUNTING_SETTING_KEYS.EXPENSE_REVERSAL_REPAIRED, "");
    if (done === "1") return;

    const rows = await query(
      `SELECT e.id AS expense_id, je.id AS journal_id
       FROM expenses e
       JOIN journal_entries je ON je.id = e.journal_entry_id
       WHERE je.status = 'posted' AND je.entry_type = 'reversal'`
    );
    for (const row of rows) {
      await this.reverseJournal(row.journal_id, "Restore expense after update");
      const expense = await queryOne("SELECT * FROM expenses WHERE id = $1", [row.expense_id]);
      if (expense) await this.postExpense({ ...expense, journal_entry_id: null });
    }
    await settingsService.set(ACCOUNTING_SETTING_KEYS.EXPENSE_REVERSAL_REPAIRED, "1");
  }

  async _backfillMissingSales() {
    const missing = await query(
      `SELECT s.id FROM sales s
       WHERE s.status IN ('completed', 'partial_return')
         AND NOT EXISTS (
           SELECT 1 FROM journal_entries je
           WHERE je.source_type = 'sale' AND je.source_id = s.id
             AND je.status = 'posted' AND je.entry_type != 'reversal'
         )`
    );
    for (const row of missing) {
      const sale = await queryOne(
        `SELECT s.*, c.name AS customer_name FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = $1`,
        [row.id]
      );
      if (!sale) continue;
      const items = await query(
        `SELECT si.*, p.cost_price FROM sale_items si
         LEFT JOIN products p ON p.id = si.product_id WHERE si.sale_id = $1`,
        [row.id]
      );
      await this.postSale({ ...sale, items });
    }
  }

  /** Force GL cash, stock, expenses, and stock-correction to match the POS. */
  async _restateBooksToActual() {
    const live = await this.getLiveInventoryValue();
    const rows = await this.accountBalances();
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));

    const expenseRows = await query("SELECT category, amount FROM expenses");
    const wantExpense = {};
    for (const row of expenseRows) {
      const code = EXPENSE_ACCOUNT_MAP[row.category] || ACCOUNT_CODES.OTHER_EXPENSE;
      wantExpense[code] = roundMoney((wantExpense[code] || 0) + Number(row.amount || 0));
    }

    const cashId = await this.defaultCashId();
    const cashAccount = rows.find((r) => r.id === cashId);
    const lines = [];
    let extraCashOut = 0;

    const pushDelta = (account, target) => {
      if (!account) return;
      const current = account.balance || 0;
      const diff = roundMoney(target - current);
      if (Math.abs(diff) < 0.01) return;
      if (account.normal_balance === "credit") {
        lines.push(diff > 0 ? line(account.id, 0, diff) : line(account.id, -diff, 0));
      } else {
        lines.push(diff > 0 ? line(account.id, diff, 0) : line(account.id, 0, -diff));
      }
    };

    const expenseCodes = new Set([
      ...Object.values(EXPENSE_ACCOUNT_MAP),
      ACCOUNT_CODES.OTHER_EXPENSE,
    ]);
    for (const account of rows) {
      if (account.type !== ACCOUNT_TYPES.EXPENSE) continue;
      if (account.code === ACCOUNT_CODES.COGS || account.code === ACCOUNT_CODES.INVENTORY_ADJUST) continue;
      if (!expenseCodes.has(account.code) && !account.balance) continue;
      const want = wantExpense[account.code] || 0;
      extraCashOut = roundMoney(extraCashOut + ((account.balance || 0) - want));
      pushDelta(account, want);
    }

    pushDelta(byCode[ACCOUNT_CODES.INVENTORY], live.purchaseTotal);
    pushDelta(byCode[ACCOUNT_CODES.INVENTORY_ADJUST], 0);
    if (cashAccount && Math.abs(extraCashOut) >= 0.01) {
      // Extra expense in the GL was taken from cash. Put that cash back (or take more).
      pushDelta(cashAccount, roundMoney((cashAccount.balance || 0) + extraCashOut));
    }

    const raw = lines.filter(Boolean);
    if (raw.length < 2) return;
    const debit = roundMoney(raw.reduce((s, l) => s + Number(l.debit || 0), 0));
    const credit = roundMoney(raw.reduce((s, l) => s + Number(l.credit || 0), 0));
    const plug = roundMoney(debit - credit);
    if (Math.abs(plug) >= 0.01) {
      const equityId = await this.accountId(ACCOUNT_CODES.OPENING_EQUITY);
      raw.push(plug > 0 ? line(equityId, 0, plug) : line(equityId, -plug, 0));
    }
    if (raw.filter(Boolean).length < 2) return;

    await this.postJournal({
      prefix: "JV",
      entryType: JOURNAL_TYPES.INVENTORY,
      sourceType: "books_restate",
      sourceId: 1,
      allowDuplicate: true,
      entryDate: await this.businessDate(),
      description: "Restate books to actual shop amounts",
      lines: raw,
    });
  }

  async seedChartOfAccounts() {
    for (const group of DEFAULT_ACCOUNT_GROUPS) {
      await execute(
        `INSERT OR IGNORE INTO account_groups (code, name, name_ar, type, sort_order, is_system)
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [group.code, group.name, group.name_ar, group.type, group.sort_order]
      );
    }
    const groups = await query("SELECT id, code FROM account_groups");
    const groupId = Object.fromEntries(groups.map((g) => [g.code, g.id]));
    for (const account of DEFAULT_ACCOUNTS) {
      await execute(
        `INSERT OR IGNORE INTO accounts
         (group_id, code, name, name_ar, type, subtype, normal_balance, is_system, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
        [
          groupId[account.group],
          account.code,
          account.name,
          account.name_ar,
          account.type,
          account.subtype,
          account.normal,
          account.system,
        ]
      );
    }
  }

  async ensureDefaultBookSettings() {
    const year = new Date().getFullYear();
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const current = await queryOne("SELECT id FROM fiscal_periods WHERE is_current = 1");
    if (!current) {
      await execute("UPDATE fiscal_periods SET is_current = 0");
      const existing = await queryOne(
        "SELECT id FROM fiscal_periods WHERE start_date = $1 AND end_date = $2",
        [start, end]
      );
      if (existing?.id) {
        await execute("UPDATE fiscal_periods SET status = 'open', is_current = 1 WHERE id = $1", [existing.id]);
      } else {
        await insert(
          `INSERT INTO fiscal_periods (name, year, start_date, end_date, status, is_current)
           VALUES ($1, $2, $3, $4, 'open', 1)`,
          [`FY ${year}`, year, start, end]
        );
      }
    }

    const cashAccount = await this.getAccountByCode(ACCOUNT_CODES.CASH);
    const bankAccount = await this.getAccountByCode(ACCOUNT_CODES.BANK);
    const patch = {};
    if (cashAccount?.id) patch[ACCOUNTING_SETTING_KEYS.DEFAULT_CASH_ID] = String(cashAccount.id);
    if (bankAccount?.id) patch[ACCOUNTING_SETTING_KEYS.DEFAULT_BANK_ID] = String(bankAccount.id);
    const fiscalStart = await settingsService.get(ACCOUNTING_SETTING_KEYS.FISCAL_START, "");
    if (!fiscalStart) patch[ACCOUNTING_SETTING_KEYS.FISCAL_START] = start;
    if (Object.keys(patch).length) await settingsService.updateMany(patch);
  }

  /**
   * After a data wipe the chart of accounts is gone and books are switched off,
   * so new sales never post. Restore the chart and turn books back on when the
   * shop already has products or transactions.
   */
  async recoverBooksAfterDataClear() {
    await this.ensureSchema();
    await ensureExpenseCategoriesSchema();
    await this.seedChartOfAccounts();
    await this.ensureDefaultBookSettings();

    if (await this.isEnabled()) return false;

    const shop = await queryOne(`
      SELECT
        (SELECT COUNT(*) FROM sales WHERE COALESCE(status, '') != 'held') AS sales,
        (SELECT COUNT(*) FROM purchases) AS purchases,
        (SELECT COUNT(*) FROM expenses) AS expenses,
        (SELECT COUNT(*) FROM products) AS products
    `);
    const hasShopWork =
      Number(shop?.sales || 0) +
        Number(shop?.purchases || 0) +
        Number(shop?.expenses || 0) +
        Number(shop?.products || 0) >
      0;
    if (!hasShopWork) return false;

    await settingsService.updateMany({
      [ACCOUNTING_SETTING_KEYS.ENABLED]: "1",
      [ACCOUNTING_SETTING_KEYS.CONFIGURED_AT]: getBusinessDateTimeISO(await settingsService.getAll()),
      [ACCOUNTING_SETTING_KEYS.START_MODE]: "snapshot",
    });
    try {
      const { activationService } = await import("./ActivationService.js");
      await activationService.repairRegistrationIfShopAlreadyInUse();
    } catch {
      /* setup flags are independent of books recovery */
    }
    return true;
  }

  async activate({
    fiscalStart,
    cashOpening = 0,
    banks = [],
    partners = [],
    startMode = "snapshot",
  }) {
    await this.ensureSchema();
    await this.seedChartOfAccounts();

    const start = dateOnly(fiscalStart) || `${new Date().getFullYear()}-01-01`;
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);
    const end = dateOnly(endDate.toISOString());
    const year = startDate.getFullYear();

    await execute("UPDATE fiscal_periods SET is_current = 0");
    const existing = await queryOne(
      "SELECT id FROM fiscal_periods WHERE start_date = $1 AND end_date = $2",
      [start, end]
    );
    let periodId = existing?.id;
    if (!periodId) {
      periodId = await insert(
        `INSERT INTO fiscal_periods (name, year, start_date, end_date, status, is_current)
         VALUES ($1, $2, $3, $4, 'open', 1)`,
        [`FY ${year}`, year, start, end]
      );
    } else {
      await execute(
        "UPDATE fiscal_periods SET status = 'open', is_current = 1 WHERE id = $1",
        [periodId]
      );
    }

    const cashAccount = await this.getAccountByCode(ACCOUNT_CODES.CASH);
    const bankAccount = await this.getAccountByCode(ACCOUNT_CODES.BANK);
    if (!cashAccount || !bankAccount) {
      throw new Error("Chart of accounts could not be created");
    }

    await settingsService.updateMany({
      [ACCOUNTING_SETTING_KEYS.ENABLED]: "1",
      [ACCOUNTING_SETTING_KEYS.CONFIGURED_AT]: getBusinessDateTimeISO(await settingsService.getAll()),
      [ACCOUNTING_SETTING_KEYS.FISCAL_START]: start,
      [ACCOUNTING_SETTING_KEYS.DEFAULT_CASH_ID]: String(cashAccount.id),
      [ACCOUNTING_SETTING_KEYS.DEFAULT_BANK_ID]: String(bankAccount.id),
      [ACCOUNTING_SETTING_KEYS.START_MODE]: startMode,
    });

    const namedRaw = (partners || []).filter((p) => String(p.name || "").trim());
    const setupPartners = applyPartnerOwnershipDefaults(partners);
    const createdPartners = [];
    for (const partner of setupPartners) {
      const raw = namedRaw.find(
        (p) => String(p.name || "").trim().toLowerCase() === String(partner.name || "").trim().toLowerCase()
      );
      const created = await this.createPartner({
        name: String(partner.name || "").trim(),
        phone: partner.phone,
        notes: partner.notes,
        ownership_percent: Number(partner.ownership_percent) || 0,
        profit_share_percent: Number(partner.profit_share_percent) || Number(partner.ownership_percent) || 0,
        initial_capital: Number(partner.capital) || 0,
        cash_account_id: cashAccount.id,
        entry_date: start,
        skipCapitalJournal: true,
        shares_manual: Number(raw?.ownership_percent) > 0,
      });
      const capitalAmt = Number(partner.capital) || 0;
      if (capitalAmt > 0) {
        await insert(
          `INSERT INTO partner_transactions
           (partner_id, type, amount, cash_account_id, entry_date, notes)
           VALUES ($1, 'initial_capital', $2, $3, $4, 'Opening capital')`,
          [created.id, capitalAmt, cashAccount.id, start]
        );
      }
      createdPartners.push({ ...created, capital: capitalAmt });
    }

    const extraBanks = [];
    for (let i = 0; i < (banks || []).length; i += 1) {
      const bank = banks[i];
      const name = String(bank.name || "").trim();
      if (!name) continue;
      if (i === 0) {
        await execute(
          "UPDATE accounts SET name = $1, notes = $2, updated_at = datetime('now') WHERE id = $3",
          [name, bank.number || null, bankAccount.id]
        );
        extraBanks.push({ account: { ...bankAccount, name }, opening: Number(bank.opening) || 0 });
        continue;
      }
      const code = `111${i}`;
      const id = await insert(
        `INSERT INTO accounts
         (group_id, code, name, notes, type, subtype, normal_balance, is_system, is_active)
         VALUES ($1, $2, $3, $4, $5, 'bank', 'debit', 0, 1)`,
        [bankAccount.group_id, code, name, bank.number || null, ACCOUNT_TYPES.ASSET]
      );
      extraBanks.push({ account: await this.getAccount(id), opening: Number(bank.opening) || 0 });
    }

    const partnerCapitalTotal = roundMoney(
      createdPartners.reduce((sum, partner) => sum + (Number(partner.capital) || 0), 0)
    );
    const bankOpeningTotal = roundMoney(
      extraBanks.reduce((sum, bank) => sum + (Number(bank.opening) || 0), 0)
    );
    let countedCash = roundMoney(cashOpening);
    if (startMode !== "snapshot" && countedCash <= 0 && bankOpeningTotal <= 0 && partnerCapitalTotal > 0) {
      countedCash = partnerCapitalTotal;
    }

    const snapshot =
      startMode === "snapshot"
        ? await this.getOpeningSnapshot()
        : { accountsReceivable: 0, accountsPayable: 0, inventoryValue: 0 };

    await this.postOpeningBalances({
      entryDate: start,
      cashOpening: countedCash,
      cashAccountId: cashAccount.id,
      banks: extraBanks.length ? extraBanks : [{ account: bankAccount, opening: 0 }],
      snapshot,
      partners: createdPartners,
    });

    await this.audit("activate", "accounting", periodId, "Accounting configured");
    try {
      const { moduleService } = await import("./ModuleService.js");
      await moduleService.markConfigured("accounting", true);
    } catch {
      /* module manager is optional during setup */
    }
    return this.getStatus();
  }

  async postOpeningBalances({ entryDate, cashOpening, cashAccountId, banks, snapshot, partners }) {
    const cashId = cashAccountId || (await this.accountId(ACCOUNT_CODES.CASH));
    const arId = await this.accountId(ACCOUNT_CODES.AR);
    const invId = await this.accountId(ACCOUNT_CODES.INVENTORY);
    const apId = await this.accountId(ACCOUNT_CODES.AP);
    const openingId = await this.accountId(ACCOUNT_CODES.OPENING_EQUITY);

    const lines = [];
    const cashAmt = roundMoney(cashOpening);
    if (cashAmt > 0) lines.push(line(cashId, cashAmt, 0, { description: "Opening cash" }));

    for (const bank of banks || []) {
      const amt = roundMoney(bank.opening);
      if (amt > 0 && bank.account?.id) {
        lines.push(line(bank.account.id, amt, 0, { description: `Opening ${bank.account.name}` }));
      }
    }

    if (snapshot.accountsReceivable > 0) {
      lines.push(line(arId, snapshot.accountsReceivable, 0, { description: "Opening receivables" }));
    }
    if (snapshot.inventoryValue > 0) {
      lines.push(line(invId, snapshot.inventoryValue, 0, { description: "Opening inventory" }));
    }
    if (snapshot.accountsPayable > 0) {
      lines.push(line(apId, 0, snapshot.accountsPayable, { description: "Opening payables" }));
    }

    for (const partner of partners || []) {
      const amt = roundMoney(partner.capital);
      if (amt > 0 && partner.capital_account_id) {
        lines.push(
          line(partner.capital_account_id, 0, amt, {
            description: `Capital — ${partner.name}`,
            partner_id: partner.id,
          })
        );
      }
    }

    const debit = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
    const credit = roundMoney(lines.reduce((s, l) => s + l.credit, 0));
    const diff = roundMoney(debit - credit);
    if (diff > 0) {
      lines.push(line(openingId, 0, diff, { description: "Opening equity plug" }));
    } else if (diff < 0) {
      lines.push(line(openingId, Math.abs(diff), 0, { description: "Opening equity plug" }));
    }

    if (!lines.length) return null;

    return this.postJournal({
      prefix: "JV",
      entryType: JOURNAL_TYPES.OPENING,
      sourceType: "opening",
      sourceId: 0,
      entryDate,
      description: "Opening balances from POS snapshot",
      lines,
    });
  }

  async getAccount(id) {
    return queryOne("SELECT * FROM accounts WHERE id = $1", [Number(id)]);
  }

  async getAccountByCode(code) {
    return queryOne("SELECT * FROM accounts WHERE code = $1", [code]);
  }

  async accountId(code) {
    const row = await this.getAccountByCode(code);
    if (!row) throw new Error(`Account ${code} is missing. Open Settings → Accounting and finish setup.`);
    return row.id;
  }

  async listAccounts({
    type = null,
    activeOnly = true,
    subtype = null,
    search = "",
    groupId = null,
    active = null,
    page = null,
    limit = null,
  } = {}) {
    let sql = `
      SELECT a.*, g.name AS group_name, g.code AS group_code
      FROM accounts a
      JOIN account_groups g ON g.id = a.group_id
      WHERE 1=1
    `;
    const params = [];
    if (active === "hidden") sql += " AND a.is_active = 0";
    else if (active === "all") { /* include every account */ }
    else if (activeOnly || active === "active") sql += " AND a.is_active = 1";
    if (type) {
      params.push(type);
      sql += ` AND a.type = $${params.length}`;
    }
    if (subtype) {
      params.push(subtype);
      sql += ` AND a.subtype = $${params.length}`;
    }
    if (groupId) {
      params.push(Number(groupId));
      sql += ` AND a.group_id = $${params.length}`;
    }
    if (String(search || "").trim()) {
      params.push(`%${String(search).trim()}%`);
      sql += ` AND (a.name LIKE $${params.length} OR a.name_ar LIKE $${params.length} OR a.code LIKE $${params.length})`;
    }
    sql += " ORDER BY a.code ASC";
    if (page == null || limit == null) return query(sql, params);

    const countSql = `SELECT COUNT(*) AS total FROM accounts a JOIN account_groups g ON g.id = a.group_id WHERE 1=1${sql.split("WHERE 1=1")[1]?.replace(/ORDER BY[\s\S]*$/, "") || ""}`;
    const countRow = await queryOne(countSql, params);
    const offset = (Math.max(1, page) - 1) * limit;
    params.push(limit, offset);
    const items = await query(`${sql} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return { items, total: Number(countRow?.total || 0), page, limit };
  }

  async listGroups() {
    return query("SELECT * FROM account_groups ORDER BY sort_order, code");
  }

  async saveAccount(data) {
    const code = String(data.code || "").trim();
    const name = String(data.name || "").trim();
    if (!code || !name) throw new Error("Account code and name are required");
    const group = await queryOne("SELECT * FROM account_groups WHERE id = $1", [Number(data.group_id)]);
    if (!group) throw new Error("Select an account group");

    if (data.id) {
      await execute(
        `UPDATE accounts SET code = $1, name = $2, name_ar = $3, group_id = $4, type = $5,
         subtype = $6, normal_balance = $7, is_active = $8, notes = $9, updated_at = datetime('now')
         WHERE id = $10`,
        [
          code,
          name,
          data.name_ar || null,
          group.id,
          data.type || group.type,
          data.subtype || null,
          data.normal_balance || (group.type === "liability" || group.type === "equity" || group.type === "revenue" ? "credit" : "debit"),
          data.is_active === 0 || data.is_active === false ? 0 : 1,
          data.notes || null,
          Number(data.id),
        ]
      );
      return this.getAccount(data.id);
    }

    const id = await insert(
      `INSERT INTO accounts
       (group_id, code, name, name_ar, type, subtype, normal_balance, is_system, is_active, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 1, $8)`,
      [
        group.id,
        code,
        name,
        data.name_ar || null,
        data.type || group.type,
        data.subtype || null,
        data.normal_balance || (group.type === "liability" || group.type === "equity" || group.type === "revenue" ? "credit" : "debit"),
        data.notes || null,
      ]
    );
    return this.getAccount(id);
  }

  async getCurrentPeriod() {
    return queryOne("SELECT * FROM fiscal_periods WHERE is_current = 1 ORDER BY id DESC LIMIT 1");
  }

  async listPeriods() {
    return query("SELECT * FROM fiscal_periods ORDER BY start_date DESC");
  }

  async requireOpenPeriod(entryDate) {
    const date = dateOnly(entryDate);
    const period = await queryOne(
      `SELECT * FROM fiscal_periods
       WHERE date(start_date) <= date($1) AND date(end_date) >= date($1)
       ORDER BY is_current DESC, id DESC LIMIT 1`,
      [date]
    );
    if (!period) {
      throw new Error(`No fiscal period covers ${date}. Open Settings → Accounting to set the fiscal year.`);
    }
    if (period.status === "closed") {
      throw new Error(`Fiscal period ${period.name} is closed. Reversals in a new period are required.`);
    }
    return period;
  }

  async closePeriod(periodId) {
    const period = await queryOne("SELECT * FROM fiscal_periods WHERE id = $1", [Number(periodId)]);
    if (!period) throw new Error("Period not found");
    if (period.status === "closed") return period;

    const user = currentUser();
    await execute(
      `UPDATE fiscal_periods SET status = 'closed', is_current = 0, closed_at = datetime('now'), closed_by = $1
       WHERE id = $2`,
      [user?.id || null, period.id]
    );
    await this.audit("close_period", "fiscal_period", period.id, period.name);
    return queryOne("SELECT * FROM fiscal_periods WHERE id = $1", [period.id]);
  }

  async nextReference(prefix) {
    const key = String(prefix || "JV").toUpperCase();
    await execute(
      `INSERT INTO accounting_sequences (name, last_value) VALUES ($1, 0)
       ON CONFLICT(name) DO NOTHING`,
      [key]
    );
    await execute(
      "UPDATE accounting_sequences SET last_value = last_value + 1 WHERE name = $1",
      [key]
    );
    const row = await queryOne("SELECT last_value FROM accounting_sequences WHERE name = $1", [key]);
    return formatAccountingRef(key, row?.last_value || 1);
  }

  async findPostedSource(sourceType, sourceId) {
    if (sourceType == null || sourceId == null) return null;
    return queryOne(
      `SELECT * FROM journal_entries
       WHERE source_type = $1 AND source_id = $2 AND status = 'posted'
         AND entry_type != 'reversal'
       ORDER BY id DESC LIMIT 1`,
      [sourceType, Number(sourceId)]
    );
  }

  normalizeLines(rawLines) {
    const lines = (rawLines || []).filter(Boolean).map((item) => ({
      account_id: Number(item.account_id),
      debit: roundMoney(item.debit),
      credit: roundMoney(item.credit),
      description: item.description || null,
      partner_id: item.partner_id || null,
      customer_id: item.customer_id || null,
      supplier_id: item.supplier_id || null,
    })).filter((item) => item.account_id && (item.debit > 0 || item.credit > 0));

    if (lines.length < 2) throw new Error("A journal entry needs at least two lines");

    let debit = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
    let credit = roundMoney(lines.reduce((s, l) => s + l.credit, 0));
    const diff = roundMoney(debit - credit);
    if (Math.abs(diff) > 0 && Math.abs(diff) < 0.05) {
      const last = lines[lines.length - 1];
      if (diff > 0) last.credit = roundMoney(last.credit + diff);
      else last.debit = roundMoney(last.debit + Math.abs(diff));
      debit = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
      credit = roundMoney(lines.reduce((s, l) => s + l.credit, 0));
    }
    if (debit !== credit) {
      throw new Error(`Journal is not balanced (debit ${debit.toFixed(2)} / credit ${credit.toFixed(2)})`);
    }
    return { lines, debit, credit };
  }

  async postJournal({
    prefix = "JV",
    entryType = JOURNAL_TYPES.MANUAL,
    sourceType = null,
    sourceId = null,
    entryDate,
    description,
    lines: rawLines,
    allowDuplicate = false,
  }) {
    if (!(await this.isEnabled()) && entryType !== JOURNAL_TYPES.OPENING) return null;

    if (!allowDuplicate && sourceType != null && sourceId != null) {
      const existing = await this.findPostedSource(sourceType, sourceId);
      if (existing) return this.getJournal(existing.id);
    }

    const date = dateOnly(entryDate) || await this.businessDate();
    const period = await this.requireOpenPeriod(date);
    const { lines } = this.normalizeLines(rawLines);
    const user = currentUser();
    const reference = await this.nextReference(prefix);

    const id = await runInTransaction(async (tx) => {
      const journalId = await txInsert(
        tx,
        `INSERT INTO journal_entries
         (reference, entry_type, source_type, source_id, fiscal_period_id, entry_date,
          description, status, created_by, created_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'posted', $8, $9)`,
        [
          reference,
          entryType,
          sourceType,
          sourceId,
          period.id,
          date,
          description || null,
          user?.id || null,
          user?.full_name || user?.username || null,
        ]
      );
      for (const item of lines) {
        await tx.execute(
          `INSERT INTO journal_lines
           (journal_entry_id, account_id, debit, credit, description, partner_id, customer_id, supplier_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            journalId,
            item.account_id,
            item.debit,
            item.credit,
            item.description,
            item.partner_id,
            item.customer_id,
            item.supplier_id,
          ]
        );
      }
      await tx.execute(
        `INSERT INTO accounting_audit_log
         (user_id, user_name, action, entity_type, entity_id, reference, new_value)
         VALUES ($1, $2, 'post', 'journal_entry', $3, $4, $5)`,
        [
          user?.id || null,
          user?.full_name || user?.username || null,
          journalId,
          reference,
          description || entryType,
        ]
      );
      return journalId;
    });

    return this.getJournal(id);
  }

  async reverseJournal(journalId, reason = "Reversal") {
    const original = await this.getJournal(journalId);
    if (!original) throw new Error("Journal entry not found");
    if (original.status === "reversed") return original;
    if (original.reversed_by_id) {
      return this.getJournal(original.reversed_by_id);
    }

    const reversal = await this.postJournal({
      prefix: "JV",
      entryType: JOURNAL_TYPES.REVERSAL,
      sourceType: original.source_type,
      sourceId: original.source_id,
      entryDate: dateOnly(original.entry_date) || (await this.businessDate()),
      description: `${reason} of ${original.reference}`,
      allowDuplicate: true,
      lines: original.lines.map((item) => ({
        account_id: item.account_id,
        debit: item.credit,
        credit: item.debit,
        description: item.description,
        partner_id: item.partner_id,
        customer_id: item.customer_id,
        supplier_id: item.supplier_id,
      })),
    });

    await execute(
      "UPDATE journal_entries SET status = 'reversed', reversed_by_id = $1 WHERE id = $2",
      [reversal.id, original.id]
    );
    await execute(
      "UPDATE journal_entries SET reverses_id = $1 WHERE id = $2",
      [original.id, reversal.id]
    );
    await this.audit("reverse", "journal_entry", original.id, original.reference, reason);
    return this.getJournal(reversal.id);
  }

  async reversePostedJournals({ sourceType, sourceId, reason = "Reversal" }) {
    if (!(await this.isEnabled())) return [];
    const rows = await query(
      `SELECT id FROM journal_entries
       WHERE source_type = $1 AND source_id = $2 AND status = 'posted'
         AND (entry_type IS NULL OR entry_type != $3)
       ORDER BY id`,
      [sourceType, Number(sourceId), JOURNAL_TYPES.REVERSAL]
    );
    const reversed = [];
    for (const row of rows) {
      reversed.push(await this.reverseJournal(row.id, reason));
    }
    return reversed;
  }

  async reverseSaleBooks(saleId, reason = "Sale reversed") {
    const numId = Number(saleId);
    const paymentRows = await query("SELECT id FROM payments WHERE sale_id = $1", [numId]).catch(() => []);
    for (const row of paymentRows || []) {
      await this.reversePostedJournals({
        sourceType: "sale_payment",
        sourceId: row.id,
        reason,
      });
    }
    const returnRows = await query("SELECT id FROM sale_returns WHERE sale_id = $1", [numId]).catch(() => []);
    for (const row of returnRows || []) {
      await this.reversePostedJournals({
        sourceType: "sale_return",
        sourceId: row.id,
        reason,
      });
    }
    await this.reversePostedJournals({ sourceType: "sale", sourceId: numId, reason });
  }

  async restatedSaleJournal(sale, reason = "Invoice updated") {
    if (!(await this.isEnabled()) || !sale) return null;
    const paymentRows = await query("SELECT id FROM payments WHERE sale_id = $1", [sale.id]).catch(() => []);
    for (const row of paymentRows || []) {
      await this.reversePostedJournals({
        sourceType: "sale_payment",
        sourceId: row.id,
        reason,
      });
    }
    await this.reversePostedJournals({ sourceType: "sale", sourceId: sale.id, reason });
    return this.postSale(sale);
  }

  async getJournal(id) {
    const entry = await queryOne(
      `SELECT je.*, fp.name AS period_name
       FROM journal_entries je
       LEFT JOIN fiscal_periods fp ON fp.id = je.fiscal_period_id
       WHERE je.id = $1`,
      [Number(id)]
    );
    if (!entry) return null;
    const lines = await query(
      `SELECT jl.*, a.code AS account_code, a.name AS account_name, a.normal_balance
       FROM journal_lines jl
       JOIN accounts a ON a.id = jl.account_id
       WHERE jl.journal_entry_id = $1
       ORDER BY jl.id`,
      [entry.id]
    );
    return { ...entry, lines };
  }

  async listJournals({ from = null, to = null, type = null, status = null, search = "", page = 1, limit = 50 } = {}) {
    let sql = "SELECT * FROM journal_entries WHERE 1=1";
    const params = [];
    if (from) {
      params.push(from);
      sql += ` AND date(entry_date) >= date($${params.length})`;
    }
    if (to) {
      params.push(to);
      sql += ` AND date(entry_date) <= date($${params.length})`;
    }
    if (type && type !== "all") {
      params.push(type);
      sql += ` AND entry_type = $${params.length}`;
    }
    if (status && status !== "all") {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (reference LIKE $${params.length} OR description LIKE $${params.length})`;
    }
    const countRow = await queryOne(sql.replace("SELECT *", "SELECT COUNT(*) AS total"), params);
    sql += " ORDER BY entry_date DESC, id DESC";
    params.push(limit, (page - 1) * limit);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const items = await query(sql, params);
    return { items, total: Number(countRow?.total || 0), page, limit };
  }

  async getLedger({
    accountId = null,
    customerId = null,
    supplierId = null,
    partnerId = null,
    from = null,
    to = null,
    type = null,
    search = "",
    page = 1,
    limit = null,
    includeReversed = false,
  } = {}) {
    const statusSql = includeReversed
      ? "je.status IN ('posted', 'reversed')"
      : "je.status = 'posted'";
    const selectSql = `
      SELECT jl.*, je.reference, je.entry_date, je.entry_type, je.description AS entry_description,
             je.source_type, je.source_id, a.code AS account_code, a.name AS account_name,
             a.normal_balance
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE ${statusSql}
    `;

    const identity = [];
    const identityParams = [];
    const pushIdentity = (sql, value) => {
      identityParams.push(value);
      identity.push(sql.replace("?", `$${identityParams.length}`));
    };
    if (accountId) pushIdentity(" AND jl.account_id = ?", Number(accountId));
    if (customerId) pushIdentity(" AND jl.customer_id = ?", Number(customerId));
    if (supplierId) pushIdentity(" AND jl.supplier_id = ?", Number(supplierId));
    if (partnerId) pushIdentity(" AND jl.partner_id = ?", Number(partnerId));
    const identitySql = identity.join("");

    let opening = 0;
    let normalBalance = "debit";
    const fromDate = dateOnly(from);
    if (fromDate) {
      const prior = await query(
        `${selectSql}${identitySql} AND date(je.entry_date) < date($${identityParams.length + 1})
         ORDER BY je.entry_date ASC, je.id ASC, jl.id ASC`,
        [...identityParams, fromDate]
      );
      for (const row of prior) {
        normalBalance = row.normal_balance || normalBalance;
        opening = roundMoney(opening + signedLineDelta(row));
      }
    }

    const periodParams = [...identityParams];
    let periodSql = `${selectSql}${identitySql}`;
    if (fromDate) {
      periodParams.push(fromDate);
      periodSql += ` AND date(je.entry_date) >= date($${periodParams.length})`;
    }
    if (to) {
      periodParams.push(dateOnly(to));
      periodSql += ` AND date(je.entry_date) <= date($${periodParams.length})`;
    }
    if (type && type !== "all") {
      periodParams.push(type);
      periodSql += ` AND je.entry_type = $${periodParams.length}`;
    }
    if (String(search || "").trim()) {
      periodParams.push(`%${String(search).trim()}%`);
      periodSql += ` AND (je.reference LIKE $${periodParams.length} OR je.description LIKE $${periodParams.length} OR jl.description LIKE $${periodParams.length})`;
    }
    periodSql += " ORDER BY je.entry_date ASC, je.id ASC, jl.id ASC";
    const rows = await query(periodSql, periodParams);

    let running = opening;
    const chronological = [];
    if (fromDate && Math.abs(opening) >= 0.005) {
      chronological.push({
        id: `opening-${accountId || partnerId || customerId || supplierId || "all"}`,
        entry_date: fromDate,
        entry_type: "opening",
        description: "Already in this account",
        entry_description: "Already in this account",
        debit: 0,
        credit: 0,
        change: 0,
        balance: opening,
        is_opening: true,
        normal_balance: rows[0]?.normal_balance || normalBalance,
      });
    }
    for (const row of rows) {
      const change = signedLineDelta(row);
      running = roundMoney(running + change);
      chronological.push({ ...row, change, balance: running, is_opening: false });
    }

    const newestFirst = [...chronological].reverse();
    const total = newestFirst.length;
    const start = Math.max(0, (Math.max(1, page) - 1) * Number(limit || 0));

    return {
      items: limit ? newestFirst.slice(start, start + limit) : chronological,
      total,
      page,
      limit,
      totals: {
        opening,
        periodChange: roundMoney(running - opening),
        debit: roundMoney(rows.reduce((s, r) => s + Number(r.debit), 0)),
        credit: roundMoney(rows.reduce((s, r) => s + Number(r.credit), 0)),
        balance: running,
      },
    };
  }

  async accountBalances({ asOf = null, from = null } = {}) {
    const params = [];
    let dateSql = "";
    if (asOf) {
      params.push(asOf);
      dateSql += ` AND date(je.entry_date) <= date($${params.length})`;
    }
    if (from) {
      params.push(from);
      dateSql += ` AND date(je.entry_date) >= date($${params.length})`;
    }
    const rows = await query(
      `SELECT a.id, a.code, a.name, a.name_ar, a.type, a.subtype, a.normal_balance, g.name AS group_name,
              COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.debit ELSE 0 END), 0) AS debit,
              COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.credit ELSE 0 END), 0) AS credit
       FROM accounts a
       JOIN account_groups g ON g.id = a.group_id
       LEFT JOIN journal_lines jl ON jl.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted' ${dateSql}
       WHERE a.is_active = 1
       GROUP BY a.id
       ORDER BY a.code`,
      params
    );
    return rows.map((row) => ({
      ...row,
      debit: roundMoney(row.debit),
      credit: roundMoney(row.credit),
      balance: signedBalance(row, row.debit, row.credit),
    }));
  }

  async trialBalance({ from, to }) {
    await this.repairMispostedInventoryRevaluations().catch(() => {});
    const openingRows = from
      ? await this.accountBalances({ asOf: this.dayBefore(from) })
      : await this.accountBalances({ asOf: this.dayBefore(from || "1900-01-01") });
    const periodRows = await this.accountBalances({ from, asOf: to });
    const closingRows = await this.accountBalances({ asOf: to });

    const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const openingMap = byId(openingRows);
    const periodMap = byId(periodRows);

    const items = closingRows.map((row) => {
      const opening = openingMap[row.id]?.balance || 0;
      const period = periodMap[row.id] || { debit: 0, credit: 0, balance: 0 };
      const closing = row.balance;
      return {
        ...row,
        opening,
        period_debit: period.debit,
        period_credit: period.credit,
        closing,
        tb_debit: closing >= 0 && row.normal_balance === "debit" ? closing : closing < 0 && row.normal_balance === "credit" ? Math.abs(closing) : 0,
        tb_credit: closing >= 0 && row.normal_balance === "credit" ? closing : closing < 0 && row.normal_balance === "debit" ? Math.abs(closing) : 0,
      };
    });

    const totalDebit = roundMoney(items.reduce((s, r) => s + r.tb_debit, 0));
    const totalCredit = roundMoney(items.reduce((s, r) => s + r.tb_credit, 0));
    return { items, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
  }

  dayBefore(isoDate) {
    const d = new Date(`${dateOnly(isoDate)}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async profitAndLoss({ from, to }) {
    const profit = await getProfitInRange(from, to);
    const breakdown = await getExpenseBreakdownInRange(from, to);
    const categoryRows = await query("SELECT code, name FROM expense_categories").catch(() => []);
    const categoryNames = Object.fromEntries((categoryRows || []).map((row) => [row.code, row.name]));
    const labelFor = (id) => categoryNames[id] || EXPENSE_CATEGORIES.find((c) => c.id === id)?.label || id;
    const operatingExpenses = breakdown.map((row) => ({
      id: row.id,
      name: labelFor(row.id),
      balance: roundMoney(row.balance),
    }));

    return {
      sales: roundMoney(profit.sales),
      otherIncome: roundMoney(profit.otherIncome),
      salesReturns: roundMoney(profit.salesReturns),
      discounts: roundMoney(profit.discounts),
      netRevenue: roundMoney(profit.netRevenue),
      cogs: roundMoney(profit.cogs),
      grossProfit: roundMoney(profit.grossProfit),
      operatingExpenses,
      expenses: roundMoney(profit.expenses),
      netProfit: roundMoney(profit.netProfit),
      revenueTotal: roundMoney(profit.netRevenue),
    };
  }

  /** Books P&L from posted journals (not the POS cash summary). */
  async ledgerProfitAndLoss({ from, to }) {
    await this.repairMispostedInventoryRevaluations().catch(() => {});
    const rows = await this.accountBalances({ from, asOf: to });
    const bal = (code) => rows.find((r) => r.code === code)?.balance || 0;
    const sales = bal(ACCOUNT_CODES.SALES);
    const otherIncome = bal(ACCOUNT_CODES.OTHER_INCOME);
    const salesReturns = bal(ACCOUNT_CODES.SALES_RETURNS);
    const discounts = bal(ACCOUNT_CODES.SALES_DISCOUNTS);
    const cogs = bal(ACCOUNT_CODES.COGS);
    const inventoryAdjustments = bal(ACCOUNT_CODES.INVENTORY_ADJUST);
    const netRevenue = roundMoney(sales + otherIncome - salesReturns - discounts);
    const grossProfit = roundMoney(netRevenue - cogs);
    const operatingExpenses = rows
      .filter(
        (r) =>
          r.type === ACCOUNT_TYPES.EXPENSE &&
          r.code !== ACCOUNT_CODES.COGS &&
          r.code !== ACCOUNT_CODES.INVENTORY_ADJUST &&
          r.balance
      )
      .map((r) => ({ id: r.id, code: r.code, name: r.name, balance: r.balance }));
    const expenses = roundMoney(
      operatingExpenses.reduce((s, r) => s + r.balance, 0) + inventoryAdjustments
    );
    const netProfit = roundMoney(grossProfit - expenses);
    return {
      sales,
      otherIncome,
      salesReturns,
      discounts,
      netRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      inventoryAdjustments,
      expenses,
      netProfit,
      revenueTotal: netRevenue,
    };
  }

  async balanceSheet({ asOf }) {
    await this.repairMispostedInventoryRevaluations().catch(() => {});
    const rows = await this.accountBalances({ asOf });
    const pl = await this.ledgerProfitAndLoss({ from: "1900-01-01", to: asOf });
    const assets = rows.filter((r) => r.type === ACCOUNT_TYPES.ASSET);
    const liabilities = rows.filter((r) => r.type === ACCOUNT_TYPES.LIABILITY);
    const equity = rows
      .filter((r) => r.type === ACCOUNT_TYPES.EQUITY && r.code !== ACCOUNT_CODES.CURRENT_PL)
      .map((r) => ({
        ...r,
        balance: r.normal_balance === "credit" ? r.balance : roundMoney(-r.balance),
      }));
    const assetTotal = roundMoney(assets.reduce((s, r) => s + r.balance, 0));
    const liabilityTotal = roundMoney(liabilities.reduce((s, r) => s + r.balance, 0));
    const equityTotal = roundMoney(equity.reduce((s, r) => s + r.balance, 0) + pl.netProfit);
    return {
      assets,
      liabilities,
      equity,
      netProfit: pl.netProfit,
      assetTotal,
      liabilityTotal,
      equityTotal,
      balanced: assetTotal === roundMoney(liabilityTotal + equityTotal),
    };
  }

  async cashFlow({ from, to }) {
    const cashAccounts = await this.listAccounts({ subtype: "cash" });
    const bankAccounts = await this.listAccounts({ subtype: "bank" });
    const ids = [...cashAccounts, ...bankAccounts].map((a) => a.id);
    if (!ids.length) {
      return { operating: 0, investing: 0, financing: 0, inflow: 0, outflow: 0, opening: 0, closing: 0 };
    }

    const asOf = to || (await this.businessDate());
    const opening = from ? await this.cashTotal(ids, this.dayBefore(from)) : 0;
    const closing = await this.cashTotal(ids, asOf);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const params = [...ids];
    let dateSql = "";
    if (from) {
      params.push(from);
      dateSql += ` AND date(je.entry_date) >= date($${params.length})`;
    }
    params.push(asOf);
    dateSql += ` AND date(je.entry_date) <= date($${params.length})`;
    const movements = await query(
      `SELECT je.entry_type, SUM(jl.debit) AS debit, SUM(jl.credit) AS credit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.status = 'posted'
         AND jl.account_id IN (${placeholders})
         ${dateSql}
       GROUP BY je.entry_type`,
      params
    );

    const classify = { operating: 0, investing: 0, financing: 0 };
    for (const row of movements) {
      const net = roundMoney(row.debit - row.credit);
      if (["partner", "opening"].includes(row.entry_type)) classify.financing = roundMoney(classify.financing + net);
      else if (row.entry_type === "inventory" && net < 0) classify.investing = roundMoney(classify.investing + net);
      else classify.operating = roundMoney(classify.operating + net);
    }

    const periodNet = roundMoney(closing - opening);
    return {
      ...classify,
      inflow: roundMoney(Math.max(0, periodNet)),
      outflow: roundMoney(Math.max(0, -periodNet)),
      opening,
      closing,
    };
  }

  async cashTotal(accountIds, asOf) {
    if (!accountIds.length) return 0;
    const placeholders = accountIds.map((_, i) => `$${i + 1}`).join(",");
    const row = await queryOne(
      `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS value
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.status = 'posted'
         AND jl.account_id IN (${placeholders})
         AND date(je.entry_date) <= date($${accountIds.length + 1})`,
      [...accountIds, asOf]
    );
    return roundMoney(row?.value);
  }

  async dashboard({ from, to }) {
    const asOf = dateOnly(to) || await this.businessDate();
    const stock = await this.getLiveInventoryValue();
    const [pl, cashAccounts, bankAccounts, ar, ap, inventory, partners] = await Promise.all([
      this.ledgerProfitAndLoss({ from, to }),
      this.listAccounts({ subtype: "cash" }),
      this.listAccounts({ subtype: "bank" }),
      this.getAccountByCode(ACCOUNT_CODES.AR),
      this.getAccountByCode(ACCOUNT_CODES.AP),
      this.getAccountByCode(ACCOUNT_CODES.INVENTORY),
      queryOne(
        `SELECT COALESCE(SUM(jl.credit - jl.debit), 0) AS value
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         JOIN accounts a ON a.id = jl.account_id
         WHERE je.status = 'posted' AND a.subtype = 'capital' AND a.partner_id IS NOT NULL`
      ),
    ]);
    const cashIds = cashAccounts.map((a) => a.id);
    const bankIds = bankAccounts.map((a) => a.id);
    const balances = await this.accountBalances({ asOf });
    const bal = (id) => balances.find((r) => r.id === id)?.balance || 0;

    return {
      sales: pl.netRevenue,
      purchases: roundMoney(
        (await queryOne(
          `SELECT COALESCE(SUM(jl.debit), 0) AS value
           FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id
           WHERE je.status = 'posted' AND je.entry_type = 'purchase'
             AND date(je.entry_date) >= date($1) AND date(je.entry_date) <= date($2)
             AND jl.account_id = $3`,
          [from, to, inventory?.id || 0]
        ))?.value
      ),
      grossProfit: pl.grossProfit,
      netProfit: pl.netProfit,
      expenses: pl.expenses,
      cash: await this.cashTotal(cashIds, asOf),
      bank: await this.cashTotal(bankIds, asOf),
      inventory: stock.purchaseTotal,
      inventorySelling: stock.sellingTotal,
      inventoryQty: stock.quantity,
      inventoryProductCount: stock.productCount,
      receivable: bal(ar?.id),
      payable: bal(ap?.id),
      partnerCapital: roundMoney(partners?.value),
    };
  }

  async allocateAccountCode(preferred) {
    let code = String(preferred);
    let seq = Number(preferred);
    if (!Number.isFinite(seq) || seq <= 0) seq = Date.now() % 100000;
    while (await this.getAccountByCode(code)) {
      seq += 1;
      code = String(seq);
    }
    return code;
  }

  async createPartner({
    name,
    phone,
    notes,
    ownership_percent = 0,
    profit_share_percent = 0,
    initial_capital = 0,
    cash_account_id = null,
    entry_date,
    skipCapitalJournal = false,
    shares_manual = false,
  }) {
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new Error("Enter the partner’s name");

    await this.ensureSchema();
    await this.seedChartOfAccounts();

    const capitalControl = await this.getAccountByCode(ACCOUNT_CODES.PARTNER_CAPITAL);
    const drawingsControl = await this.getAccountByCode(ACCOUNT_CODES.PARTNER_DRAWINGS);
    if (!capitalControl?.group_id || !drawingsControl?.group_id) {
      throw new Error("Partner accounts are missing. Open Books once, then add the partner again.");
    }

    const existing = await queryOne(
      "SELECT id FROM partners WHERE lower(trim(name)) = $1 AND is_active = 1",
      [trimmed.toLowerCase()]
    );
    if (existing) {
      throw new Error(`Partner "${trimmed}" is already in the list`);
    }

    const ownership = Number(ownership_percent) || 0;
    const profitShare = Number(profit_share_percent) || ownership;
    const manual = Boolean(shares_manual);
    const id = await insert(
      `INSERT INTO partners (name, phone, notes, ownership_percent, profit_share_percent, is_active, shares_manual)
       VALUES ($1, $2, $3, $4, $5, 1, $6)`,
      [trimmed, phone || null, notes || null, ownership, profitShare, manual ? 1 : 0]
    );

    const capCode = await this.allocateAccountCode(`31${String(10 + Number(id)).padStart(2, "0")}`);
    const drwCode = await this.allocateAccountCode(`32${String(10 + Number(id)).padStart(2, "0")}`);

    const capitalId = await insert(
      `INSERT INTO accounts
       (group_id, code, name, type, subtype, normal_balance, is_system, is_active, partner_id, linked_type, linked_id)
       VALUES ($1, $2, $3, 'equity', 'capital', 'credit', 0, 1, $4, 'partner', $4)`,
      [capitalControl.group_id, capCode, `${trimmed} — capital`, id]
    );
    const drawingsId = await insert(
      `INSERT INTO accounts
       (group_id, code, name, type, subtype, normal_balance, is_system, is_active, partner_id, linked_type, linked_id)
       VALUES ($1, $2, $3, 'equity', 'drawings', 'debit', 0, 1, $4, 'partner', $4)`,
      [drawingsControl.group_id, drwCode, `${trimmed} — drawings`, id]
    );
    await execute(
      "UPDATE partners SET capital_account_id = $1, drawings_account_id = $2 WHERE id = $3",
      [capitalId, drawingsId, id]
    );

    const capital = roundMoney(initial_capital);
    if (capital > 0 && !skipCapitalJournal && (await this.isEnabled())) {
      await this.recordPartnerTransaction({
        partnerId: id,
        type: "initial_capital",
        amount: capital,
        cashAccountId: cash_account_id,
        entryDate: entry_date,
        notes: "Initial capital",
      });
    } else {
      await this.syncOwnershipFromInvested().catch(() => {});
    }

    return this.getPartner(id);
  }

  async getPartner(id) {
    const partner = await queryOne("SELECT * FROM partners WHERE id = $1", [Number(id)]);
    if (!partner) return null;
    const invested = roundMoney(
      (
        await queryOne(
          `SELECT COALESCE(SUM(amount), 0) AS value FROM partner_transactions
           WHERE partner_id = $1 AND type IN ('initial_capital', 'additional_capital')`,
          [partner.id]
        )
      )?.value
    );
    const withdrawn = roundMoney(
      (
        await queryOne(
          `SELECT COALESCE(SUM(amount), 0) AS value FROM partner_transactions
           WHERE partner_id = $1 AND type IN ('withdrawal', 'profit_distribution', 'repayment_to_partner')`,
          [partner.id]
        )
      )?.value
    );
    return {
      ...partner,
      total_invested: invested,
      total_withdrawn: withdrawn,
      current_capital: roundMoney(invested - withdrawn),
      ledger: { items: [], totals: {} },
    };
  }

  async listPartners() {
    await this._repairDuplicateOpeningCash().catch(() => {});
    await this._backfillPartnerOwnershipShares().catch(() => {});
    await this.syncOwnershipFromInvested().catch(() => {});
    const rows = await query("SELECT * FROM partners ORDER BY is_active DESC, name ASC");
    const result = [];
    for (const row of rows) {
      result.push(await this.getPartner(row.id));
    }
    return result;
  }

  /** Each partner's slice of sales, stock, cash, and profit. */
  async getPartnerShareReport({ partners = null } = {}) {
    const list = (partners || (await this.listPartners())).filter((p) => p.is_active !== 0);
    const asOf = await this.businessDate();
    const [pl, stock, cashAccounts, bankAccounts] = await Promise.all([
      getProfitInRange("2000-01-01", asOf),
      this.getLiveInventoryValue(),
      this.listAccounts({ subtype: "cash" }),
      this.listAccounts({ subtype: "bank" }),
    ]);
    const cash = await this.cashTotal(cashAccounts.map((a) => a.id), asOf);
    const bank = await this.cashTotal(bankAccounts.map((a) => a.id), asOf);
    const shop = {
      sales: pl.netRevenue,
      stockCost: stock.purchaseTotal,
      stockSelling: stock.sellingTotal,
      stockQty: stock.quantity,
      cash: roundMoney(cash + bank),
      profit: pl.netProfit,
    };
    const slice = (percent, amount) => roundMoney(((Number(percent) || 0) / 100) * (Number(amount) || 0));
    const rows = list.map((partner) => {
      const own = Number(partner.ownership_percent) || 0;
      const profitPct = Number(partner.profit_share_percent) || own;
      const sharePct = own || profitPct;
      return {
        id: partner.id,
        name: partner.name,
        ownership_percent: own,
        profit_share_percent: profitPct,
        salesShare: slice(sharePct, shop.sales),
        stockCostShare: slice(sharePct, shop.stockCost),
        stockSellingShare: slice(sharePct, shop.stockSelling),
        cashShare: slice(sharePct, shop.cash),
        profitShare: slice(sharePct, shop.profit),
      };
    });
    return { shop, rows };
  }

  async updatePartner(id, data) {
    await execute(
      `UPDATE partners SET name = $1, phone = $2, notes = $3, ownership_percent = $4,
       profit_share_percent = $5, is_active = $6, updated_at = datetime('now')
       WHERE id = $7`,
      [
        String(data.name || "").trim(),
        data.phone || null,
        data.notes || null,
        Number(data.ownership_percent) || 0,
        Number(data.profit_share_percent) || 0,
        data.is_active === 0 || data.is_active === false ? 0 : 1,
        Number(id),
      ]
    );
    return this.getPartner(id);
  }

  async recordPartnerTransaction({
    partnerId,
    type,
    amount,
    cashAccountId,
    entryDate,
    notes,
    expenseAccountId = null,
  }) {
    const partner = await queryOne("SELECT * FROM partners WHERE id = $1", [Number(partnerId)]);
    if (!partner) throw new Error("Partner not found");
    const value = roundMoney(amount);
    if (value <= 0) throw new Error("Amount must be greater than zero");
    if (!partner.capital_account_id || !partner.drawings_account_id) {
      throw new Error("This partner is missing capital accounts. Delete and add them again.");
    }

    const cashId = Number(cashAccountId) || (await this.defaultCashId());
    if (!cashId) throw new Error("Choose a cash or bank account");
    const date = dateOnly(entryDate) || await this.businessDate();
    const lines = [];
    let prefix = "CAP";

    if (type === "initial_capital" || type === "additional_capital") {
      lines.push(line(cashId, value, 0, { partner_id: partner.id, description: type }));
      lines.push(line(partner.capital_account_id, 0, value, { partner_id: partner.id, description: type }));
    } else if (type === "withdrawal" || type === "profit_distribution") {
      prefix = type === "profit_distribution" ? "CAP" : "CAP";
      lines.push(line(partner.drawings_account_id, value, 0, { partner_id: partner.id, description: type }));
      lines.push(line(cashId, 0, value, { partner_id: partner.id, description: type }));
    } else if (type === "loan_to_business") {
      const loanId = await this.accountId(ACCOUNT_CODES.PARTNER_LOANS);
      lines.push(line(cashId, value, 0, { partner_id: partner.id, description: type }));
      lines.push(line(loanId, 0, value, { partner_id: partner.id, description: type }));
    } else if (type === "repayment_to_partner") {
      const loanId = await this.accountId(ACCOUNT_CODES.PARTNER_LOANS);
      lines.push(line(loanId, value, 0, { partner_id: partner.id, description: type }));
      lines.push(line(cashId, 0, value, { partner_id: partner.id, description: type }));
    } else if (type === "expense_paid_by_partner") {
      const expId = expenseAccountId || (await this.accountId(ACCOUNT_CODES.OTHER_EXPENSE));
      lines.push(line(expId, value, 0, { partner_id: partner.id, description: type }));
      lines.push(line(partner.capital_account_id, 0, value, { partner_id: partner.id, description: type }));
    } else {
      throw new Error("Unknown partner transaction type");
    }

    const journal = await this.postJournal({
      prefix,
      entryType: JOURNAL_TYPES.PARTNER,
      sourceType: "partner_tx",
      sourceId: Date.now(),
      allowDuplicate: true,
      entryDate: date,
      description: `${partner.name} — ${type.replace(/_/g, " ")}`,
      lines,
    });

    const txId = await insert(
      `INSERT INTO partner_transactions
       (partner_id, type, amount, cash_account_id, journal_entry_id, entry_date, reference, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        partner.id,
        type,
        value,
        cashId,
        journal?.id || null,
        date,
        journal?.reference || null,
        notes || null,
        currentUser()?.id || null,
      ]
    );

    if (journal?.id) {
      await execute("UPDATE journal_entries SET source_id = $1 WHERE id = $2", [txId, journal.id]);
    }

    if (type === "initial_capital" || type === "additional_capital") {
      await this.syncOwnershipFromInvested().catch(() => {});
    }

    return this.getPartner(partner.id);
  }

  /** Ownership and profit share follow invested money unless a partner was given a fixed %. */
  async syncOwnershipFromInvested() {
    await this.ensureSchema();
    const rows = await query(
      `SELECT id, COALESCE(shares_manual, 0) AS shares_manual
       FROM partners WHERE is_active = 1`
    );
    if (!rows.length || rows.some((row) => Number(row.shares_manual) === 1)) return;

    const partners = [];
    for (const row of rows) {
      partners.push(await this.getPartner(row.id));
    }
    const shares = ownershipSharesFromAmounts(partners.map((p) => p.total_invested));
    if (shares.every((n) => n === 0)) return;

    for (let i = 0; i < partners.length; i += 1) {
      const share = shares[i];
      if (
        roundMoney(partners[i].ownership_percent) === share
        && roundMoney(partners[i].profit_share_percent) === share
      ) {
        continue;
      }
      await execute(
        `UPDATE partners
         SET ownership_percent = $1, profit_share_percent = $2, updated_at = datetime('now')
         WHERE id = $3`,
        [share, share, partners[i].id]
      );
    }
  }

  async defaultCashId() {
    const settings = await settingsService.getAll();
    const id = Number(settings[ACCOUNTING_SETTING_KEYS.DEFAULT_CASH_ID] || 0);
    if (id) {
      const existing = await this.getAccount(id);
      if (existing) return existing.id;
    }
    return this.accountId(ACCOUNT_CODES.CASH);
  }

  async defaultBankId() {
    const settings = await settingsService.getAll();
    const id = Number(settings[ACCOUNTING_SETTING_KEYS.DEFAULT_BANK_ID] || 0);
    if (id) {
      const existing = await this.getAccount(id);
      if (existing) return existing.id;
    }
    return this.accountId(ACCOUNT_CODES.BANK);
  }

  async resolveTenderAccount(paymentMethod) {
    const method = String(paymentMethod || "cash").toLowerCase();
    if (isPayLaterMethod(method)) return { kind: "ar", accountId: await this.accountId(ACCOUNT_CODES.AR) };
    if (method === "cash") return { kind: "cash", accountId: await this.defaultCashId() };
    return { kind: "bank", accountId: await this.defaultBankId() };
  }

  async postSale(sale) {
    if (!(await this.isEnabled()) || !sale || sale.status === "held") return null;
    const total = roundMoney(sale.total);
    const vat = roundMoney(sale.vat);
    const discount = roundMoney(sale.discount);
    const subtotal = roundMoney(sale.subtotal);
    const paid = roundMoney(sale.amount_paid);
    const customerId = sale.customer_id || null;
    const date = dateOnly(sale.created_at);

    const salesId = await this.accountId(ACCOUNT_CODES.SALES);
    const vatOutId = await this.accountId(ACCOUNT_CODES.VAT_OUTPUT);
    const discId = await this.accountId(ACCOUNT_CODES.SALES_DISCOUNTS);
    const arId = await this.accountId(ACCOUNT_CODES.AR);
    const cogsId = await this.accountId(ACCOUNT_CODES.COGS);
    const invId = await this.accountId(ACCOUNT_CODES.INVENTORY);
    const tender = await this.resolveTenderAccount(sale.payment_method);

    const unpaid = roundMoney(Math.max(0, total - paid));
    const lines = [];
    if (paid > 0) {
      lines.push(line(tender.accountId, paid, 0, { customer_id: customerId, description: sale.sale_number }));
    }
    if (unpaid > 0) {
      lines.push(line(arId, unpaid, 0, { customer_id: customerId, description: sale.sale_number }));
    }
    if (discount > 0) {
      lines.push(line(discId, discount, 0, { customer_id: customerId, description: "Discount" }));
    }
    if (subtotal > 0) {
      lines.push(line(salesId, 0, subtotal, { customer_id: customerId, description: "Sales" }));
    }
    if (vat > 0) {
      lines.push(line(vatOutId, 0, vat, { customer_id: customerId, description: "Output VAT" }));
    }

    let cogs = 0;
    for (const item of sale.items || []) {
      const unitCost = Number(item.cost_price ?? item.product_cost_price);
      if (Number.isFinite(unitCost) && unitCost > 0) {
        cogs = roundMoney(cogs + unitCost * Number(item.quantity || 0));
        continue;
      }
      const product = await queryOne("SELECT cost_price FROM products WHERE id = $1", [item.product_id]);
      cogs = roundMoney(cogs + Number(product?.cost_price || 0) * Number(item.quantity || 0));
    }
    if (cogs > 0) {
      lines.push(line(cogsId, cogs, 0, { description: "COGS" }));
      lines.push(line(invId, 0, cogs, { description: "Inventory out" }));
    }

    if (lines.filter(Boolean).length < 2) return null;

    return this.postJournal({
      prefix: "SALE",
      entryType: JOURNAL_TYPES.SALE,
      sourceType: "sale",
      sourceId: sale.id,
      entryDate: date,
      description: `Sale ${sale.sale_number}`,
      lines,
    });
  }

  async postSaleReturn(result) {
    if (!(await this.isEnabled()) || !result) return null;
    const sale = result.sale;
    const refund = roundMoney(result.totalRefund);
    if (refund <= 0) return null;
    const date = dateOnly(result.created_at) || (await this.businessDate());
    const vatPortion = sale?.total ? roundMoney(refund * (Number(sale.vat || 0) / Number(sale.total))) : 0;
    const net = roundMoney(refund - vatPortion);

    const retId = await this.accountId(ACCOUNT_CODES.SALES_RETURNS);
    const vatOutId = await this.accountId(ACCOUNT_CODES.VAT_OUTPUT);
    const tender = await this.resolveTenderAccount(sale.payment_method);
    const arId = await this.accountId(ACCOUNT_CODES.AR);
    const creditAccount = isPayLaterMethod(sale.payment_method) ? arId : tender.accountId;
    const invId = await this.accountId(ACCOUNT_CODES.INVENTORY);
    const cogsId = await this.accountId(ACCOUNT_CODES.COGS);

    const lines = [
      line(retId, net, 0, { customer_id: sale.customer_id, description: result.returnNumber }),
    ];
    if (vatPortion > 0) {
      lines.push(line(vatOutId, vatPortion, 0, { customer_id: sale.customer_id, description: "VAT reverse" }));
    }
    lines.push(line(creditAccount, 0, refund, { customer_id: sale.customer_id, description: "Refund" }));

    let cogs = 0;
    const returnItems = await query(
      `SELECT sri.quantity,
              COALESCE(
                (SELECT si.cost_price FROM sale_items si
                 WHERE si.sale_id = $2 AND si.product_id = sri.product_id
                 LIMIT 1),
                p.cost_price
              ) AS cost_price
       FROM sale_return_items sri
       JOIN products p ON p.id = sri.product_id
       WHERE sri.return_id = $1`,
      [result.returnId, sale?.id]
    );
    for (const item of returnItems) {
      cogs = roundMoney(cogs + Number(item.cost_price || 0) * Number(item.quantity || 0));
    }
    if (cogs > 0) {
      lines.push(line(invId, cogs, 0, { description: "Inventory in" }));
      lines.push(line(cogsId, 0, cogs, { description: "COGS reverse" }));
    }

    return this.postJournal({
      prefix: "RET",
      entryType: JOURNAL_TYPES.SALE_RETURN,
      sourceType: "sale_return",
      sourceId: result.returnId,
      entryDate: date,
      description: `Return ${result.returnNumber}`,
      lines,
    });
  }

  async postSalePayment({ paymentId, sale, amount, paymentMethod }) {
    if (!(await this.isEnabled()) || !sale) return null;
    const value = roundMoney(amount);
    if (value <= 0) return null;
    const tender = await this.resolveTenderAccount(paymentMethod);
    const arId = await this.accountId(ACCOUNT_CODES.AR);
    return this.postJournal({
      prefix: "PAY-CUS",
      entryType: JOURNAL_TYPES.SALE_PAYMENT,
      sourceType: "sale_payment",
      sourceId: paymentId,
      entryDate: await this.businessDate(),
      description: `Customer payment ${sale.sale_number}`,
      lines: [
        line(tender.accountId, value, 0, { customer_id: sale.customer_id, description: sale.sale_number }),
        line(arId, 0, value, { customer_id: sale.customer_id, description: sale.sale_number }),
      ],
    });
  }

  async postPurchase(purchase) {
    if (!(await this.isEnabled()) || !purchase) return null;
    const total = roundMoney(purchase.total);
    if (total <= 0) return null;
    const invId = await this.accountId(ACCOUNT_CODES.INVENTORY);
    const apId = await this.accountId(ACCOUNT_CODES.AP);
    const isCredit = purchase.payment_status === "pending" || purchase.purchase_type === "supplier_credit";
    const creditAccount = isCredit ? apId : await this.defaultCashId();
    return this.postJournal({
      prefix: "PUR",
      entryType: JOURNAL_TYPES.PURCHASE,
      sourceType: "purchase",
      sourceId: purchase.id,
      entryDate: dateOnly(purchase.created_at),
      description: `Purchase ${purchase.purchase_number}`,
      lines: [
        line(invId, total, 0, { supplier_id: purchase.supplier_id, description: "Inventory in" }),
        line(creditAccount, 0, total, { supplier_id: purchase.supplier_id, description: isCredit ? "Payable" : "Cash" }),
      ],
    });
  }

  async postSupplierPayment({ paymentId, supplierId, amount, purchaseNumber }) {
    if (!(await this.isEnabled())) return null;
    const value = roundMoney(amount);
    if (value <= 0) return null;
    const apId = await this.accountId(ACCOUNT_CODES.AP);
    const cashId = await this.defaultCashId();
    return this.postJournal({
      prefix: "PAY-SUP",
      entryType: JOURNAL_TYPES.PURCHASE_PAYMENT,
      sourceType: "supplier_payment",
      sourceId: paymentId,
      entryDate: await this.businessDate(),
      description: purchaseNumber === "advance"
        ? "Supplier advance payment"
        : `Supplier payment ${purchaseNumber || ""}`.trim(),
      lines: [
        line(apId, value, 0, { supplier_id: supplierId, description: "Payable" }),
        line(cashId, 0, value, { supplier_id: supplierId, description: "Cash" }),
      ],
    });
  }

  async postExpense(expense) {
    if (!(await this.isEnabled()) || !expense) return null;
    const value = roundMoney(expense.amount);
    if (value <= 0) return null;
    const expCode = EXPENSE_ACCOUNT_MAP[expense.category] || ACCOUNT_CODES.OTHER_EXPENSE;
    const expId = await this.accountId(expCode);
    const tender = await this.resolveTenderAccount(expense.payment_method || "cash");
    const journal = await this.postJournal({
      prefix: "EXP",
      entryType: JOURNAL_TYPES.EXPENSE,
      sourceType: "expense",
      sourceId: expense.id,
      entryDate: dateOnly(expense.expense_date),
      description: expense.name,
      lines: [
        line(expId, value, 0, { description: expense.name }),
        line(tender.accountId, 0, value, { description: expense.payment_method || "cash" }),
      ],
    });
    if (journal?.id) {
      await execute("UPDATE expenses SET journal_entry_id = $1 WHERE id = $2", [journal.id, expense.id]);
    }
    return journal;
  }

  async postInventoryAdjustment({ productId, quantityChange, costPrice, adjustmentId }) {
    if (!(await this.isEnabled()) || !quantityChange) return null;
    const value = roundMoney(Math.abs(Number(quantityChange)) * Number(costPrice || 0));
    if (value <= 0) return null;
    const invId = await this.accountId(ACCOUNT_CODES.INVENTORY);
    const adjId = await this.accountId(ACCOUNT_CODES.INVENTORY_ADJUST);
    const increase = Number(quantityChange) > 0;
    return this.postJournal({
      prefix: "JV",
      entryType: JOURNAL_TYPES.INVENTORY,
      sourceType: "inventory_adjust",
      sourceId: adjustmentId || productId,
      allowDuplicate: true,
      entryDate: await this.businessDate(),
      description: "Stock adjustment",
      lines: increase
        ? [line(invId, value, 0), line(adjId, 0, value)]
        : [line(adjId, value, 0), line(invId, 0, value)],
    });
  }

  async postCashTransfer({ fromAccountId, toAccountId, amount, entryDate, notes }) {
    const value = roundMoney(amount);
    if (value <= 0) throw new Error("Amount must be greater than zero");
    if (Number(fromAccountId) === Number(toAccountId)) throw new Error("Choose two different accounts");
    return this.postJournal({
      prefix: "JV",
      entryType: JOURNAL_TYPES.CASH,
      sourceType: "cash_transfer",
      sourceId: Date.now(),
      allowDuplicate: true,
      entryDate: dateOnly(entryDate) || await this.businessDate(),
      description: notes || "Cash / bank transfer",
      lines: [
        line(Number(toAccountId), value, 0, { description: "Transfer in" }),
        line(Number(fromAccountId), 0, value, { description: "Transfer out" }),
      ],
    });
  }

  async audit(action, entityType, entityId, reference, extra = "") {
    const user = currentUser();
    await execute(
      `INSERT INTO accounting_audit_log
       (user_id, user_name, action, entity_type, entity_id, reference, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user?.id || null,
        user?.full_name || user?.username || null,
        action,
        entityType,
        entityId || null,
        reference || null,
        extra || null,
      ]
    );
  }

  async listAudit({ limit = 100 } = {}) {
    return query(
      "SELECT * FROM accounting_audit_log ORDER BY id DESC LIMIT $1",
      [limit]
    );
  }
}

export const accountingService = new AccountingService();

export async function safeAccountingPost(task) {
  try {
    if (!(await accountingService.isEnabled())) return null;
    return await task();
  } catch (err) {
    console.error("Accounting posting failed:", err);
    return null;
  }
}
