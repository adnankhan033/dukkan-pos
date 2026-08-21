import { useCallback, useEffect, useState } from "react";
import { accountingService } from "../services/AccountingService";
import { useSettingsStore } from "../contexts/store";
import { isAccountingEnabled } from "../utils/accounting";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Modal from "../components/common/Modal";
import { Input, Select, Textarea } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/Loading";
import Badge from "../components/common/Badge";
import AccountingGate from "../components/common/AccountingGate";
import AccountingReports from "./AccountingReports";
import { formatCurrency, formatDate, todayISO } from "../utils/format";
import "./AccountingHub.css";

const BOOK_TABS = [
  { id: "journals", label: "Journals" },
  { id: "accounts", label: "Chart of accounts" },
  { id: "cash", label: "Cash & bank" },
  { id: "ledger", label: "General ledger" },
  { id: "statements", label: "Statements" },
];

export default function AccountingJournals() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const enabled = isAccountingEnabled(settings);
  const { submitting, guard } = useSubmitGuard();
  const [tab, setTab] = useState("journals");
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [ledgerAccount, setLedgerAccount] = useState("");
  const [ledger, setLedger] = useState({ items: [], totals: {} });
  const [from, setFrom] = useState(todayISO().slice(0, 8) + "01");
  const [to, setTo] = useState(todayISO());
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

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [journalData, accountRows, groupRows] = await Promise.all([
        accountingService.listJournals({ from, to, limit: 100 }),
        accountingService.listAccounts({ activeOnly: false }),
        accountingService.listGroups(),
      ]);
      setJournals(journalData.items);
      setAccounts(accountRows);
      setGroups(groupRows);
      if (!ledgerAccount && accountRows[0]) setLedgerAccount(String(accountRows[0].id));
      if (!manual.debit_account && accountRows[0]) {
        setManual((m) => ({ ...m, debit_account: String(accountRows[0].id), credit_account: String(accountRows[1]?.id || accountRows[0].id) }));
      }
      const cashBank = accountRows.filter((a) => a.subtype === "cash" || a.subtype === "bank");
      if (!transfer.fromAccountId && cashBank[0]) {
        setTransfer((t) => ({
          ...t,
          fromAccountId: String(cashBank[0].id),
          toAccountId: String(cashBank[1]?.id || cashBank[0].id),
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, from, to, ledgerAccount, manual.debit_account, transfer.fromAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled || tab !== "ledger" || !ledgerAccount) return;
    accountingService.getLedger({ accountId: Number(ledgerAccount), from, to }).then(setLedger);
  }, [enabled, tab, ledgerAccount, from, to]);

  const journalColumns = [
    { key: "reference", label: "Reference" },
    { key: "entry_date", label: "Date", render: (r) => formatDate(r.entry_date) },
    { key: "entry_type", label: "Type", render: (r) => <Badge>{r.entry_type}</Badge> },
    { key: "description", label: "Description" },
    { key: "status", label: "Status" },
  ];

  const accountColumns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Account" },
    { key: "group_name", label: "Group" },
    { key: "type", label: "Type" },
    { key: "is_active", label: "Active", render: (r) => (r.is_active ? "Yes" : "No") },
  ];

  const cashAccounts = accounts.filter((a) => a.subtype === "cash" || a.subtype === "bank");

  return (
    <div className="acct-hub">
      <PageHeader
        title="Books"
        subtitle="Journals, cash, ledgers, and financial statements — debit and credit stay in the background."
        actions={
          enabled && tab !== "statements" ? (
            <>
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>Transfer</Button>
              <Button onClick={() => setManualOpen(true)}>Manual journal</Button>
            </>
          ) : null
        }
      />
      <AccountingGate enabled={enabled}>
        <div className="acct-subtabs">
          {BOOK_TABS.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        {tab !== "statements" ? (
        <div className="acct-filters">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        ) : null}
        {tab === "statements" ? (
          <AccountingReports embedded />
        ) : loading ? (
          <LoadingSpinner message="Loading books..." />
        ) : tab === "journals" ? (
          <Table columns={journalColumns} data={journals} emptyMessage="No journal entries yet." onRowClick={(row) => accountingService.getJournal(row.id).then(setDetail)} />
        ) : tab === "accounts" ? (
          <>
            <div className="acct-inline-actions">
              <Button size="sm" onClick={() => setAccountOpen(true)}>Add account</Button>
            </div>
            <Table columns={accountColumns} data={accounts} emptyMessage="No accounts." />
          </>
        ) : tab === "cash" ? (
          <Table
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Account" },
              { key: "subtype", label: "Type" },
            ]}
            data={cashAccounts}
            emptyMessage="No cash or bank accounts."
          />
        ) : (
          <>
            <Select label="Account" value={ledgerAccount} onChange={(e) => setLedgerAccount(e.target.value)}>
              {accounts.filter((a) => a.is_active).map((account) => (
                <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
              ))}
            </Select>
            <Table
              columns={[
                { key: "entry_date", label: "Date", render: (r) => formatDate(r.entry_date) },
                { key: "reference", label: "Reference" },
                { key: "description", label: "Description", render: (r) => r.description || r.entry_description },
                { key: "debit", label: "Debit", render: (r) => formatCurrency(r.debit, currency) },
                { key: "credit", label: "Credit", render: (r) => formatCurrency(r.credit, currency) },
                { key: "balance", label: "Balance", render: (r) => formatCurrency(r.balance, currency) },
              ]}
              data={ledger.items}
              emptyMessage="No ledger lines."
            />
          </>
        )}
      </AccountingGate>

      <Modal isOpen={Boolean(detail)} title={detail?.reference} onClose={() => setDetail(null)} size="lg">
        {detail ? (
          <>
            <p>{detail.description}</p>
            <Table
              columns={[
                { key: "account_code", label: "Code" },
                { key: "account_name", label: "Account" },
                { key: "debit", label: "Debit", render: (r) => formatCurrency(r.debit, currency) },
                { key: "credit", label: "Credit", render: (r) => formatCurrency(r.credit, currency) },
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
                    await load();
                  })
                }
              >
                Reverse entry
              </Button>
            ) : null}
          </>
        ) : null}
      </Modal>

      <Modal
        isOpen={manualOpen}
        title="Manual journal"
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
                  await load();
                })
              }
            >
              Post
            </Button>
          </>
        }
      >
        <Input label="Date" type="date" value={manual.entry_date} onChange={(e) => setManual({ ...manual, entry_date: e.target.value })} />
        <Input label="Description" value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} />
        <Select label="Debit account" value={manual.debit_account} onChange={(e) => setManual({ ...manual, debit_account: e.target.value })}>
          {accounts.filter((a) => a.is_active).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </Select>
        <Select label="Credit account" value={manual.credit_account} onChange={(e) => setManual({ ...manual, credit_account: e.target.value })}>
          {accounts.filter((a) => a.is_active).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </Select>
        <Input label={`Amount (${currency})`} type="number" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
      </Modal>

      <Modal
        isOpen={transferOpen}
        title="Cash / bank transfer"
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
                  await load();
                })
              }
            >
              Transfer
            </Button>
          </>
        }
      >
        <Select label="From" value={transfer.fromAccountId} onChange={(e) => setTransfer({ ...transfer, fromAccountId: e.target.value })}>
          {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select label="To" value={transfer.toAccountId} onChange={(e) => setTransfer({ ...transfer, toAccountId: e.target.value })}>
          {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                  await load();
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
          {groups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
        </Select>
      </Modal>
    </div>
  );
}
