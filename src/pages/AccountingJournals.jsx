import { useCallback, useEffect, useMemo, useState } from "react";
import { accountingService } from "../services/AccountingService";
import { settingsService } from "../services/SettingsService";
import { useSettingsStore } from "../contexts/store";
import {
  JOURNAL_TYPE_LABELS,
  friendlyAccountLabel,
  friendlyLineDescription,
  isAccountingEnabled,
  journalTypeLabel,
  roundMoney,
} from "../utils/accounting";
import { BOOKS_PAGE_SIZE } from "../utils/constants";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import SearchBar from "../components/common/SearchBar";
import Modal from "../components/common/Modal";
import { Input, Select, Textarea } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/Loading";
import Badge from "../components/common/Badge";
import AccountingGate from "../components/common/AccountingGate";
import AccountingReports from "./AccountingReports";
import { formatCurrency, formatDate, formatSignedCurrency, todayISO } from "../utils/format";
import "./AccountingHub.css";

const BOOK_TABS = [
  { id: "snapshot", label: "Snapshot" },
  { id: "statements", label: "Reports" },
  { id: "activity", label: "Activity" },
  { id: "cash", label: "Cash" },
  { id: "more", label: "More" },
];

const ACTIVITY_TYPES = [
  { id: "all", label: "Everything" },
  ...Object.entries(JOURNAL_TYPE_LABELS).map(([id, label]) => ({ id, label })),
];

const STATUS_OPTIONS = [
  { id: "posted", label: "Posted" },
  { id: "reversed", label: "Cancelled" },
  { id: "all", label: "Posted + cancelled" },
];

const ACCOUNT_ACTIVE_OPTIONS = [
  { id: "active", label: "In use" },
  { id: "hidden", label: "Hidden" },
  { id: "all", label: "All accounts" },
];

const ACCOUNT_TYPE_OPTIONS = [
  { id: "all", label: "All groups of money" },
  { id: "asset", label: "What we own" },
  { id: "liability", label: "What we owe" },
  { id: "equity", label: "Owners" },
  { id: "revenue", label: "Income" },
  { id: "expense", label: "Expenses" },
];

function monthStartISO() {
  return todayISO().slice(0, 8) + "01";
}

function yearStartISO() {
  return `${todayISO().slice(0, 4)}-01-01`;
}

function activityBadgeVariant(type) {
  if (type === "reversal") return "danger";
  if (type === "sale" || type === "sale_payment") return "success";
  if (type === "expense" || type === "purchase_payment") return "warning";
  if (type === "inventory" || type === "opening") return "info";
  return "neutral";
}

function periodPresetFor(from, to) {
  if (!from && !to) return "all";
  if (from === monthStartISO() && to === todayISO()) return "month";
  if (from === yearStartISO() && to === todayISO()) return "year";
  return "custom";
}

function datesForPreset(preset) {
  if (preset === "month") return { from: monthStartISO(), to: todayISO() };
  if (preset === "year") return { from: yearStartISO(), to: todayISO() };
  return { from: "", to: "" };
}

function PeriodChips({ from, to, onPreset }) {
  const preset = periodPresetFor(from, to);
  return (
    <div className="acct-period-chips">
      <button type="button" className={preset === "month" ? "active" : ""} onClick={() => onPreset("month")}>This month</button>
      <button type="button" className={preset === "year" ? "active" : ""} onClick={() => onPreset("year")}>This year</button>
      <button type="button" className={preset === "all" ? "active" : ""} onClick={() => onPreset("all")}>All dates</button>
    </div>
  );
}

function pagesFor(total, size = BOOKS_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Number(total || 0) / size));
}

