import {
  CalendarRange,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import Button from "../common/Button";
import { Input } from "../common/Input";
import SearchableSelect from "../common/SearchableSelect";
import {
  CUSTOMER_FILTER_PERIODS,
  customerFilterPeriodLabel,
  describeCustomerFilters,
  hasActiveCustomerFilters,
} from "../../utils/customerFilters";
import "./CustomerFilterPanel.css";

const PERIOD_TABS = [
  { id: CUSTOMER_FILTER_PERIODS.ALL, label: "All time" },
  { id: CUSTOMER_FILTER_PERIODS.MONTH, label: "This month" },
  { id: CUSTOMER_FILTER_PERIODS.CUSTOM, label: "Custom range" },
];

export default function CustomerFilterPanel({
  draftFilters,
  activeFilters,
  period,
  customerOptions = [],
  loading = false,
  settings = {},
  onDraftChange,
  onPeriodChange,
  onApply,
  onClear,
  children,
}) {
  const filterSummary = describeCustomerFilters(activeFilters, customerOptions);
  const periodLabel = customerFilterPeriodLabel(period, activeFilters);
  const hasFilters = hasActiveCustomerFilters(activeFilters);

  function updateField(field, value) {
    onDraftChange({ ...draftFilters, [field]: value });
  }

  return (
    <section className="customers-filter-panel">
      <div className="customers-filter-panel-header">
        <div className="customers-filter-panel-title">
          <Filter size={18} />
          <div>
            <strong>Search &amp; filter customers</strong>
            <p>Apply filters once — stats, list, and reports all update together.</p>
          </div>
        </div>
        <span className="customers-filter-period-badge">{periodLabel}</span>
      </div>

      <div className="customers-filter-period-tabs">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`customers-filter-period-tab ${period === tab.id ? "active" : ""}`}
            onClick={() => onPeriodChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="customers-filter-grid">
        <SearchableSelect
          label="Customer"
          className="customers-filter-customer"
          value={draftFilters.customerId}
          onChange={(value) => updateField("customerId", value)}
          options={customerOptions}
          placeholder="All customers"
          noneLabel="All customers"
          clearable
          menuPortal
        />
        <Input
          label="Name or email"
          value={draftFilters.search}
          onChange={(e) => updateField("search", e.target.value)}
          placeholder="Quick text search"
        />
        <Input
          label="Phone"
          value={draftFilters.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          placeholder="e.g. 05xxxxxxxx"
        />
        <Input
          label="Address"
          value={draftFilters.address}
          onChange={(e) => updateField("address", e.target.value)}
          placeholder="City, district, street…"
        />
      </div>

      <div className="customers-filter-date-row">
        <Input
          label="From date"
          type="date"
          value={draftFilters.from}
          onChange={(e) => {
            updateField("from", e.target.value);
            onPeriodChange(CUSTOMER_FILTER_PERIODS.CUSTOM);
          }}
        />
        <Input
          label="To date"
          type="date"
          value={draftFilters.to}
          onChange={(e) => {
            updateField("to", e.target.value);
            onPeriodChange(CUSTOMER_FILTER_PERIODS.CUSTOM);
          }}
        />
        <div className="customers-filter-actions">
          <Button variant="primary" onClick={onApply} disabled={loading}>
            <RefreshCw size={16} className={loading ? "customers-filter-spin" : ""} />
            Apply filters
          </Button>
          <Button variant="secondary" onClick={onClear} disabled={loading || !hasFilters}>
            <RotateCcw size={16} />
            Clear
          </Button>
        </div>
      </div>

      <p className="customers-filter-timezone-note">
        <CalendarRange size={14} />
        Invoice dates use your store region ({settings.business_timezone || "Asia/Riyadh"}).
      </p>

      {hasFilters && (
        <div className="customers-filter-active">
          <Search size={14} />
          <span>{filterSummary}</span>
        </div>
      )}

      {children ? <div className="customers-filter-export-slot">{children}</div> : null}
    </section>
  );
}

export { CUSTOMER_FILTER_PERIODS };
