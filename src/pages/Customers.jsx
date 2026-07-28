import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { customerService } from "../services/CustomerService";
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
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { required, email, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };

const FORM_ID = "customer-form";

export default function Customers() {
  const { submitting, guard } = useSubmitGuard();
  const [customers, setCustomers] = useState([]);
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
      const result = await customerService.getAll({ search: debouncedSearch, page, limit: ITEMS_PER_PAGE });
      setCustomers(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(emptyForm); setErrors({}); setModalOpen(true); }
  function openEdit(c) { setEditing(c); setForm({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", notes: c.notes || "" }); setErrors({}); setModalOpen(true); }

  async function handleDelete(id) {
    if (!confirm("Delete this customer?")) return;
    await customerService.delete(id);
    load();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validation = runFormValidation({
      name: required(form.name, "Name"),
      email: email(form.email),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await guard(async () => {
        if (editing) await customerService.update(editing.id, form);
        else await customerService.create(form);
        setModalOpen(false);
        setErrors({});
        load();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone", render: (r) => r.phone || "-" },
    { key: "email", label: "Email", render: (r) => r.email || "-" },
    { key: "address", label: "Address", render: (r) => r.address || "-" },
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
      <PageHeader title="Customers" subtitle="Manage customer records." actions={<Button onClick={openCreate}><Plus size={16} /> Add Customer</Button>} />
      <div style={{ marginBottom: "1rem" }}>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search customers..." />
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          <Table columns={columns} data={customers} />
          <Pagination page={page} totalPages={Math.ceil(total / ITEMS_PER_PAGE)} total={total} onPageChange={setPage} />
        </>
      )}
      <Modal isOpen={modalOpen} onClose={() => !submitting && setModalOpen(false)} closeOnOverlay={!submitting} title={editing ? "Edit Customer" : "Add Customer"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button><Button type="submit" form={FORM_ID} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button></>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormValidationAlert errors={errors} />
          <div className="form-row">
            <Input label="Name *" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((p) => ({ ...p, name: undefined, form: undefined })); }} error={errors.name} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors((p) => ({ ...p, email: undefined, form: undefined })); }} error={errors.email} />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div style={{ marginTop: "1rem" }}>
              <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
