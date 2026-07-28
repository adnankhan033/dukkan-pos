import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supplierService } from "../services/SupplierService";
import { useDebounce } from "../hooks/usePagination";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { ITEMS_PER_PAGE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { Input, Textarea } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/Loading";
import { required, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";

const emptyForm = { company: "", contact_person: "", phone: "", email: "", address: "" };

const FORM_ID = "supplier-form";

export default function Suppliers() {
  const { submitting, guard } = useSubmitGuard();
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await supplierService.getAll({ search: debouncedSearch, page, limit: ITEMS_PER_PAGE });
      setSuppliers(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(emptyForm); setErrors({}); setModalOpen(true); }
  function openEdit(s) { setEditing(s); setForm({ company: s.company, contact_person: s.contact_person || "", phone: s.phone || "", email: s.email || "", address: s.address || "" }); setErrors({}); setModalOpen(true); }

  async function handleDelete(id) {
    if (!confirm("Delete this supplier?")) return;
    await supplierService.delete(id);
    load();
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
    { key: "company", label: "Company" },
    { key: "contact_person", label: "Contact", render: (r) => r.contact_person || "-" },
    { key: "phone", label: "Phone", render: (r) => r.phone || "-" },
    { key: "email", label: "Email", render: (r) => r.email || "-" },
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
      <PageHeader title="Suppliers" subtitle="Manage supplier records." actions={<Button onClick={openCreate}><Plus size={16} /> Add Supplier</Button>} />
      <div style={{ marginBottom: "1rem" }}>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search suppliers..." />
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <Table columns={columns} data={suppliers} />
          <Pagination page={page} totalPages={Math.ceil(total / ITEMS_PER_PAGE)} total={total} onPageChange={setPage} />
        </>
      )}
      <Modal isOpen={modalOpen} onClose={() => !submitting && setModalOpen(false)} closeOnOverlay={!submitting} title={editing ? "Edit Supplier" : "Add Supplier"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button><Button type="submit" form={FORM_ID} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button></>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormValidationAlert errors={errors} />
          <div className="form-row">
            <Input label="Company *" value={form.company} onChange={(e) => { setForm({ ...form, company: e.target.value }); setErrors((p) => ({ ...p, company: undefined, form: undefined })); }} error={errors.company} />
            <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
