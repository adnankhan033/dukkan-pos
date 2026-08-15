import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { unitService } from "../services/UnitService";
import { useDebounce } from "../hooks/usePagination";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { useConfirm } from "../hooks/useConfirm";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import { Input } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/Loading";
import { notify } from "../utils/notify";
import { required, runFormValidation, FORM_VALIDATION_MESSAGE } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";
import { formatDateTime, formatDbError } from "../utils/format";

const emptyForm = { name: "", symbol: "", example: "" };
const FORM_ID = "unit-form";

export default function Units() {
  const { submitting, guard } = useSubmitGuard();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const debouncedSearch = useDebounce(search);

  const load = useCallback(async ({ silent = false, search: searchOverride } = {}) => {
    if (!silent) setLoading(true);
    try {
      const term = searchOverride !== undefined ? searchOverride : debouncedSearch;
      setUnits(await unitService.getAll({ search: term }));
    } catch (err) {
      setUnits([]);
      notify.error(formatDbError(err) || "Failed to load units", { title: "Load failed" });
    } finally {
      if (!silent) setLoading(false);
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

  function openEdit(unit) {
    setEditing(unit);
    setForm({
      name: unit.name,
      symbol: unit.symbol,
      example: unit.example || "",
    });
    setErrors({});
    setModalOpen(true);
  }

  async function handleDelete(unit) {
    const productCount = await unitService.getProductCount(unit.id);
    const message =
      productCount > 0
        ? `"${unit.name} (${unit.symbol})" is used by ${productCount} product(s). They will be reassigned to the default unit (pcs). Continue?`
        : `Delete "${unit.name} (${unit.symbol})" permanently?`;

    const ok = await confirm({
      title: "Delete Unit",
      message,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await unitService.delete(unit.id, { unassignProducts: productCount > 0 });
      await load();
      notify.success(`Unit "${unit.name}" deleted.`, { title: "Unit deleted" });
    } catch (err) {
      notify.error(formatDbError(err) || "Delete failed", { title: "Delete failed" });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      example: form.example.trim(),
    };

    const validation = runFormValidation({
      name: required(payload.name, "Unit name"),
      symbol: required(payload.symbol, "Symbol"),
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      const outcome = await guard(async () => {
        if (editing) return unitService.update(editing.id, payload);
        return unitService.create(payload);
      });

      if (outcome?.skipped) return;

      setModalOpen(false);
      setErrors({});
      notify.success(
        `Unit "${payload.name}" (${payload.symbol}) ${editing ? "updated" : "created"}.`,
        { title: editing ? "Unit updated" : "Unit created" }
      );
      if (!editing) setSearch("");

      try {
        await load({ silent: true, search: editing ? undefined : "" });
      } catch (loadErr) {
        notify.warning(formatDbError(loadErr) || "Unit saved, but the list failed to refresh.", {
          title: "Refresh delayed",
        });
      }
    } catch (err) {
      const msg = formatDbError(err);
      if (/unique|already exists/i.test(msg)) {
        setErrors({ symbol: msg, form: FORM_VALIDATION_MESSAGE });
      } else {
        setErrors({ form: msg || "Failed to save unit" });
      }
    }
  }

  const columns = [
    { key: "name", label: "Unit" },
    {
      key: "symbol",
      label: "Symbol",
      render: (r) => <Badge variant="info">{r.symbol}</Badge>,
    },
    { key: "example", label: "Example", render: (r) => r.example || "-" },
    {
      key: "product_count",
      label: "Products",
      render: (r) => (
        <Badge variant={Number(r.product_count) > 0 ? "success" : "neutral"}>
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
        title="Units"
        subtitle="Manage product measurement units and symbols (pcs, kg, L, box, etc.)."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Unit
          </Button>
        }
      />

      <div className="page-header-actions" style={{ marginBottom: "1rem" }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search units by name, symbol, or example..."
        />
        {!loading && (
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
            {units.length} unit{units.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <Table
          columns={columns}
          data={units}
          emptyMessage={debouncedSearch ? `No units match "${debouncedSearch}"` : "No units yet"}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={editing ? "Edit Unit" : "Add Unit"}
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
            label="Unit name *"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setErrors((p) => ({ ...p, name: undefined, form: undefined }));
            }}
            error={errors.name}
            placeholder="e.g. Kilogram"
            autoFocus
          />
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Symbol *"
              value={form.symbol}
              onChange={(e) => {
                setForm({ ...form, symbol: e.target.value });
                setErrors((p) => ({ ...p, symbol: undefined, form: undefined }));
              }}
              error={errors.symbol}
              placeholder="e.g. kg"
              maxLength={20}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Example products"
              value={form.example}
              onChange={(e) => setForm({ ...form, example: e.target.value })}
              placeholder="e.g. Rice, Sugar"
            />
          </div>
        </form>
      </Modal>
      {confirmDialog}
    </div>
  );
}