export default function AccountingJournals() {
  const settings = useSettingsStore((s) => s.settings);
  const mergeSettings = useSettingsStore((s) => s.mergeSettings);
  const currency = settings.currency || "SAR";
  const enabled = isAccountingEnabled(settings);
  const { submitting, guard } = useSubmitGuard();
  const [tab, setTab] = useState("snapshot");
  const [moreView, setMoreView] = useState("accounts");
  const [journals, setJournals] = useState([]);
  const [journalTotal, setJournalTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityType, setActivityType] = useState("all");
  const [activityStatus, setActivityStatus] = useState("posted");
  const [accounts, setAccounts] = useState([]);
  const [accountRows, setAccountRows] = useState([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountPage, setAccountPage] = useState(1);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountGroup, setAccountGroup] = useState("");
  const [accountType, setAccountType] = useState("all");
  const [accountActive, setAccountActive] = useState("active");
  const [groups, setGroups] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [ledgerAccount, setLedgerAccount] = useState("");
  const [ledger, setLedger] = useState({ items: [], totals: {}, total: 0 });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerType, setLedgerType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [hideEmptyAccounts, setHideEmptyAccounts] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [manual, setManual] = useState({
    description: "",
    entry_date: todayISO(),
    debit_account: "",
    credit_account: "",
    amount: "",
  });
  const [transfer, setTransfer] = useState({ fromAccountId: "", toAccountId: "", amount: "", notes: "" });
  const [accountForm, setAccountForm] = useState({ code: "", name: "", group_id: "", name_ar: "" });

  const applyPickerDefaults = (accountRowsList) => {
    const cash = accountRowsList.find((a) => a.subtype === "cash" && a.is_active) || accountRowsList[0];
    setLedgerAccount((prev) => prev || (cash ? String(cash.id) : ""));
    setManual((m) => (
      m.debit_account
        ? m
        : {
            ...m,
            debit_account: String(accountRowsList[0]?.id || ""),
            credit_account: String(accountRowsList[1]?.id || accountRowsList[0]?.id || ""),
          }
    ));
    const cashBank = accountRowsList.filter((a) => a.subtype === "cash" || a.subtype === "bank");
    setTransfer((t) => (
      t.fromAccountId
        ? t
        : {
            ...t,
            fromAccountId: String(cashBank[0]?.id || ""),
            toAccountId: String(cashBank[1]?.id || cashBank[0]?.id || ""),
          }
    ));
  };

  const loadShell = useCallback(async () => {
    setLoading(true);
    try {
      const recovered = await accountingService.recoverBooksAfterDataClear().catch(() => false);
      const booksOn = recovered || enabled || (await accountingService.isEnabled());
      if (recovered) {
        mergeSettings(await settingsService.getAll());
      }
      if (!booksOn) {
        return;
      }
      await accountingService.repairMispostedInventoryRevaluations().catch(() => {});
      const [accountList, groupRows, dash, bals] = await Promise.all([
        accountingService.listAccounts({ activeOnly: false, active: "all" }),
        accountingService.listGroups(),
        accountingService.dashboard({ from: monthStartISO(), to: todayISO() }),
        accountingService.accountBalances({ asOf: todayISO() }),
      ]);
      setAccounts(accountList);
      setGroups(groupRows);
      setSnapshot(dash);
      setBalances(bals);
      applyPickerDefaults(accountList);
    } catch (err) {
      console.error("Failed to load books", err);
    } finally {
      setLoading(false);
    }
  }, [enabled, mergeSettings]);

  const loadActivity = useCallback(async () => {
    if (!enabled) return;
    setListLoading(true);
    try {
      const data = await accountingService.listJournals({
        from: from || null,
        to: to || null,
        type: activityType,
        status: activityStatus,
        search: activitySearch,
        page: activityPage,
        limit: BOOKS_PAGE_SIZE,
      });
      setJournals(data.items);
      setJournalTotal(data.total);
      if (activityPage > pagesFor(data.total) && data.total > 0) setActivityPage(1);
    } finally {
      setListLoading(false);
    }
  }, [enabled, from, to, activityType, activityStatus, activitySearch, activityPage]);

  const loadAccountList = useCallback(async () => {
    if (!enabled) return;
    setListLoading(true);
    try {
      const data = await accountingService.listAccounts({
        activeOnly: false,
        active: accountActive,
        search: accountSearch,
        groupId: accountGroup || null,
        type: accountType === "all" ? null : accountType,
        page: accountPage,
        limit: BOOKS_PAGE_SIZE,
      });
      setAccountRows(data.items);
      setAccountTotal(data.total);
      if (accountPage > pagesFor(data.total) && data.total > 0) setAccountPage(1);
    } finally {
      setListLoading(false);
    }
  }, [enabled, accountActive, accountSearch, accountGroup, accountType, accountPage]);

  const loadLedger = useCallback(async () => {
    if (!enabled || !ledgerAccount) {
      setLedger({ items: [], totals: {}, total: 0 });
      return;
    }
    setListLoading(true);
    try {
      const data = await accountingService.getLedger({
        accountId: Number(ledgerAccount),
        from: ledgerFrom || null,
        to: ledgerTo || null,
        type: ledgerType,
        search: ledgerSearch,
        page: ledgerPage,
        limit: BOOKS_PAGE_SIZE,
      });
      setLedger(data);
      if (ledgerPage > pagesFor(data.total) && data.total > 0) setLedgerPage(1);
    } finally {
      setListLoading(false);
    }
  }, [enabled, ledgerAccount, ledgerFrom, ledgerTo, ledgerType, ledgerSearch, ledgerPage]);

  useEffect(() => {
    loadShell();
  }, [loadShell]);

  useEffect(() => {
    if (tab === "activity") loadActivity();
  }, [tab, loadActivity]);

  useEffect(() => {
    if (tab === "more" && moreView === "accounts") loadAccountList();
  }, [tab, moreView, loadAccountList]);

  useEffect(() => {
    if (tab === "more" && moreView === "ledger") loadLedger();
  }, [tab, moreView, loadLedger]);

  const cashAccounts = accounts.filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const cashRows = cashAccounts.map((account) => ({
    ...account,
    balance: balances.find((row) => row.id === account.id)?.balance || 0,
  }));
  const listedAccounts = accountRows.map((account) => ({
    ...account,
    balance: balances.find((row) => row.id === account.id)?.balance || 0,
  }));
  const visibleAccounts = hideEmptyAccounts
    ? listedAccounts.filter(
        (account) =>
          Math.abs(Number(account.balance) || 0) > 0.005
          || account.subtype === "cash"
          || account.subtype === "bank"
      )
    : listedAccounts;
  const cashTotal = roundMoney(cashRows.reduce((sum, row) => sum + (Number(row.balance) || 0), 0));
  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts]);

  const applyActivityPeriod = (preset) => {
    const next = datesForPreset(preset);
    setFrom(next.from);
    setTo(next.to);
    setActivityPage(1);
  };

  const applyLedgerPeriod = (preset) => {
    const next = datesForPreset(preset);
    setLedgerFrom(next.from);
    setLedgerTo(next.to);
    setLedgerPage(1);
  };

  const openAccountHistory = (accountId) => {
    setLedgerAccount(String(accountId));
    setLedgerFrom("");
    setLedgerTo("");
    setLedgerPage(1);
    setMoreView("ledger");
    setTab("more");
  };

  const resetActivityFilters = () => {
    setActivitySearch("");
    setActivityType("all");
    setActivityStatus("posted");
    setFrom("");
    setTo("");
    setActivityPage(1);
  };

  const resetAccountFilters = () => {
    setAccountSearch("");
    setAccountGroup("");
    setAccountType("all");
    setAccountActive("active");
    setAccountPage(1);
  };

  const resetLedgerFilters = () => {
    setLedgerSearch("");
    setLedgerType("all");
    setLedgerFrom("");
    setLedgerTo("");
    setLedgerPage(1);
  };

  const refreshAfterSave = async () => {
    await loadShell();
    if (tab === "activity") await loadActivity();
    if (tab === "more" && moreView === "accounts") await loadAccountList();
    if (tab === "more" && moreView === "ledger") await loadLedger();
  };

  const headerActions = !enabled ? null : tab === "cash" ? (
    <Button onClick={() => setTransferOpen(true)}>Move cash</Button>
  ) : tab === "more" && moreView === "accounts" ? (
    <>
      <Button variant="secondary" onClick={() => setAccountOpen(true)}>Add account</Button>
      <Button variant="secondary" onClick={() => setManualOpen(true)}>Adjustment</Button>
    </>
  ) : tab === "more" ? (
    <Button variant="secondary" onClick={() => setManualOpen(true)}>Adjustment</Button>
  ) : null;

  const showListSpinner = loading && tab !== "statements";
  const showTableSpinner = !loading && listLoading && (tab === "activity" || tab === "more");

  return (
    <div className="acct-hub">
      <PageHeader
        title="Books"
        subtitle="See cash, profit, and what the shop owns — without debit and credit."
        actions={headerActions}
      />
      <AccountingGate enabled={enabled}>
        <div className="acct-subtabs">
          {BOOK_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === "statements" ? (
          <AccountingReports embedded />
        ) : showListSpinner ? (
          <LoadingSpinner message="Loading a simple picture..." />
        ) : tab === "snapshot" ? (
          <SnapshotBoard data={snapshot} currency={currency} />
        ) : tab === "activity" ? (
          <>
            <p className="acct-hint">Every sale, payment, expense, and stock change — newest first. Use All dates to see starting capital.</p>
            <PeriodChips from={from} to={to} onPreset={applyActivityPeriod} />
            <div className="acct-toolbar">
              <SearchBar
                value={activitySearch}
                onChange={(value) => {
                  setActivitySearch(value);
                  setActivityPage(1);
                }}
                placeholder="Search details or invoice number..."
              />
              <Select
                label="What happened"
                value={activityType}
                onChange={(e) => {
                  setActivityType(e.target.value);
                  setActivityPage(1);
                }}
              >
                {ACTIVITY_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </Select>
              <Select
                label="Status"
                value={activityStatus}
                onChange={(e) => {
                  setActivityStatus(e.target.value);
                  setActivityPage(1);
                }}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </Select>
              <Input
                label="From"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setActivityPage(1);
                }}
              />
              <Input
                label="To"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setActivityPage(1);
                }}
              />
              <Button variant="secondary" onClick={resetActivityFilters}>Clear</Button>
            </div>
            {showTableSpinner ? <LoadingSpinner message="Finding records..." /> : (
              <>
                <Table
                  columns={[
                    { key: "entry_date", label: "Date", render: (r) => formatDate(r.entry_date) },
                    {
                      key: "entry_type",
                      label: "What",
                      render: (r) => <Badge variant={activityBadgeVariant(r.entry_type)}>{journalTypeLabel(r.entry_type)}</Badge>,
                    },
                    { key: "description", label: "Details" },
                    { key: "reference", label: "Ref" },
                    {
                      key: "status",
                      label: "Status",
                      render: (r) => (r.status === "reversed" ? <Badge variant="danger">Cancelled</Badge> : <Badge variant="success">Posted</Badge>),
                    },
                  ]}
                  data={journals}
                  emptyMessage="Nothing matches these filters."
                  onRowClick={(row) => accountingService.getJournal(row.id).then(setDetail)}
                />
                <Pagination
                  page={activityPage}
                  totalPages={pagesFor(journalTotal)}
                  total={journalTotal}
                  onPageChange={setActivityPage}
                  itemLabel="records"
                />
              </>
            )}
          </>
        ) : tab === "cash" ? (
          <>
            <p className="acct-hint">Money in the till and bank right now. Tap a row to see how it got there.</p>
            {cashTotal ? (
              <p className="acct-result-meta">
                Total cash + bank: <strong>{formatCurrency(cashTotal, currency)}</strong>
              </p>
            ) : null}
            <Table
              columns={[
                { key: "name", label: "Where", render: (r) => friendlyAccountLabel(r) },
                {
                  key: "balance",
                  label: "Amount",
                  render: (r) => formatCurrency(r.balance, currency),
                },
              ]}
              data={cashRows}
              emptyMessage="No cash or bank accounts yet."
              onRowClick={(row) => openAccountHistory(row.id)}
            />
          </>
        ) : (
          <>
            <div className="acct-subtabs">
              <button
                type="button"
                className={moreView === "accounts" ? "active" : ""}
                onClick={() => setMoreView("accounts")}
              >
                Account list
              </button>
              <button
                type="button"
                className={moreView === "ledger" ? "active" : ""}
                onClick={() => setMoreView("ledger")}
              >
                Account history
              </button>
            </div>
            <p className="acct-hint">
              {moreView === "accounts"
                ? "Tap an account to open its history. Empty accounts are hidden so the list stays short."
                : "Newest lines first. Debit (مدين) and Credit (دائن) are the two sides. The running total includes money from before this date range."}
            </p>
            {moreView === "accounts" ? (
              <>
                <div className="acct-toolbar">
                  <SearchBar
                    value={accountSearch}
                    onChange={(value) => {
                      setAccountSearch(value);
                      setAccountPage(1);
                    }}
                    placeholder="Search account name or code..."
                  />
                  <Select
                    label="Kind"
                    value={accountType}
                    onChange={(e) => {
                      setAccountType(e.target.value);
                      setAccountPage(1);
                    }}
                  >
                    {ACCOUNT_TYPE_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </Select>
                  <Select
                    label="Group"
                    value={accountGroup}
                    onChange={(e) => {
                      setAccountGroup(e.target.value);
                      setAccountPage(1);
                    }}
                  >
                    <option value="">All groups</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </Select>
                  <Select
                    label="Shown"
                    value={accountActive}
                    onChange={(e) => {
                      setAccountActive(e.target.value);
                      setAccountPage(1);
                    }}
                  >
                    {ACCOUNT_ACTIVE_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </Select>
                  <Select
                    label="Empty accounts"
                    value={hideEmptyAccounts ? "hide" : "show"}
                    onChange={(e) => setHideEmptyAccounts(e.target.value === "hide")}
                  >
                    <option value="hide">Hide empty</option>
                    <option value="show">Show empty</option>
                  </Select>
                  <Button variant="secondary" onClick={resetAccountFilters}>Clear</Button>
                </div>
                {showTableSpinner ? <LoadingSpinner message="Finding accounts..." /> : (
                  <>
                    <Table
                      columns={[
                        { key: "name", label: "Account", render: (r) => friendlyAccountLabel(r) },
                        { key: "group_name", label: "Group" },
                        {
                          key: "balance",
                          label: "Amount",
                          render: (r) => formatCurrency(r.balance, currency),
                        },
                        { key: "is_active", label: "In use", render: (r) => (r.is_active ? "Yes" : "No") },
                      ]}
                      data={visibleAccounts}
                      emptyMessage="No accounts match these filters."
                      onRowClick={(row) => openAccountHistory(row.id)}
                    />
                    <Pagination
                      page={accountPage}
                      totalPages={pagesFor(hideEmptyAccounts ? visibleAccounts.length : accountTotal)}
                      total={hideEmptyAccounts ? visibleAccounts.length : accountTotal}
                      onPageChange={setAccountPage}
                      itemLabel="accounts"
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <PeriodChips from={ledgerFrom} to={ledgerTo} onPreset={applyLedgerPeriod} />
                <div className="acct-toolbar">
                  <Select
                    label="Account"
                    value={ledgerAccount}
                    onChange={(e) => {
                      setLedgerAccount(e.target.value);
                      setLedgerPage(1);
                    }}
                  >
                    {!ledgerAccount ? <option value="">Select account</option> : null}
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {friendlyAccountLabel(account)}
                      </option>
                    ))}
                  </Select>
                  <SearchBar
                    value={ledgerSearch}
                    onChange={(value) => {
                      setLedgerSearch(value);
                      setLedgerPage(1);
                    }}
                    placeholder="Search this account..."
                  />
                  <Select
                    label="What happened"
                    value={ledgerType}
                    onChange={(e) => {
                      setLedgerType(e.target.value);
                      setLedgerPage(1);
                    }}
                  >
                    {ACTIVITY_TYPES.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </Select>
                  <Input
                    label="From"
                    type="date"
                    value={ledgerFrom}
                    onChange={(e) => {
                      setLedgerFrom(e.target.value);
                      setLedgerPage(1);
                    }}
                  />
                  <Input
                    label="To"
                    type="date"
                    value={ledgerTo}
                    onChange={(e) => {
                      setLedgerTo(e.target.value);
                      setLedgerPage(1);
                    }}
                  />
                  <Button variant="secondary" onClick={resetLedgerFilters}>Clear</Button>
                </div>
                {ledger.totals?.balance != null ? (
                  <p className="acct-result-meta">
                    In this account now: <strong>{formatCurrency(ledger.totals.balance, currency)}</strong>
                    {ledgerFrom && Math.abs(Number(ledger.totals.opening) || 0) >= 0.005
                      ? ` · Before this period ${formatCurrency(ledger.totals.opening, currency)} · This period ${formatSignedCurrency(ledger.totals.periodChange, currency)}`
                      : ""}
                    {ledger.total ? ` · ${ledger.total.toLocaleString()} lines` : ""}
                  </p>
                ) : null}
                {showTableSpinner ? <LoadingSpinner message="Finding history..." /> : (
                  <>
                    <Table
                      columns={[
                        { key: "entry_date", label: "Date", render: (r) => (r.is_opening ? "Before" : formatDate(r.entry_date)) },
                        {
                          key: "entry_type",
                          label: "What",
                          render: (r) => <Badge variant={activityBadgeVariant(r.entry_type)}>{r.is_opening ? "Brought forward" : journalTypeLabel(r.entry_type)}</Badge>,
                        },
                        { key: "description", label: "What happened", render: (r) => friendlyLineDescription(r) },
                        {
                          key: "debit",
                          label: "Debit · مدين",
                          render: (r) => (r.is_opening || !(Number(r.debit) > 0.004) ? "—" : formatCurrency(r.debit, currency)),
                        },
                        {
                          key: "credit",
                          label: "Credit · دائن",
                          render: (r) => (r.is_opening || !(Number(r.credit) > 0.004) ? "—" : formatCurrency(r.credit, currency)),
                        },
                        { key: "balance", label: "Running total", render: (r) => formatCurrency(r.balance, currency) },
                      ]}
                      data={ledger.items}
                      emptyMessage="No history matches these filters."
                    />
                    <Pagination
                      page={ledgerPage}
                      totalPages={pagesFor(ledger.total)}
                      total={ledger.total || 0}
                      onPageChange={setLedgerPage}
                      itemLabel="records"
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </AccountingGate>

      <Modal isOpen={Boolean(detail)} title={detail ? journalTypeLabel(detail.entry_type) : ""} onClose={() => setDetail(null)} size="lg">
        {detail ? (
          <>
            <p>{detail.description}</p>
            <p className="acct-hint">{formatDate(detail.entry_date)} · {detail.reference}</p>
            <Table
              columns={[
                { key: "account_name", label: "Account", render: (r) => friendlyAccountLabel({ code: r.account_code, name: r.account_name }) },
                {
                  key: "debit",
                  label: "Debit · مدين",
                  render: (r) => (Number(r.debit) > 0.004 ? formatCurrency(r.debit, currency) : "—"),
                },
                {
                  key: "credit",
                  label: "Credit · دائن",
                  render: (r) => (Number(r.credit) > 0.004 ? formatCurrency(r.credit, currency) : "—"),
                },
              ]}
              data={detail.lines || []}
            />
            {detail.status === "posted" ? (
              <Button
                variant="danger"
                size="sm"
                disabled={submitting}
                onClick={() =>
                  guard(async () => {
                    await accountingService.reverseJournal(detail.id);
                    setDetail(null);
                    await refreshAfterSave();
                  })
                }
              >
                Cancel this entry
              </Button>
            ) : null}
          </>
        ) : null}
      </Modal>

      <Modal
        isOpen={manualOpen}
        title="Adjustment"
        onClose={() => setManualOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button
              disabled={submitting}
              onClick={() =>
                guard(async () => {
                  const amount = Number(manual.amount);
                  await accountingService.postJournal({
                    prefix: "JV",
                    entryType: "manual",
                    sourceType: "manual",
                    sourceId: Date.now(),
                    allowDuplicate: true,
                    entryDate: manual.entry_date,
                    description: manual.description,
                    lines: [
                      { account_id: Number(manual.debit_account), debit: amount, credit: 0 },
                      { account_id: Number(manual.credit_account), debit: 0, credit: amount },
                    ],
                  });
                  setManualOpen(false);
                  await refreshAfterSave();
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <p className="acct-hint">Move an amount from one account into another. Use Receive cash or Pay cash for customers and suppliers.</p>
        <Input label="Date" type="date" value={manual.entry_date} onChange={(e) => setManual({ ...manual, entry_date: e.target.value })} />
        <Input label="What is this for?" value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} />
        <Select label="Put into (Debit · مدين)" value={manual.debit_account} onChange={(e) => setManual({ ...manual, debit_account: e.target.value })}>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>{friendlyAccountLabel(a)}</option>
          ))}
        </Select>
        <Select label="Take from (Credit · دائن)" value={manual.credit_account} onChange={(e) => setManual({ ...manual, credit_account: e.target.value })}>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>{friendlyAccountLabel(a)}</option>
          ))}
        </Select>
        <Input label={`Amount (${currency})`} type="number" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
      </Modal>

      <Modal
        isOpen={transferOpen}
        title="Move cash"
        onClose={() => setTransferOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button
              disabled={submitting}
              onClick={() =>
                guard(async () => {
                  await accountingService.postCashTransfer({
                    fromAccountId: transfer.fromAccountId,
                    toAccountId: transfer.toAccountId,
                    amount: Number(transfer.amount),
                    entryDate: todayISO(),
                    notes: transfer.notes,
                  });
                  setTransferOpen(false);
                  await refreshAfterSave();
                })
              }
            >
              Move
            </Button>
          </>
        }
      >
        <Select label="From" value={transfer.fromAccountId} onChange={(e) => setTransfer({ ...transfer, fromAccountId: e.target.value })}>
          {cashAccounts.map((a) => <option key={a.id} value={a.id}>{friendlyAccountLabel(a)}</option>)}
        </Select>
        <Select label="To" value={transfer.toAccountId} onChange={(e) => setTransfer({ ...transfer, toAccountId: e.target.value })}>
          {cashAccounts.map((a) => <option key={a.id} value={a.id}>{friendlyAccountLabel(a)}</option>)}
        </Select>
        <Input label={`Amount (${currency})`} type="number" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} />
        <Textarea label="Notes" value={transfer.notes} onChange={(e) => setTransfer({ ...transfer, notes: e.target.value })} />
      </Modal>

      <Modal
        isOpen={accountOpen}
        title="New account"
        onClose={() => setAccountOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAccountOpen(false)}>Cancel</Button>
            <Button
              disabled={submitting}
              onClick={() =>
                guard(async () => {
                  await accountingService.saveAccount(accountForm);
                  setAccountOpen(false);
                  setAccountForm({ code: "", name: "", group_id: "", name_ar: "" });
                  await refreshAfterSave();
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <Input label="Code" value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} />
        <Input label="Name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
        <Input label="Arabic name" value={accountForm.name_ar} onChange={(e) => setAccountForm({ ...accountForm, name_ar: e.target.value })} />
        <Select label="Group" value={accountForm.group_id} onChange={(e) => setAccountForm({ ...accountForm, group_id: e.target.value })}>
          <option value="">Select group</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </Modal>
    </div>
  );
}

function SnapshotBoard({ data, currency }) {
  const cards = [
    { label: "Cash in drawer", value: data?.cash, extra: "Physical cash in the till", always: true },
    { label: "Bank", value: data?.bank, extra: "In the bank account" },
    { label: "Partner capital", value: data?.partnerCapital, extra: "What partners own — not extra cash", always: true },
    { label: "Customers owe us", value: data?.receivable, extra: "Collect later" },
    { label: "We owe suppliers", value: data?.payable, extra: "Pay later" },
    { label: "Stock at cost", value: data?.inventory, extra: "On-hand products" },
    { label: "This month’s profit", value: data?.netProfit, extra: "From the books, without VAT", always: true },
  ].filter((card) => card.always || Math.abs(Number(card.value) || 0) > 0.005);

  return (
    <div className="acct-snapshot">
      <p className="acct-hint">
        Cash is what is in the till. Partner capital is who owns the shop — it is not added on top of cash.
      </p>
      <div className="acct-snapshot-grid">
        {cards.map((card) => {
          const amount = Number(card.value) || 0;
          const tone = amount > 0.005 ? "in" : amount < -0.005 ? "out" : "zero";
          return (
            <div key={card.label} className="acct-snapshot-card">
              <span>{card.label}</span>
              <strong className={`acct-money ${tone}`}>{formatCurrency(amount, currency)}</strong>
              <small>{card.extra}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}
