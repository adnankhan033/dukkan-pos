import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { categoryService } from "../services/CategoryService";
import { useDebounce } from "../hooks/usePagination";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { useConfirm } from "../hooks/useConfirm";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");
  const debouncedSearch = useDebounce(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await categoryService.getAll({ search: debouncedSearch }));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function handleDelete(category) {
    setAlert("");

    const productCount = await categoryService.getProductCount(category.id);
    const message =
      productCount > 0
        ? `"${category.name}" has ${productCount} product(s). They will be unassigned (not deleted). Continue?`
        : `Delete "${category.name}" permanently? This cannot be undone.`;

    const ok = await confirm({
      title: "Delete Category",
      message,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await categoryService.delete(category.id, { unassignProducts: productCount > 0 });
      await load();
    } catch (err) {
      setAlert(err.message || "Delete failed");
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
        await load();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "description", label: "Description", render: (r) => r.description || "-" },
    {
      key: "product_count",
      label: "Products",
      render: (r) => (
        <Badge variant={Number(r.product_count) > 0 ? "info" : "neutral"}>
          {Number(r.product_count ?? 0)}
        </Badge>
      ),
    },
    { key: "created_at", label: "Created", render: (r) => formatDateTime(r.created_at) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="table-actions">
          <Button variant="ghost" size="sm" className="btn-icon" onClick={() => openEdit(row)}>
            <Pencil size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="btn-icon"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize products into categories. Search by name or description."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Category
          </Button>
        }
      />
      {alert && <Alert>{alert}</Alert>}

      <div className="page-header-actions" style={{ marginBottom: "1rem" }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search categories by name or description..."
        />
        {!loading && (
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </span>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Table
          columns={columns}
          data={categories}
          emptyMessage={debouncedSearch ? `No categories match "${debouncedSearch}"` : "No categories yet"}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={editing ? "Edit Category" : "Add Category"}
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
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setErrors((p) => ({ ...p, name: undefined, form: undefined }));
            }}
            error={errors.name}
          />
          <div style={{ marginTop: "1rem" }}>
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
      {confirmDialog}
    </div>
  );
}
