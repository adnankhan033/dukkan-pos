import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { accountingService } from "../services/AccountingService";
import { useSettingsStore } from "../contexts/store";
import { isAccountingEnabled, PARTNER_TX_TYPES } from "../utils/accounting";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Modal from "../components/common/Modal";
import { Input, Select, Textarea } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/Loading";
import AccountingGate from "../components/common/AccountingGate";
import { formatCurrency, todayISO } from "../utils/format";
import "./AccountingHub.css";

const EMPTY_PARTNER = {
  name: "",
  phone: "",
  ownership_percent: "",
  profit_share_percent: "",
  initial_capital: "",
  notes: "",
};

export default function AccountingPartners() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const enabled = isAccountingEnabled(settings);
  const { submitting, guard } = useSubmitGuard();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_PARTNER);
  const [tx, setTx] = useState({ type: "additional_capital", amount: "", notes: "", entry_date: todayISO() });
  const [cashAccounts, setCashAccounts] = useState([]);
  const [cashAccountId, setCashAccountId] = useState("");

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, cash, bank] = await Promise.all([
        accountingService.listPartners(),
        accountingService.listAccounts({ subtype: "cash" }),
        accountingService.listAccounts({ subtype: "bank" }),
      ]);
      setPartners(list);
      const accounts = [...cash, ...bank];
      setCashAccounts(accounts);
      setCashAccountId(String(accounts[0]?.id || ""));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_PARTNER);
    setModalOpen(true);
  }

  function openTx(partner) {
    setSelected(partner);
    setTx({ type: "additional_capital", amount: "", notes: "", entry_date: todayISO() });
    setTxOpen(true);
  }

  const columns = [
    { key: "name", label: "Partner" },
    { key: "ownership_percent", label: "Ownership %", render: (r) => `${Number(r.ownership_percent || 0).toFixed(2)}%` },
    { key: "profit_share_percent", label: "Profit share %", render: (r) => `${Number(r.profit_share_percent || 0).toFixed(2)}%` },
    { key: "total_invested", label: "Invested", render: (r) => formatCurrency(r.total_invested, currency) },
    { key: "total_withdrawn", label: "Withdrawn", render: (r) => formatCurrency(r.total_withdrawn, currency) },
    { key: "current_capital", label: "Current capital", render: (r) => formatCurrency(r.current_capital, currency) },
    {
      key: "actions",
      label: "",
      stopPropagation: true,
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => openTx(r)}>
          Transaction
        </Button>
      ),
    },
  ];

  return (
    <div className="acct-hub">
      <PageHeader
        title="Partners"
        subtitle="Unequal capital, drawings, loans, and profit distribution."
        actions={
          enabled ? (
            <Button onClick={openCreate}>
              <Plus size={16} /> Add partner
            </Button>
          ) : null
        }
      />
      <AccountingGate enabled={enabled}>
        {loading ? (
          <LoadingSpinner message="Loading partners..." />
        ) : (
          <Table columns={columns} data={partners} emptyMessage="No partners yet." />
        )}
      </AccountingGate>

      <Modal
        isOpen={modalOpen}
        title="Add partner"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              disabled={submitting}
              onClick={() =>
                guard(async () => {
                  await accountingService.createPartner({
                    ...form,
                    initial_capital: Number(form.initial_capital) || 0,
                  });
                  setModalOpen(false);
                  await load();
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label={`Initial capital (${currency})`} type="number" value={form.initial_capital} onChange={(e) => setForm({ ...form, initial_capital: e.target.value })} />
        <Input label="Ownership %" type="number" value={form.ownership_percent} onChange={(e) => setForm({ ...form, ownership_percent: e.target.value })} />
        <Input label="Profit share %" type="number" value={form.profit_share_percent} onChange={(e) => setForm({ ...form, profit_share_percent: e.target.value })} />
        <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Modal>

      <Modal
        isOpen={txOpen}
        title={selected ? `Transaction — ${selected.name}` : "Transaction"}
        onClose={() => setTxOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTxOpen(false)}>Cancel</Button>
            <Button
              disabled={submitting}
              onClick={() =>
                guard(async () => {
                  await accountingService.recordPartnerTransaction({
                    partnerId: selected.id,
                    type: tx.type,
                    amount: Number(tx.amount),
                    cashAccountId: Number(cashAccountId) || null,
                    entryDate: tx.entry_date,
                    notes: tx.notes,
                  });
                  setTxOpen(false);
                  await load();
                })
              }
            >
              Post
            </Button>
          </>
        }
      >
        <Select label="Type" value={tx.type} onChange={(e) => setTx({ ...tx, type: e.target.value })}>
          {PARTNER_TX_TYPES.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </Select>
        <Input label={`Amount (${currency})`} type="number" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} />
        <Input label="Date" type="date" value={tx.entry_date} onChange={(e) => setTx({ ...tx, entry_date: e.target.value })} />
        <Select label="Cash / bank" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
          {cashAccounts.map((account) => (
            <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
          ))}
        </Select>
        <Textarea label="Notes" value={tx.notes} onChange={(e) => setTx({ ...tx, notes: e.target.value })} />
      </Modal>
    </div>
  );
}
