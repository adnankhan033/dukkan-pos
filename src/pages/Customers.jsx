import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Wallet, FileSpreadsheet } from "lucide-react";
import { customerService } from "../services/CustomerService";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { useSettingsStore } from "../contexts/store";
import { CUSTOMERS_PAGE_SIZE } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import CustomerExportPanel from "../components/customers/CustomerExportPanel";
import CustomerImportModal from "../components/customers/CustomerImportModal";
import CustomerFilterPanel, { CUSTOMER_FILTER_PERIODS } from "../components/customers/CustomerFilterPanel";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Modal from "../components/common/Modal";
import CustomerAccountModal from "../components/customers/CustomerAccountModal";
import { Input, Textarea } from "../components/common/Input";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { required, email, runFormValidation } from "../utils/validation";
import FormValidationAlert from "../components/common/FormValidationAlert";
import { formatCurrency } from "../utils/format";
import {
  EMPTY_CUSTOMER_FILTERS,
  filtersForPeriod,
  hasActiveCustomerFilters,
} from "../utils/customerFilters";
import "./Customers.css";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };
const FORM_ID = "customer-form";

export default function Customers() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const { submitting, guard } = useSubmitGuard();

  const [customers, setCustomers] = useState([]);
  const [exportCustomers, setExportCustomers] = useState([]);
  const [pickerCustomers, setPickerCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_pending: 0,
    customers_with_balance: 0,
    customers_matched: 0,
  });
  const [period, setPeriod] = useState(CUSTOMER_FILTER_PERIODS.ALL);
  const [draftFilters, setDraftFilters] = useState(EMPTY_CUSTOMER_FILTERS);
  const [activeFilters, setActiveFilters] = useState(EMPTY_CUSTOMER_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [accountCustomer, setAccountCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const customerOptions = useMemo(
    () =>
      pickerCustomers.map((customer) => ({
        value: String(customer.id),
        label: customer.name,
        hint: customer.phone || customer.email || undefined,
      })),
    [pickerCustomers]
  );

  const loadPickerCustomers = useCallback(async () => {
    try {
      const items = await customerService.getAllForExport();
      setPickerCustomers(items);
    } catch {
      setPickerCustomers([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, filteredSummary, exportList] = await Promise.all([
        customerService.getAllWithBalances({
          filters: activeFilters,
          page,
          limit: CUSTOMERS_PAGE_SIZE,
          settings,
        }),
        customerService.getFilteredSummary(activeFilters, settings),
        customerService.getAllForExport({
          filters: activeFilters,
          settings,
          includeBalances: true,
        }),
      ]);
      setCustomers(result.items);
      setTotal(result.total);
      setSummary(filteredSummary);
      setExportCustomers(exportList);
    } finally {
      setLoading(false);
    }
  }, [activeFilters, page, settings]);

  useEffect(() => {
    loadPickerCustomers();
  }, [loadPickerCustomers]);

  useEffect(() => {
    load();
  }, [load]);

  function handlePeriodChange(nextPeriod) {
    setPeriod(nextPeriod);
    if (nextPeriod === CUSTOMER_FILTER_PERIODS.CUSTOM) return;
    const nextFilters = filtersForPeriod(nextPeriod, settings, draftFilters);
    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
    setPage(1);
  }

  function applyFilters() {
    setActiveFilters({ ...draftFilters });
    setPage(1);
  }

  function clearFilters() {
    setPeriod(CUSTOMER_FILTER_PERIODS.ALL);
    setDraftFilters(EMPTY_CUSTOMER_FILTERS);
    setActiveFilters(EMPTY_CUSTOMER_FILTERS);
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setErrors({});
    setModalOpen(true);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this customer?")) return;
    try {
      await customerService.delete(id);
      loadPickerCustomers();
      load();
    } catch (err) {
      alert(err.message);
    }
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
        loadPickerCustomers();
        load();
      });
    } catch (err) {
      setErrors({ form: err.message });
    }
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone", render: (row) => row.phone || "—" },
    { key: "email", label: "Email", render: (row) => row.email || "—" },
    {
      key: "address",
      label: "Address",
      render: (row) => row.address || "—",
    },
    {
      key: "balance_pending",
      label: "Balance Due",
      render: (row) => (
        <span
          className={
            row.balance_pending > 0 ? "customers-balance-due" : "customers-balance-clear"
          }
        >
          {formatCurrency(row.balance_pending || 0, currency)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="table-actions">
          <Button
            variant="ghost"
            size="sm"
            title="View account"
            className="btn-icon"
            onClick={() => setAccountCustomer(row)}
          >
            <Wallet size={16} />
          </Button>
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
    <div className="customers-page">
      <PageHeader
        title="Customers"
        subtitle="Filter by customer, contact details, or invoice dates — stats, list, and exports stay in sync."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet size={16} /> Import
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Add Customer
            </Button>
          </>
        }
      />

      <CustomerFilterPanel
        draftFilters={draftFilters}
        activeFilters={activeFilters}
        period={period}
        customerOptions={customerOptions}
        loading={loading}
        settings={settings}
        onDraftChange={setDraftFilters}
        onPeriodChange={handlePeriodChange}
        onApply={applyFilters}
        onClear={clearFilters}
      >
        <CustomerExportPanel
          customers={exportCustomers}
          filters={activeFilters}
          settings={settings}
          currency={currency}
        />
      </CustomerFilterPanel>

      <div className="customer-account-stats">
        <StatCard
          icon={Wallet}
          label="Total receivable"
          value={formatCurrency(summary.total_pending, currency)}
          variant={summary.total_pending > 0 ? "warning" : "primary"}
        />
        <StatCard
          icon={Wallet}
          label="Customers with balance"
          value={String(summary.customers_with_balance)}
          variant={summary.customers_with_balance > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={Users}
          label="Customers matched"
          value={String(summary.customers_matched)}
          variant="info"
        />
      </div>

      <Card className="customers-list-card">
        <div className="customers-list-toolbar">
          <div>
            <strong>Customer directory</strong>
            <p>
              {hasActiveCustomerFilters(activeFilters)
                ? `${total.toLocaleString()} match${total === 1 ? "" : "es"} your filters`
                : `${total.toLocaleString()} total customer${total === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : customers.length === 0 ? (
          <div className="customers-empty">
            <Users size={36} strokeWidth={1.25} />
            <p>No customers match these filters</p>
            <span>Try clearing filters or widening the date range.</span>
            {hasActiveCustomerFilters(activeFilters) && (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table columns={columns} data={customers} />
            <Pagination
              page={page}
              totalPages={Math.ceil(total / CUSTOMERS_PAGE_SIZE)}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        closeOnOverlay={!submitting}
        title={editing ? "Edit Customer" : "Add Customer"}
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
          <div className="form-row">
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setErrors((prev) => ({ ...prev, name: undefined, form: undefined }));
              }}
              error={errors.name}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Email"
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                setErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
              }}
              error={errors.email}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Textarea
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div style={{ marginTop: "1rem" }}>
              <Textarea
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <CustomerImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => {
          loadPickerCustomers();
          load();
        }}
      />

      <CustomerAccountModal
        customer={accountCustomer}
        currency={currency}
        isOpen={Boolean(accountCustomer)}
        onClose={() => setAccountCustomer(null)}
        onUpdated={() => {
          loadPickerCustomers();
          load();
        }}
      />
    </div>
  );
}
