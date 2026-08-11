import { useEffect, useState } from "react";
import {
  Banknote,
  Calendar,
  Camera,
  Pencil,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Badge from "../common/Badge";
import { Input, Textarea } from "../common/Input";
import { PAYMENT_TYPES, employeeService } from "../../services/EmployeeService";
import { compressImageFile } from "../../utils/image";
import { formatCurrency, formatDate } from "../../utils/format";
import { todayISO } from "../../utils/subscriptions";
import { required, positiveNumber, runFormValidation } from "../../utils/validation";
import FormValidationAlert from "../common/FormValidationAlert";
import "./EmployeeDetailModal.css";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "salaries", label: "Salaries" },
  { id: "advances", label: "Advances" },
];

function buildPaymentForm() {
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  return {
    amount: "",
    salary_date: todayISO(),
    period_label: monthLabel,
    notes: "",
  };
}

function paymentFormFromRecord(item) {
  return {
    amount: String(item.amount ?? ""),
    salary_date: item.salary_date?.slice(0, 10) || todayISO(),
    period_label: item.period_label || "",
    notes: item.notes || "",
  };
}

export default function EmployeeDetailModal({
  employee,
  currency,
  isOpen,
  onClose,
  onUpdated,
  onDeleted,
  submitting,
  guard,
}) {
  const [tab, setTab] = useState("profile");
  const [payroll, setPayroll] = useState(null);
  const [salaries, setSalaries] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");

  const [profileForm, setProfileForm] = useState(null);
  const [salaryForm, setSalaryForm] = useState(buildPaymentForm);
  const [advanceForm, setAdvanceForm] = useState(buildPaymentForm);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editPaymentForm, setEditPaymentForm] = useState(buildPaymentForm);

  useEffect(() => {
    if (!employee || !isOpen) return;
    setTab("profile");
    setAlert("");
    setErrors({});
    setEditingPaymentId(null);
    setProfileForm({
      full_name: employee.full_name || "",
      designation: employee.designation || "",
      phone: employee.phone || "",
      address: employee.address || "",
      iqama_number: employee.iqama_number || "",
      photo: employee.photo || "",
      start_date: employee.start_date || todayISO(),
      end_date: employee.end_date || "",
      is_current: Boolean(employee.is_current),
      notes: employee.notes || "",
    });
    loadPayrollData(employee.id);
  }, [employee, isOpen]);

  async function loadPayrollData(employeeId) {
    setLoading(true);
    try {
      const [summary, salaryRows, advanceRows] = await Promise.all([
        employeeService.getPayrollSummary(employeeId),
        employeeService.getPayments(employeeId, { paymentType: PAYMENT_TYPES.SALARY }),
        employeeService.getPayments(employeeId, { paymentType: PAYMENT_TYPES.ADVANCE }),
      ]);
      setPayroll(summary);
      setSalaries(salaryRows);
      setAdvances(advanceRows);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const photo = await compressImageFile(file);
      setProfileForm((prev) => ({ ...prev, photo }));
    } catch (err) {
      setAlert(err.message || "Failed to upload photo");
    }
  }

  async function saveProfile() {
    const validation = runFormValidation({
      full_name: required(profileForm.full_name, "Full name"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setAlert("");
    try {
      await guard(async () => {
        await employeeService.update(employee.id, profileForm);
        onUpdated("Profile updated successfully");
        onClose();
      });
    } catch (err) {
      setAlert(err.message || "Failed to save profile");
    }
  }

  async function submitPayment(paymentType) {
    const form = paymentType === PAYMENT_TYPES.ADVANCE ? advanceForm : salaryForm;
    const validation = runFormValidation({
      amount: positiveNumber(form.amount, "Amount"),
      salary_date: required(form.salary_date, "Date"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setAlert("");
    try {
      await guard(async () => {
        await employeeService.addPayment({
          employeeId: employee.id,
          amount: form.amount,
          salaryDate: form.salary_date,
          paymentType,
          periodLabel: paymentType === PAYMENT_TYPES.SALARY ? form.period_label : "",
          notes: form.notes,
        });
        if (paymentType === PAYMENT_TYPES.ADVANCE) {
          setAdvanceForm(buildPaymentForm());
        } else {
          setSalaryForm(buildPaymentForm());
        }
        setErrors({});
        await loadPayrollData(employee.id);
        onUpdated();
      });
    } catch (err) {
      setAlert(err.message || "Failed to save payment");
    }
  }

  async function removePayment(id) {
    if (!confirm("Delete this payment record and linked expense?")) return;
    setAlert("");
    try {
      await guard(async () => {
        await employeeService.deletePayment(id);
        if (editingPaymentId === id) setEditingPaymentId(null);
        await loadPayrollData(employee.id);
        onUpdated("Payment deleted successfully");
      });
    } catch (err) {
      setAlert(err.message || "Failed to delete payment");
    }
  }

  function startEditPayment(item) {
    setEditingPaymentId(item.id);
    setEditPaymentForm(paymentFormFromRecord(item));
    setErrors({});
    setAlert("");
  }

  function cancelEditPayment() {
    setEditingPaymentId(null);
    setErrors({});
  }

  async function saveEditPayment(paymentType) {
    const validation = runFormValidation({
      amount: positiveNumber(editPaymentForm.amount, "Amount"),
      salary_date: required(editPaymentForm.salary_date, "Date"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setAlert("");
    try {
      await guard(async () => {
        await employeeService.updatePayment(editingPaymentId, {
          amount: editPaymentForm.amount,
          salaryDate: editPaymentForm.salary_date,
          periodLabel: paymentType === PAYMENT_TYPES.SALARY ? editPaymentForm.period_label : "",
          notes: editPaymentForm.notes,
        });
        setEditingPaymentId(null);
        setErrors({});
        await loadPayrollData(employee.id);
        onUpdated(
          paymentType === PAYMENT_TYPES.ADVANCE
            ? "Advance updated successfully"
            : "Salary updated successfully"
        );
      });
    } catch (err) {
      setAlert(err.message || "Failed to update payment");
    }
  }

  function renderPaymentHistory(items, paymentType) {
    const isAdvance = paymentType === PAYMENT_TYPES.ADVANCE;

    if (loading) {
      return <p className="employee-empty-note">Loading...</p>;
    }

    if (items.length === 0) {
      return (
        <p className="employee-empty-note">
          {isAdvance ? "No advances recorded yet." : "No salary payments yet."}
        </p>
      );
    }

    return items.map((item) => {
      const isEditing = editingPaymentId === item.id;

      if (isEditing) {
        return (
          <div key={item.id} className={`employee-payment-row editing ${isAdvance ? "advance" : ""}`}>
            <div className="employee-payment-edit-form">
              <Input
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                value={editPaymentForm.amount}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })}
              />
              <Input
                label={isAdvance ? "Advance date" : "Payment date"}
                type="date"
                value={editPaymentForm.salary_date}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, salary_date: e.target.value })}
              />
              {!isAdvance && (
                <Input
                  label="Period"
                  value={editPaymentForm.period_label}
                  onChange={(e) => setEditPaymentForm({ ...editPaymentForm, period_label: e.target.value })}
                />
              )}
              <Input
                label="Notes"
                value={editPaymentForm.notes}
                onChange={(e) => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
              />
            </div>
            <div className="employee-payment-edit-actions">
              <Button variant="secondary" size="sm" onClick={cancelEditPayment} disabled={submitting}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => saveEditPayment(paymentType)} disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div key={item.id} className={`employee-payment-row ${isAdvance ? "advance" : ""}`}>
          <div>
            <strong>{formatCurrency(item.amount, currency)}</strong>
            <span>{isAdvance ? (item.notes || "Salary advance") : (item.period_label || "Salary payment")}</span>
            <span><Calendar size={12} /> {formatDate(item.salary_date)}</span>
          </div>
          <div className="employee-payment-actions">
            <button
              type="button"
              className="employee-payment-edit"
              title="Edit payment"
              onClick={() => startEditPayment(item)}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="employee-payment-delete"
              title="Delete payment"
              onClick={() => removePayment(item.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      );
    });
  }

  async function handleDeleteEmployee() {
    if (!confirm(`Delete ${employee.full_name} and all salary records?`)) return;
    try {
      await guard(async () => {
        await employeeService.delete(employee.id);
        onDeleted();
      });
    } catch (err) {
      setAlert(err.message || "Failed to delete employee");
    }
  }

  if (!employee || !profileForm) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlay={!submitting}
      title={employee.full_name}
      size="lg"
      footer={
        tab === "profile" ? (
          <>
            <Button variant="danger" onClick={handleDeleteEmployee} disabled={submitting}>
              Delete
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="secondary" onClick={onClose} disabled={submitting}>Close</Button>
            <Button onClick={saveProfile} disabled={submitting}>
              {submitting ? "Saving..." : "Save Profile"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>Close</Button>
          </>
        )
      }
    >
      <div className="employee-detail-header">
        <div className="employee-detail-avatar">
          {profileForm.photo ? (
            <img src={profileForm.photo} alt={employee.full_name} />
          ) : (
            <User size={28} />
          )}
        </div>
        <div className="employee-detail-summary">
          <Badge variant={profileForm.is_current ? "success" : "neutral"}>
            {profileForm.is_current ? "Currently working" : "Finished"}
          </Badge>
          {payroll && (
            <div className="employee-detail-stats">
              <span>Salary paid: {formatCurrency(payroll.salaryTotal, currency)}</span>
              <span>Advances: {formatCurrency(payroll.advanceTotal, currency)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="employee-detail-tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`employee-detail-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => {
              setTab(item.id);
              setErrors({});
              setAlert("");
              setEditingPaymentId(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {alert && <div className="employee-detail-alert">{alert}</div>}
      <FormValidationAlert errors={errors} />

      {tab === "profile" && (
        <div className="employee-profile-form">
          <label className="employee-photo-upload">
            <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
            <Camera size={18} />
            {profileForm.photo ? "Change photo" : "Upload photo"}
          </label>

          <Input
            label="Full name"
            value={profileForm.full_name}
            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
          />
          <Input
            label="Designation"
            placeholder="Cashier, Manager, Driver..."
            value={profileForm.designation}
            onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
          />
          <Input
            label="Phone number"
            value={profileForm.phone}
            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
          />
          <Input
            label="Address"
            value={profileForm.address}
            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
          />
          <Input
            label="Iqama number"
            value={profileForm.iqama_number}
            onChange={(e) => setProfileForm({ ...profileForm, iqama_number: e.target.value })}
          />

          <div className="employee-date-section">
            <Input
              label="Start date"
              type="date"
              value={profileForm.start_date}
              onChange={(e) => setProfileForm({ ...profileForm, start_date: e.target.value })}
            />
            <label className="employee-current-checkbox">
              <input
                type="checkbox"
                checked={profileForm.is_current}
                onChange={(e) => setProfileForm({
                  ...profileForm,
                  is_current: e.target.checked,
                  end_date: e.target.checked ? "" : profileForm.end_date || todayISO(),
                })}
              />
              Currently working
            </label>
            {!profileForm.is_current && (
              <Input
                label="End date"
                type="date"
                value={profileForm.end_date}
                onChange={(e) => setProfileForm({ ...profileForm, end_date: e.target.value })}
              />
            )}
          </div>

          <Textarea
            label="Notes"
            value={profileForm.notes}
            onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
          />
        </div>
      )}

      {tab === "salaries" && (
        <div className="employee-payroll-section">
          <div className="employee-payroll-form-card">
            <h4><Banknote size={18} /> Add salary payment</h4>
            <p>Saved as a store expense under Salaries &amp; Wages.</p>
            <div className="employee-payroll-form-grid">
              <Input
                label="Amount"
                type="number"
                min="0"
                step="0.01"
                value={salaryForm.amount}
                onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
              />
              <Input
                label="Payment date"
                type="date"
                value={salaryForm.salary_date}
                onChange={(e) => setSalaryForm({ ...salaryForm, salary_date: e.target.value })}
              />
              <Input
                label="Period"
                placeholder="August 2026"
                value={salaryForm.period_label}
                onChange={(e) => setSalaryForm({ ...salaryForm, period_label: e.target.value })}
              />
              <Input
                label="Notes"
                value={salaryForm.notes}
                onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
              />
            </div>
            <Button onClick={() => submitPayment(PAYMENT_TYPES.SALARY)} disabled={submitting}>
              Record salary
            </Button>
          </div>

          <div className="employee-payment-list">
            <h4>Salary history</h4>
            {renderPaymentHistory(salaries, PAYMENT_TYPES.SALARY)}
          </div>
        </div>
      )}

      {tab === "advances" && (
        <div className="employee-payroll-section employee-advance-section">
          <div className="employee-advance-hero">
            <div>
              <span>Total advances</span>
              <strong>{formatCurrency(payroll?.advanceTotal || 0, currency)}</strong>
            </div>
            <div>
              <span>Net after advances</span>
              <strong>{formatCurrency(payroll?.netPaid || 0, currency)}</strong>
            </div>
          </div>

          <div className="employee-payroll-form-card employee-advance-form-card">
            <h4><Wallet size={18} /> Give salary advance</h4>
            <p>Advance is tracked separately and also saved as a store expense.</p>
            <div className="employee-payroll-form-grid">
              <Input
                label="Advance amount"
                type="number"
                min="0"
                step="0.01"
                value={advanceForm.amount}
                onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
              />
              <Input
                label="Advance date"
                type="date"
                value={advanceForm.salary_date}
                onChange={(e) => setAdvanceForm({ ...advanceForm, salary_date: e.target.value })}
              />
              <Input
                label="Notes"
                value={advanceForm.notes}
                onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
              />
            </div>
            <Button onClick={() => submitPayment(PAYMENT_TYPES.ADVANCE)} disabled={submitting}>
              Record advance
            </Button>
          </div>

          <div className="employee-payment-list">
            <h4>Advance history</h4>
            {renderPaymentHistory(advances, PAYMENT_TYPES.ADVANCE)}
          </div>
        </div>
      )}
    </Modal>
  );
}
