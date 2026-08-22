import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { accountingService } from "../services/AccountingService";
import { useSettingsStore } from "../contexts/store";
import { friendlyAccountLabel, isAccountingEnabled, PARTNER_TX_TYPES } from "../utils/accounting";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Modal from "../components/common/Modal";
import { Input, Select, Textarea } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/Loading";
import FormValidationAlert from "../components/common/FormValidationAlert";
import AccountingGate from "../components/common/AccountingGate";
import { formatCurrency, formatDbError, todayISO } from "../utils/format";
import { notify } from "../utils/notify";
import { required, runFormValidation, FORM_VALIDATION_MESSAGE } from "../utils/validation";
import "./AccountingHub.css";

const EMPTY_PARTNER = {
  name: "",
  phone: "",
  ownership_percent: "",
  profit_share_percent: "",
  initial_capital: "",
  notes: "",
};

const PARTNER_FORM_ID = "partner-form";
const TX_FORM_ID = "partner-tx-form";

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
  const [errors, setErrors] = useState({});
  const [txErrors, setTxErrors] = useState({});
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
      setCashAccountId((current) => current || String(accounts[0]?.id || ""));
    } catch (err) {
      notify.error(formatDbError(err) || "Could not load partners.", { title: "Load failed" });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_PARTNER);
    setErrors({});
    setModalOpen(true);
  }

  function openTx(partner) {
    setSelected(partner);
    setTx({ type: "additional_capital", amount: "", notes: "", entry_date: todayISO() });
    setTxErrors({});
    setTxOpen(true);
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    const validation = runFormValidation({
      name: required(form.name, "Partner name"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      notify.warning(FORM_VALIDATION_MESSAGE, { title: "Missing name" });
      return;
    }

    const capital = Number(form.initial_capital) || 0;
    if (capital > 0 && !cashAccountId) {
      setErrors({ form: "Choose where the starting money went (cash or bank)." });
      notify.warning("Choose cash or bank for the starting money.", { title: "Cash account needed" });
      return;
    }

    try {
      const outcome = await guard(async () =>
        accountingService.createPartner({
          ...form,
          initial_capital: capital,
          cash_account_id: cashAccountId ? Number(cashAccountId) : null,
          entry_date: todayISO(),
        })
      );
      if (outcome?.skipped) return;

      setModalOpen(false);
      setErrors({});
      setForm(EMPTY_PARTNER);
      const created = outcome?.result;
      const name = created?.name || form.name.trim();
      notify.success(
        capital > 0
          ? `Partner "${name}" was added with ${formatCurrency(capital, currency)} starting capital.`
          : `Partner "${name}" was added.`,
        { title: "Partner created" }
      );
      await load();
    } catch (err) {
      const message = formatDbError(err) || "Could not add this partner.";
      setErrors({ form: message });
      notify.error(message, { title: "Could not add partner" });
    }
  }

  async function handleTransaction(e) {
    e?.preventDefault?.();
    const validation = runFormValidation({
      amount: required(tx.amount, "Amount"),
    });
    if (!validation.isValid) {
      setTxErrors(validation.errors);
      notify.warning("Enter the amount.", { title: "Missing amount" });
      return;
    }
    if (Number(tx.amount) <= 0) {
      setTxErrors({ amount: "Amount must be greater than zero", form: FORM_VALIDATION_MESSAGE });
      notify.warning("Amount must be greater than zero.", { title: "Invalid amount" });
      return;
    }
    if (!cashAccountId) {
      setTxErrors({ form: "Choose a cash or bank account." });
      notify.warning("Choose cash or bank.", { title: "Account needed" });
      return;
    }

    try {
      const outcome = await guard(async () =>
        accountingService.recordPartnerTransaction({
          partnerId: selected.id,
          type: tx.type,
          amount: Number(tx.amount),
          cashAccountId: Number(cashAccountId) || null,
          entryDate: tx.entry_date,
          notes: tx.notes,
        })
      );
      if (outcome?.skipped) return;

      setTxOpen(false);
      setTxErrors({});
      notify.success(`Transaction saved for ${selected.name}.`, { title: "Transaction posted" });
      await load();
    } catch (err) {
      const message = formatDbError(err) || "Could not save this transaction.";
      setTxErrors({ form: message });
      notify.error(message, { title: "Could not post" });
    }
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
        subtitle="Partners put money in, take money out, and share profit."
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
          <Table columns={columns} data={partners} emptyMessage="No partners yet. Tap Add partner to create the first one." />
        )}
      </AccountingGate>

      <Modal
        isOpen={modalOpen}
        title="Add partner"
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" form={PARTNER_FORM_ID} disabled={submitting}>
              {submitting ? "Saving..." : "Save partner"}
            </Button>
          </>
        }
      >
        <form id={PARTNER_FORM_ID} onSubmit={handleCreate} noValidate>
          <FormValidationAlert errors={errors} />
          <p className="acct-hint">Name is required. Starting money is optional — add it only if they already put cash in the shop.</p>
          <Input
            label="Partner name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            placeholder="e.g. Ahmed"
            autoFocus
          />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            label={`Starting money (${currency})`}
            type="number"
            min={0}
            step="0.01"
            value={form.initial_capital}
            onChange={(e) => setForm({ ...form, initial_capital: e.target.value })}
            placeholder="0"
          />
          {Number(form.initial_capital) > 0 ? (
            <Select label="Put starting money into" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
              <option value="">Select cash or bank</option>
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>{friendlyAccountLabel(account)}</option>
              ))}
            </Select>
          ) : null}
          <Input label="Ownership %" type="number" min={0} max={100} value={form.ownership_percent} onChange={(e) => setForm({ ...form, ownership_percent: e.target.value })} placeholder="0" />
          <Input label="Profit share %" type="number" min={0} max={100} value={form.profit_share_percent} onChange={(e) => setForm({ ...form, profit_share_percent: e.target.value })} placeholder="0" />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </form>
      </Modal>

      <Modal
        isOpen={txOpen}
        title={selected ? `Transaction — ${selected.name}` : "Transaction"}
        onClose={() => !submitting && setTxOpen(false)}
        closeOnOverlay={!submitting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTxOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" form={TX_FORM_ID} disabled={submitting}>
              {submitting ? "Saving..." : "Save transaction"}
            </Button>
          </>
        }
      >
        <form id={TX_FORM_ID} onSubmit={handleTransaction} noValidate>
          <FormValidationAlert errors={txErrors} />
          <Select label="Type" value={tx.type} onChange={(e) => setTx({ ...tx, type: e.target.value })}>
            {PARTNER_TX_TYPES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </Select>
          <Input
            label={`Amount (${currency}) *`}
            type="number"
            min={0}
            step="0.01"
            value={tx.amount}
            onChange={(e) => setTx({ ...tx, amount: e.target.value })}
            error={txErrors.amount}
          />
          <Input label="Date" type="date" value={tx.entry_date} onChange={(e) => setTx({ ...tx, entry_date: e.target.value })} />
          <Select label="Cash / bank" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
            <option value="">Select cash or bank</option>
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>{friendlyAccountLabel(account)}</option>
            ))}
          </Select>
          <Textarea label="Notes" value={tx.notes} onChange={(e) => setTx({ ...tx, notes: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
