import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, Banknote, CreditCard, Wallet, Smartphone } from "lucide-react";
import { paymentMethodService } from "../../services/PaymentMethodService";
import { useSubmitGuard } from "../../hooks/useSubmitGuard";
import { useConfirm } from "../../hooks/useConfirm";
import { Card } from "../common/Card";
import Button from "../common/Button";
import Table from "../common/Table";
import Modal from "../common/Modal";
import { Input, Select } from "../common/Input";
import Badge from "../common/Badge";
import { LoadingSpinner } from "../common/Loading";
import { notify } from "../../utils/notify";
import { required, runFormValidation } from "../../utils/validation";
import FormValidationAlert from "../common/FormValidationAlert";
import { formatDbError } from "../../utils/format";

const ICON_OPTIONS = [
  { id: "banknote", label: "Cash / Banknote" },
  { id: "credit-card", label: "Card" },
  { id: "wallet", label: "Wallet" },
  { id: "smartphone", label: "Mobile / QR" },
];

function PaymentMethodIcon({ icon, size = 16 }) {
  if (icon === "credit-card") return <CreditCard size={size} />;
  if (icon === "smartphone") return <Smartphone size={size} />;
  if (icon === "wallet") return <Wallet size={size} />;
  return <Banknote size={size} />;
}

const emptyForm = {
  label: "",
  label_ar: "",
  code: "",
  icon: "wallet",
  collect_cash: false,
  is_active: true,
  is_default: false,
  sort_order: 0,
};

const FORM_ID = "payment-method-form";

export default function PaymentMethodsPanel() {
  const { submitting, guard } = useSubmitGuard();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMethods(await paymentMethodService.getAll({ includeInactive: true }));
    } catch (err) {
      setMethods([]);
      notify.error(formatDbError(err) || "Failed to load payment methods", { title: "Load failed" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      sort_order: methods.length,
    });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(method) {
    setEditing(method);
    setForm({
      label: method.label,
      label_ar: method.label_ar || "",
      code: method.code,
      icon: method.icon || "wallet",
      collect_cash: method.collect_cash === 1,
      is_active: method.is_active === 1,
      is_default: method.is_default === 1,
      sort_order: method.sort_order ?? 0,
    });
    setErrors({});
    setModalOpen(true);
  }

  async function handleSetDefault(method) {
    try {
      await paymentMethodService.setDefault(method.id);
      await load();
      notify.success(`"${method.label}" is now the default POS payment method.`, {
        title: "Default updated",
      });
    } catch (err) {
      notify.error(err.message, { title: "Could not update default" });
    }
  }

  async function handleDelete(method) {
    const ok = await confirm({
      title: "Delete Payment Method",
      message: `Delete "${method.label}" permanently?`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await paymentMethodService.delete(method.id);
      await load();
      notify.success(`"${method.label}" deleted.`, { title: "Payment method deleted" });
    } catch (err) {
      notify.error(err.message, { title: "Delete failed" });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      label: form.label.trim(),
      label_ar: form.label_ar.trim(),
      code: form.code.trim(),
      icon: form.icon,
      collect_cash: form.collect_cash,
      is_active: form.is_active,
      is_default: form.is_default,
      sort_order: Number(form.sort_order) || 0,
    };

    const validation = runFormValidation({
      label: required(payload.label, "Name"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await guard(async () => {
        if (editing) {
          await paymentMethodService.update(editing.id, payload);
        } else {
          await paymentMethodService.create(payload);
        }
      });
      setModalOpen(false);
      setErrors({});
      await load();
      notify.success(editing ? "Payment method updated." : "Payment method created.", {
        title: editing ? "Updated" : "Created",
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    {
      key: "label",
      label: "Method",
      render: (row) => (
        <span className="payment-method-name">
          <PaymentMethodIcon icon={row.icon} size={15} />
          <span>
            <strong>{row.label}</strong>
            {row.label_ar ? <small dir="rtl">{row.label_ar}</small> : null}
          </span>
        </span>
      ),
    },
    {
      key: "code",
      label: "Code",
      render: (row) => <code>{row.code}</code>,
    },
    {
      key: "collect_cash",
      label: "Checkout",
      render: (row) =>
        row.collect_cash ? (
          <Badge variant="success">Cash input</Badge>
        ) : (
          <Badge variant="info">Fixed amount</Badge>
        ),
    },
    {
      key: "is_default",
      label: "Default",
      render: (row) =>
        row.is_default ? (
          <Badge variant="warning">Default</Badge>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => handleSetDefault(row)}>
            <Star size={14} /> Set default
          </Button>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (row) => (
        <Badge variant={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="table-actions">
          <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil size={14} />
          </Button>
          {!row.is_system ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(row)}>
              <Trash2 size={14} />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card className="settings-card">
        <div className="settings-permissions-header">
          <div>
            <h3 className="settings-section-title">Payment Methods</h3>
            <p className="settings-section-desc">
              Configure how cashiers collect payment on POS. Cash and Card are included by default.
              Active methods appear as tabs above the Complete Sale button.
            </p>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus size={16} /> Add Method
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading payment methods…" />
        ) : (
          <Table columns={columns} data={methods} emptyMessage="No payment methods configured." />
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Payment Method" : "Add Payment Method"}
        size="md"
      >
        <form id={FORM_ID} onSubmit={handleSubmit}>
          <FormValidationAlert error={errors.form} />
          <Input
            label="Name (English)"
            value={form.label}
            onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
            error={errors.label}
            autoFocus
          />
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Name (Arabic)"
              value={form.label_ar}
              onChange={(e) => setForm((prev) => ({ ...prev, label_ar: e.target.value }))}
              dir="rtl"
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder={editing ? editing.code : "Auto-generated from name"}
              disabled={Boolean(editing?.is_system)}
            />
            <p className="settings-section-desc" style={{ marginTop: "0.35rem" }}>
              {editing?.is_system
                ? "Built-in method codes cannot be changed."
                : "Stored on invoices and reports. Leave empty to auto-generate."}
            </p>
          </div>
          <div className="form-row" style={{ marginTop: "1rem" }}>
            <Select
              label="Icon"
              value={form.icon}
              onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
            >
              {ICON_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Sort order"
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </div>
          <label className="settings-check" style={{ marginTop: "1rem" }}>
            <input
              type="checkbox"
              checked={form.collect_cash}
              onChange={(e) => setForm((prev) => ({ ...prev, collect_cash: e.target.checked }))}
            />
            Show cash received / change fields on POS
          </label>
          <label className="settings-check" style={{ marginTop: "0.75rem" }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            Active on POS
          </label>
          <label className="settings-check" style={{ marginTop: "0.75rem" }}>
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))}
            />
            Default method when opening POS
          </label>
          <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Save Changes" : "Create Method"}
            </Button>
          </div>
        </form>
      </Modal>

      {confirmDialog}
    </>
  );
}
