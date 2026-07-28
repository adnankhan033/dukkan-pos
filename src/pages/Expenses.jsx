import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { expenseService } from "../services/ExpenseService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { ITEMS_PER_PAGE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { Input, Textarea } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatDate, todayISO } from "../utils/format";
import { required, positiveNumber, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";

const emptyForm = { name: "", amount: "", expense_date: todayISO(), notes: "" };

const FORM_ID = "expense-form";

export default function Expenses() {
  const { submitting, guard } = useSubmitGuard();
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await expenseService.getAll({ page, limit: ITEMS_PER_PAGE });
      setExpenses(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm({ ...emptyForm, expense_date: todayISO() }); setErrors({}); setModalOpen(true); }
  function openEdit(e) { setEditing(e); setForm({ name: e.name, amount: String(e.amount), expense_date: e.expense_date, notes: e.notes || "" }); setErrors({}); setModalOpen(true); }

  async function handleDelete(id) {
    if (!confirm("Delete this expense?")) return;
    await expenseService.delete(id);
    load();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validation = runFormValidation({
      name: required(form.name, "Name"),
      amount: positiveNumber(form.amount, "Amount"),
      expense_date: required(form.expense_date, "Date"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await guard(async () => {
        if (editing) await expenseService.update(editing.id, form);
        else await expenseService.create(form);
        setModalOpen(false);
        setErrors({});
        load();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "name", label: "Expense" },
    { key: "amount", label: "Amount", render: (r) => formatCurrency(r.amount, currency) },
    { key: "expense_date", label: "Date", render: (r) => formatDate(r.expense_date) },
    { key: "notes", label: "Notes", render: (r) => r.notes || "-" },
    {
      key: "actions", label: "Actions",
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openEdit(row)}><Pencil size={16} /></Button>
          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleDelete(row.id)}><Trash2 size={16} /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Track business expenses." actions={<Button onClick={openCreate}><Plus size={16} /> Add Expense</Button>} />
      {loading ? <LoadingSpinner /> : (
        <>
          <Table columns={columns} data={expenses} />
          <Pagination page={page} totalPages={Math.ceil(total / ITEMS_PER_PAGE)} total={total} onPageChange={setPage} />
        </>
      )}
      <Modal isOpen={modalOpen} onClose={() => !submitting && setModalOpen(false)} closeOnOverlay={!submitting} title={editing ? "Edit Expense" : "Add Expense"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button><Button type="submit" form={FORM_ID} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button></>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormValidationAlert errors={errors} />
          <div className="form-row">
            <Input label="Expense Name *" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((p) => ({ ...p, name: undefined, form: undefined })); }} error={errors.name} />
            <Input label="Amount *" type="number" step="0.01" min={0} value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setErrors((p) => ({ ...p, amount: undefined, form: undefined })); }} error={errors.amount} />
            <Input label="Date *" type="date" value={form.expense_date} onChange={(e) => { setForm({ ...form, expense_date: e.target.value }); setErrors((p) => ({ ...p, expense_date: undefined, form: undefined })); }} error={errors.expense_date} />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
