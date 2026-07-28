import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { categoryService } from "../services/CategoryService";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Table from "../components/common/Table";
import Modal from "../components/common/Modal";
import { Input, Textarea } from "../components/common/Input";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { required, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";
import { formatDateTime } from "../utils/format";

const emptyForm = { name: "", description: "" };

const FORM_ID = "category-form";

export default function Categories() {
  const { submitting, guard } = useSubmitGuard();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");

  async function load() {
    setLoading(true);
    try {
      setCategories(await categoryService.getAll());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(cat) {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || "" });
    setErrors({});
    setModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this category?")) return;
    try {
      await categoryService.delete(id);
      load();
    } catch (err) {
      setAlert(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validation = runFormValidation({ name: required(form.name, "Name") });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await guard(async () => {
        if (editing) await categoryService.update(editing.id, form);
        else await categoryService.create(form);
        setModalOpen(false);
        setErrors({});
        setCategories(await categoryService.getAll());
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "description", label: "Description", render: (r) => r.description || "-" },
    { key: "created_at", label: "Created", render: (r) => formatDateTime(r.created_at) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="table-actions">
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
      <PageHeader title="Categories" subtitle="Organize products into categories." actions={
        <Button onClick={openCreate}><Plus size={16} /> Add Category</Button>
      } />
      {alert && <Alert>{alert}</Alert>}
      {loading ? <LoadingSpinner /> : <Table columns={columns} data={categories} />}
      <Modal isOpen={modalOpen} onClose={() => !submitting && setModalOpen(false)} closeOnOverlay={!submitting} title={editing ? "Edit Category" : "Add Category"}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button><Button type="submit" form={FORM_ID} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button></>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate>
          <FormValidationAlert errors={errors} />
          <Input label="Name *" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((p) => ({ ...p, name: undefined, form: undefined })); }} error={errors.name} />
          <div style={{ marginTop: "1rem" }}>
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
