import { useCallback, useEffect, useState } from "react";
import { Plus, Users, Wallet, Banknote, Briefcase } from "lucide-react";
import { employeeService } from "../services/EmployeeService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { compressImageFile } from "../utils/image";
import { todayISO } from "../utils/subscriptions";
import { formatCurrency } from "../utils/format";
import { required, runFormValidation } from "../utils/validation";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import Modal from "../components/common/Modal";
import { Input, Select, Textarea } from "../components/common/Input";
import { StatCard, Card } from "../components/common/Card";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import FormValidationAlert from "../components/common/FormValidationAlert";
import EmployeeCard from "../components/employees/EmployeeCard";
import EmployeeDetailModal from "../components/employees/EmployeeDetailModal";
import "./Employees.css";

const STATUS_FILTERS = [
  { id: "all", label: "All employees" },
  { id: "current", label: "Currently working" },
  { id: "finished", label: "Finished" },
];

function buildEmptyForm() {
  return {
    full_name: "",
    designation: "",
    phone: "",
    address: "",
    iqama_number: "",
    photo: "",
    start_date: todayISO(),
    end_date: "",
    is_current: true,
    notes: "",
  };
}

export default function Employees() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const { submitting, guard } = useSubmitGuard();

  const [employees, setEmployees] = useState([]);
  const [payrollMap, setPayrollMap] = useState({});
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(buildEmptyForm);
  const [errors, setErrors] = useState({});

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, summaryData] = await Promise.all([
        employeeService.getAll({ search, status: statusFilter }),
        employeeService.getSummary(),
      ]);
      setEmployees(items);
      setSummary(summaryData);

      const payrollEntries = await Promise.all(
        items.map(async (employee) => [
          employee.id,
          await employeeService.getPayrollSummary(employee.id),
        ])
      );
      setPayrollMap(Object.fromEntries(payrollEntries));
    } catch (err) {
      setAlert(err?.message || String(err) || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(buildEmptyForm());
    setErrors({});
    setCreateOpen(true);
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const photo = await compressImageFile(file);
      setForm((prev) => ({ ...prev, photo }));
    } catch (err) {
      setAlert(err.message || "Failed to upload photo");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const validation = runFormValidation({
      full_name: required(form.full_name, "Full name"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setAlert("");
    try {
      await guard(async () => {
        await employeeService.create(form);
        setCreateOpen(false);
        setErrors({});
        setAlert("Employee created successfully");
        load();
      });
    } catch (err) {
      setAlert(err?.message || String(err) || "Failed to create employee");
    }
  }

  function openDetail(employee) {
    setSelectedEmployee(employee);
    setDetailOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage employee profiles, salaries, and salary advances."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add employee
          </Button>
        }
      />

      {alert && <Alert type={alert.includes("Failed") ? "error" : "success"}>{alert}</Alert>}

      {summary && (
        <div className="employees-summary-grid">
          <StatCard label="Total Employees" value={summary.total} icon={Users} variant="primary" />
          <StatCard label="Currently Working" value={summary.current} icon={Briefcase} variant="success" />
          <StatCard label="Salaries This Month" value={formatCurrency(summary.monthlySalary, currency)} icon={Banknote} />
          <StatCard label="Advances This Month" value={formatCurrency(summary.monthlyAdvance, currency)} icon={Wallet} variant="warning" />
        </div>
      )}

      <div className="employees-toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search name, phone, iqama, address..."
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter employees"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : employees.length === 0 ? (
        <Card className="employees-empty-card">
          <Users size={36} strokeWidth={1.25} />
          <h3>No employees yet</h3>
          <p>Add your first employee to start tracking profiles, salaries, and advances.</p>
          <Button onClick={openCreate}><Plus size={16} /> Add employee</Button>
        </Card>
      ) : (
        <div className="employees-grid">
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              currency={currency}
              payroll={payrollMap[employee.id]}
              onClick={openDetail}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => !submitting && setCreateOpen(false)}
        closeOnOverlay={!submitting}
        title="Add employee"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="employee-create-form" disabled={submitting}>
              {submitting ? "Saving..." : "Create employee"}
            </Button>
          </>
        }
      >
        <form id="employee-create-form" onSubmit={handleCreate} className="employee-create-form">
          <FormValidationAlert errors={errors} />

          <label className="employee-photo-upload">
            <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
            {form.photo ? (
              <img src={form.photo} alt="Preview" className="employee-photo-preview" />
            ) : (
              <span>Upload picture</span>
            )}
          </label>

          <Input
            label="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            label="Designation"
            placeholder="Cashier, Manager, Driver..."
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
          />
          <Input
            label="Phone number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="Iqama number"
            value={form.iqama_number}
            onChange={(e) => setForm({ ...form, iqama_number: e.target.value })}
          />

          <div className="employee-date-section">
            <Input
              label="Start date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <label className="employee-current-checkbox">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) => setForm({
                  ...form,
                  is_current: e.target.checked,
                  end_date: e.target.checked ? "" : form.end_date || todayISO(),
                })}
              />
              Currently working
            </label>
            {!form.is_current && (
              <Input
                label="End date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            )}
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </form>
      </Modal>

      <EmployeeDetailModal
        employee={selectedEmployee}
        currency={currency}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={(message) => {
          if (message) setAlert(message);
          load();
        }}
        onDeleted={() => {
          setDetailOpen(false);
          setSelectedEmployee(null);
          load();
        }}
        submitting={submitting}
        guard={guard}
      />
    </div>
  );
}
