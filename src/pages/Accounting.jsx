import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { expenseService } from "../services/ExpenseService";
import { expenseCategoryService } from "../services/ExpenseCategoryService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import {
  ITEMS_PER_PAGE,
  EXPENSE_PERIODS,
} from "../utils/constants";
import {
  getBusinessDateTime,
  getBusinessDateTimeLabel,
  defaultExpenseDateTimeLocal,
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
} from "../utils/businessDate";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import SearchableSelect from "../components/common/SearchableSelect";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import { Input, Textarea } from "../components/common/Input";
import { StatCard } from "../components/common/Card";
import { LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatDateTime } from "../utils/format";
import { formatWallClockDateTime } from "../utils/timezones";
import { required, positiveNumber, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";
import "./Accounting.css";

const FORM_ID = "expense-form";
const CATEGORY_FORM_ID = "expense-category-form";

function buildEmptyForm(settings) {
  return {
    name: "",
    category: "other",
    amount: "",
    expense_datetime: defaultExpenseDateTimeLocal(settings),
    notes: "",
  };
}

export default function Accounting() {
  const { submitting, guard } = useSubmitGuard();
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const businessNow = useMemo(() => {
    void clockTick;
    return getBusinessDateTime(settings);
  }, [settings, clockTick]);

  const businessLabel = useMemo(() => {
    void clockTick;
    return getBusinessDateTimeLabel(settings);
  }, [settings, clockTick]);

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, count: 0, byCategory: [] });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState(EXPENSE_PERIODS.DAILY);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => buildEmptyForm(settings));
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [categoryErrors, setCategoryErrors] = useState({});

  const categoryLabel = (id) => expenseCategoryService.labelFor(id, categories);
  const categoryOptions = categories.map((item) => ({
    value: item.code,
    label: item.name,
  }));

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await expenseCategoryService.getAll());
    } catch {
      setCategories([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        period,
        category,
        search,
        page,
        limit: ITEMS_PER_PAGE,
        referenceDate: businessNow,
      };
      const [result, summaryData] = await Promise.all([
        expenseService.getAll(filters),
        expenseService.getSummary(filters),
      ]);
      setExpenses(result.items);
      setTotal(result.total);
      setSummary(summaryData);
    } finally {
      setLoading(false);
    }
  }, [page, period, category, search, businessNow]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new Error("Category name is required");
    const match = categories.find(
      (item) => item.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (match) return match.code;
    const created = await expenseCategoryService.create({ name: trimmed });
    setCategories((prev) => {
      const next = prev.some((item) => item.code === created.code)
        ? prev
        : [...prev, created];
      return [...next].sort(
        (a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name)
      );
    });
    return created.code;
  }

  async function createCategoryFromSearch(name) {
    return addCategory(name);
  }

  function openCategoryModal() {
    setCategoryForm({ name: "" });
    setCategoryErrors({});
    setCategoryModalOpen(true);
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    const validation = runFormValidation({
      name: required(categoryForm.name, "Category name"),
    });
    if (!validation.isValid) {
      setCategoryErrors(validation.errors);
      return;
    }
    try {
      await guard(async () => {
        const code = await addCategory(categoryForm.name);
        setForm((prev) => ({ ...prev, category: code }));
        setCategoryModalOpen(false);
        setCategoryErrors({});
      });
    } catch (err) {
      setCategoryErrors({ form: err.message });
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(buildEmptyForm(settings));
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(e) {
    setEditing(e);
    setForm({
      name: e.name,
      category: e.category || "other",
      amount: String(e.amount),
      expense_datetime: toDateTimeLocalValue(e.expense_date, settings),
      notes: e.notes || "",
    });
    setErrors({});
    setModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this expense?")) return;
    await expenseService.delete(id);
    load();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validation = runFormValidation({
      name: required(form.name, "Name"),
      category: required(form.category, "Category"),
      amount: positiveNumber(form.amount, "Amount"),
      expense_datetime: required(form.expense_datetime, "Date & time"),
    });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const payload = {
      name: form.name,
      category: form.category,
      amount: form.amount,
      expense_date: fromDateTimeLocalValue(form.expense_datetime),
      notes: form.notes,
    };

    try {
      await guard(async () => {
        if (editing) await expenseService.update(editing.id, payload);
        else await expenseService.create(payload);
        setModalOpen(false);
        setErrors({});
        load();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "name", label: "Expense" },
    {
      key: "category",
      label: "Category",
      render: (r) => categoryLabel(r.category || "other"),
    },
    { key: "amount", label: "Amount", render: (r) => formatCurrency(r.amount, currency) },
    {
      key: "expense_date",
      label: "Date & time",
      render: (r) => {
        const raw = String(r.expense_date || "").trim();
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
          return formatWallClockDateTime(raw);
        }
        return formatDateTime(r.expense_date);
      },
    },
    { key: "notes", label: "Notes", render: (r) => r.notes || "-" },
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

  const businessTimeLabel = businessLabel.datetime;

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track rent, salaries, utilities, supplies, and all baqala expenses. Posted to the ledger when accounting is active."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Expense
          </Button>
        }
      />

      <p className="accounting-business-date">
        Region: <strong>{businessLabel.region}</strong>
        {" · "}
        Business time: <strong>{businessTimeLabel}</strong>
        {businessLabel.isOverride ? " (fixed date in settings)" : " (live)"}
      </p>

      <div className="accounting-filters">
        <div className="period-tabs">
          {Object.entries(EXPENSE_PERIODS).map(([key, value]) => (
            <button
              key={key}
              type="button"
              className={`period-tab ${period === value ? "active" : ""}`}
              onClick={() => {
                setPeriod(value);
                setPage(1);
              }}
            >
              {key.charAt(0) + key.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="accounting-filter-row">
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search expenses..."
          />
          <SearchableSelect
            value={category === "all" ? "" : category}
            onChange={(value) => {
              setCategory(value || "all");
              setPage(1);
            }}
            options={categoryOptions}
            placeholder="All categories"
            noneLabel="All categories"
            className="accounting-category-filter"
          />
        </div>
      </div>

      <div className="accounting-summary">
        <StatCard label="Total Expenses" value={formatCurrency(summary.total, currency)} variant="danger" />
        <StatCard label="Records" value={summary.count} variant="info" />
      </div>

      {summary.byCategory.length > 0 && (
        <div className="category-breakdown">
          {summary.byCategory.map((row) => (
            <div key={row.category} className="category-breakdown-item">
              <span>{categoryLabel(row.category || "other")}</span>
              <strong>{formatCurrency(row.total, currency)}</strong>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <Table columns={columns} data={expenses} emptyMessage="No expenses for this period" />
          <Pagination
            page={page}
            totalPages={Math.ceil(total / ITEMS_PER_PAGE)}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={editing ? "Edit Expense" : "Add Expense"}
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
            label="Expense Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />
          <div className="form-row" style={{ marginTop: "1rem" }}>
            <div className="expense-category-field">
              <SearchableSelect
                label="Category *"
                value={form.category}
                onChange={(value) => setForm({ ...form, category: value })}
                options={categoryOptions}
                placeholder="Search or create category…"
                noneLabel="Select category"
                creatable
                onCreateOption={createCategoryFromSearch}
                menuPortal
                clearable={false}
                error={errors.category}
              />
              <Button
                type="button"
                variant="secondary"
                className="expense-category-add"
                onClick={openCategoryModal}
                aria-label="Add category"
                title="Add category"
              >
                <Plus size={18} />
              </Button>
            </div>
            <Input
              label="Amount *"
              type="number"
              step="0.01"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              error={errors.amount}
            />
            <Input
              label="Date & time *"
              type="datetime-local"
              value={form.expense_datetime}
              onChange={(e) => setForm({ ...form, expense_datetime: e.target.value })}
              error={errors.expense_datetime}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={categoryModalOpen}
        onClose={() => !submitting && setCategoryModalOpen(false)}
        closeOnOverlay={!submitting}
        overlayClassName="modal-overlay-nested"
        title="Add category"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCategoryModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form={CATEGORY_FORM_ID} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form id={CATEGORY_FORM_ID} onSubmit={handleCreateCategory} noValidate>
          <FormValidationAlert errors={categoryErrors} />
          <Input
            label="Category name *"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ name: e.target.value })}
            error={categoryErrors.name}
            autoFocus
            placeholder="e.g. Fuel, Cleaning, Internet"
          />
        </form>
      </Modal>
    </div>
  );
}
