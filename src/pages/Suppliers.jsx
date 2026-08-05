import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { supplierService } from "../services/SupplierService";
import { DIRECTORY_EXPORT_TYPES } from "../utils/directoryExport/definitions";
import { useSettingsStore } from "../contexts/store";
import { useDebounce } from "../hooks/usePagination";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { ITEMS_PER_PAGE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import DirectoryExportButtons from "../components/common/DirectoryExportButtons";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { Input, Textarea } from "../components/common/Input";
import { StatCard, Card } from "../components/common/Card";
import { LoadingSpinner, Alert } from "../components/common/Loading";
import SupplierAccountModal from "../components/suppliers/SupplierAccountModal";
import { required, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";
import { formatCurrency } from "../utils/format";

const emptyForm = { company: "", contact_person: "", phone: "", email: "", address: "" };
const FORM_ID = "supplier-form";

export default function Suppliers() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const { submitting, guard } = useSubmitGuard();
  const [suppliers, setSuppliers] = useState([]);
  const [globalSummary, setGlobalSummary] = useState({ total_pending: 0, suppliers_with_balance: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [accountSupplier, setAccountSupplier] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [listError, setListError] = useState("");
  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, summary] = await Promise.all([
        supplierService.getAllWithBalances({ search: debouncedSearch, page, limit: ITEMS_PER_PAGE }),
        supplierService.getGlobalSummary(),
      ]);
      setSuppliers(result.items);
      setTotal(result.total);
      setGlobalSummary(summary);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({
      company: s.company,
      contact_person: s.contact_person || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
    });
    setErrors({});
    setModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this supplier?")) return;
    setListError("");
    try {
      await supplierService.delete(id);
      load();
    } catch (err) {
      setListError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validation = runFormValidation({ company: required(form.company, "Company") });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await guard(async () => {
        if (editing) await supplierService.update(editing.id, form);
        else await supplierService.create(form);
        setModalOpen(false);
        setErrors({});
        load();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "company", label: "Supplier" },
    { key: "phone", label: "Phone", render: (r) => r.phone || "-" },
    {
      key: "total_delivered",
      label: "Delivered",
      render: (r) => formatCurrency(r.total_delivered || 0, currency),
    },
    {
      key: "total_paid",
      label: "Paid",
      render: (r) => formatCurrency(r.total_paid || 0, currency),
    },
    {
      key: "balance_pending",
      label: "Pending",
      render: (r) => (
        <span style={{ fontWeight: r.balance_pending > 0 ? 700 : 400, color: r.balance_pending > 0 ? "var(--color-danger)" : undefined }}>
          {formatCurrency(r.balance_pending || 0, currency)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" title="View account" className="btn-icon" onClick={() => setAccountSupplier(row)}>
            <Wallet size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openEdit(row)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => handleDelete(row.id)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Supplier Accounts"
        subtitle="Track supplier deliveries, pending balances, and payments when they collect cash."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Supplier
          </Button>
        }
      />

      <Card className="directory-export-card" style={{ marginBottom: "1.25rem" }}>
        <DirectoryExportButtons
          type={DIRECTORY_EXPORT_TYPES.SUPPLIERS}
          search={debouncedSearch}
          label="Supplier directory"
        />
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <StatCard
          label="Total pending (all suppliers)"
          value={formatCurrency(globalSummary.total_pending, currency)}
          icon={Wallet}
          variant={globalSummary.total_pending > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Suppliers with balance"
          value={String(globalSummary.suppliers_with_balance)}
          variant="warning"
        />
      </div>

      {listError && <Alert>{listError}</Alert>}

      <div style={{ marginBottom: "1rem" }}>
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search suppliers..."
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Table columns={columns} data={suppliers} emptyMessage="No suppliers yet" />
          <Pagination page={page} totalPages={Math.ceil(total / ITEMS_PER_PAGE)} total={total} onPageChange={setPage} />
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={editing ? "Edit Supplier" : "Add Supplier"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormValidationAlert errors={errors} />
          <div className="form-row">
            <Input
              label="Company *"
              value={form.company}
              onChange={(e) => {
                setForm({ ...form, company: e.target.value });
                setErrors((p) => ({ ...p, company: undefined, form: undefined }));
              }}
              error={errors.company}
            />
            <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </form>
      </Modal>

      <SupplierAccountModal
        supplier={accountSupplier}
        currency={currency}
        isOpen={!!accountSupplier}
        onClose={() => setAccountSupplier(null)}
        onUpdated={load}
      />
    </div>
  );
}
