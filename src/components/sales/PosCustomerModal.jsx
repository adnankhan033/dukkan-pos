import { useEffect, useState } from "react";
import { customerService } from "../../services/CustomerService";
import { useSubmitGuard } from "../../hooks/useSubmitGuard";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Input, Textarea } from "../common/Input";
import FormValidationAlert from "../common/FormValidationAlert";
import { required, email, runFormValidation } from "../../utils/validation";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };
const FORM_ID = "pos-customer-form";

export default function PosCustomerModal({ isOpen, initialName = "", onClose, onSaved }) {
  const { submitting, guard } = useSubmitGuard();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...emptyForm, name: String(initialName || "").trim() });
    setErrors({});
  }, [isOpen, initialName]);

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
        const created = await customerService.create({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          notes: form.notes.trim(),
        });
        onSaved?.(created);
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose?.()}
      closeOnOverlay={!submitting}
      title="Add Customer"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={submitting}>
            {submitting ? "Saving…" : "Save Customer"}
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
            setForm((prev) => ({ ...prev, name: e.target.value }));
            setErrors((prev) => ({ ...prev, name: undefined, form: undefined }));
          }}
          error={errors.name}
          autoFocus
        />
        <div className="form-row" style={{ marginTop: "1rem" }}>
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, email: e.target.value }));
              setErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
            }}
            error={errors.email}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <Textarea
            label="Address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </form>
    </Modal>
  );
}
