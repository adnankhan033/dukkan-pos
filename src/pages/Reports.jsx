import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  DollarSign,
  Package,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { reportService } from "../services/ReportService";
import { useSettingsStore } from "../contexts/store";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatDate, formatDateTime, getPeriodDateRange, todayISO } from "../utils/format";
import "./Reports.css";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "month", label: "This Month" },
  { id: "week", label: "This Week" },
  { id: "custom", label: "Custom Range" },
];

const TABS = [
  { id: "sales", label: "Sales", icon: ShoppingBag },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "purchases", label: "Purchases", icon: Truck },
  { id: "inventory", label: "Inventory", icon: Package },
];

function presetToPeriod(preset) {
  if (preset === "today") return "daily";
  if (preset === "week") return "weekly";
  if (preset === "month") return "monthly";
  return null;
}

function formatPeriodLabel(preset, from, to) {
  if (preset === "today") return `Today · ${formatDate(from)}`;
  if (preset === "month") return `This Month · ${formatDate(from)} – ${formatDate(to)}`;
  if (preset === "week") return `This Week · ${formatDate(from)} – ${formatDate(to)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function emptyReportData() {
  return {
    summary: null,
    sales: [],
    returns: [],
    purchases: [],
    expenses: [],
    inventory: [],
  };
}

export default function Reports() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState(() => todayISO());
  const [to, setTo] = useState(() => todayISO());
  const [draftFrom, setDraftFrom] = useState(() => todayISO());
  const [draftTo, setDraftTo] = useState(() => todayISO());
  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [data, setData] = useState(emptyReportData);

  const periodLabel = useMemo(() => formatPeriodLabel(preset, from, to), [preset, from, to]);

  const loadReports = useCallback(async (rangeFrom, rangeTo, { silent = false } = {}) => {
    if (!rangeFrom || !rangeTo) return;
    if (rangeFrom > rangeTo) {
      setLoadError("Start date must be before or equal to end date.");
      return;
    }

    setLoadError("");
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const reportData = await reportService.getReportData(rangeFrom, rangeTo);
      setData(reportData);
    } catch (err) {
      setLoadError(err.message || "Failed to load reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports(from, to);
  }, [from, to, loadReports]);

  function applyPreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset === "custom") {
      setDraftFrom(from);
      setDraftTo(to);
      return;
    }
    const period = presetToPeriod(nextPreset);
    const range = getPeriodDateRange(period);
    setFrom(range.from);
    setTo(range.to);
    setDraftFrom(range.from);
    setDraftTo(range.to);
  }

  function applyCustomRange() {
    if (draftFrom > draftTo) {
      setLoadError("Start date must be before or equal to end date.");
      return;
    }
    setPreset("custom");
    setFrom(draftFrom);
    setTo(draftTo);
  }

  const summary = data.summary;

  const salesColumns = [
    { key: "sale_number", label: "Sale #" },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "Walk-in" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge variant={r.status === "returned" ? "danger" : r.status === "partial_return" ? "warning" : "success"}>
          {r.status === "partial_return" ? "Partial Return" : r.status}
        </Badge>
      ),
    },
    { key: "total", label: "Total", render: (r) => formatCurrency(r.total, currency) },
    { key: "created_at", label: "Date", render: (r) => formatDateTime(r.created_at) },
  ];

  const returnColumns = [
    { key: "return_number", label: "Return #" },
    { key: "sale_number", label: "Sale #" },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "Walk-in" },
    { key: "total_refund", label: "Refund", render: (r) => formatCurrency(r.total_refund, currency) },
    { key: "created_at", label: "Date", render: (r) => formatDateTime(r.created_at) },
  ];

  const expenseColumns = [
    { key: "name", label: "Expense" },
    { key: "category", label: "Category", render: (r) => r.category || "—" },
    { key: "amount", label: "Amount", render: (r) => formatCurrency(r.amount, currency) },
    { key: "expense_date", label: "Date", render: (r) => formatDate(r.expense_date) },
  ];

  const purchaseColumns = [
    { key: "purchase_number", label: "Purchase #" },
    { key: "supplier_name", label: "Supplier", render: (r) => r.supplier_name || "—" },
    { key: "total", label: "Total", render: (r) => formatCurrency(r.total, currency) },
    { key: "payment_status", label: "Status", render: (r) => <Badge variant="info">{r.payment_status || "—"}</Badge> },
    { key: "created_at", label: "Date", render: (r) => formatDateTime(r.created_at) },
  ];

  const invColumns = [
    { key: "name", label: "Product" },
    { key: "quantity", label: "Stock" },
    { key: "min_stock", label: "Min Stock" },
    {
      key: "stock_status",
      label: "Status",
      render: (r) => (
        <Badge variant={Number(r.quantity) <= Number(r.min_stock) ? "danger" : "success"}>
          {Number(r.quantity) <= Number(r.min_stock) ? "Low" : "OK"}
        </Badge>
      ),
    },
    { key: "selling_price", label: "Price", render: (r) => formatCurrency(r.selling_price, currency) },
  ];

  const tabCounts = {
    sales: data.sales.length,
    returns: data.returns.length,
    expenses: data.expenses.length,
    purchases: data.purchases.length,
    inventory: data.inventory.length,
  };

  if (loading && !summary) {
    return <LoadingSpinner message="Loading reports..." />;
  }

  return (
    <div className="reports-page">
      <PageHeader
        title="Reports"
        subtitle="Sales shown with VAT. Profit is without VAT — tax is not shop profit."
      />

      <div className="reports-toolbar">
        <div className="reports-toolbar-header">
          <div className="reports-toolbar-title">
            <div className="reports-toolbar-icon">
              <CalendarRange size={20} />
            </div>
            <div>
              <h3>Report Period</h3>
              <p>Filter all metrics and tables by date range</p>
            </div>
          </div>
          <span className="reports-period-badge">{periodLabel}</span>
        </div>

        <div className="reports-presets">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`reports-preset${preset === item.id ? " active" : ""}`}
              onClick={() => applyPreset(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="reports-date-row">
          <Input
            label="From"
            type="date"
            value={draftFrom}
            onChange={(e) => {
              setDraftFrom(e.target.value);
              setPreset("custom");
            }}
          />
          <span className="reports-date-separator">to</span>
          <Input
            label="To"
            type="date"
            value={draftTo}
            onChange={(e) => {
              setDraftTo(e.target.value);
              setPreset("custom");
            }}
          />
          <Button
            variant="primary"
            onClick={() => {
              if (preset === "custom" || draftFrom !== from || draftTo !== to) {
                applyCustomRange();
              } else {
                loadReports(from, to, { silent: true });
              }
            }}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Updating…" : "Apply"}
          </Button>
        </div>
      </div>

      {loadError && <Alert>{loadError}</Alert>}

      {summary && (
        <>
          <div className="reports-stats">
            <StatCard label="Gross Sales (without VAT)" value={formatCurrency(summary.grossSales, currency)} icon={DollarSign} variant="primary" />
            <StatCard label="Returns (without VAT)" value={formatCurrency(summary.returnsTotal, currency)} icon={RotateCcw} variant="warning" />
            <StatCard label="Net Revenue (without VAT)" value={formatCurrency(summary.netRevenue, currency)} icon={TrendingUp} variant="info" />
            <StatCard label="COGS (Net)" value={formatCurrency(summary.cogs, currency)} icon={ShoppingBag} variant="info" />
            <StatCard label="Expenses" value={formatCurrency(summary.expensesTotal, currency)} icon={Receipt} variant="warning" />
            <StatCard
              label="Net Profit"
              value={formatCurrency(summary.netProfit, currency)}
              icon={summary.netProfit >= 0 ? TrendingUp : TrendingDown}
              variant={summary.netProfit >= 0 ? "success" : "danger"}
            />
            <StatCard label="Sales Count" value={String(summary.salesCount)} icon={Users} variant="primary" />
            <StatCard label="Avg. Sale" value={formatCurrency(summary.avgSale, currency)} icon={BarChart3} variant="info" />
          </div>

          <div className="reports-profit-panel">
            <Card>
              <h3 className="card-title" style={{ marginBottom: "1rem" }}>Profit Breakdown</h3>
              <div className="reports-profit-breakdown">
                <div className="reports-profit-row">
                  <span>Gross Sales (without VAT)</span>
                  <span>{formatCurrency(summary.grossSales, currency)}</span>
                </div>
                <div className="reports-profit-row">
                  <span>Returns (without VAT)</span>
                  <span>- {formatCurrency(summary.returnsTotal, currency)}</span>
                </div>
                <div className="reports-profit-row">
                  <span>Net Revenue (without VAT)</span>
                  <span>{formatCurrency(summary.netRevenue, currency)}</span>
                </div>
                <div className="reports-profit-row">
                  <span>Cost of Goods Sold</span>
                  <span>- {formatCurrency(summary.cogs, currency)}</span>
                </div>
                <div className="reports-profit-row">
                  <span>Gross Profit</span>
                  <span>{formatCurrency(summary.grossProfit, currency)}</span>
                </div>
                <div className="reports-profit-row">
                  <span>Operating Expenses</span>
                  <span>- {formatCurrency(summary.expensesTotal, currency)}</span>
                </div>
                <div className="reports-profit-row">
                  <span>Purchases (period)</span>
                  <span>{formatCurrency(summary.purchasesTotal, currency)}</span>
                </div>
                <div className={`reports-profit-row ${summary.netProfit >= 0 ? "positive" : "negative"}`}>
                  <span>Net Profit</span>
                  <span>{formatCurrency(summary.netProfit, currency)}</span>
                </div>
              </div>
            </Card>

            <div className="reports-margin-ring">
              <span className="reports-margin-value">{summary.profitMargin.toFixed(1)}%</span>
              <span className="reports-margin-label">Net Profit Margin</span>
              <span className="reports-margin-meta">
                {summary.returnsCount} returns · {summary.salesCount} sales in selected period
              </span>
            </div>
          </div>
        </>
      )}

      <Card className="reports-table-card">
        <div className="reports-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`reports-tab${activeTab === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} />
                {tab.label}
                <span className="reports-tab-count">{tabCounts[tab.id]}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "sales" && (
          <>
            <p className="reports-table-meta">All completed sales for {periodLabel.toLowerCase()}.</p>
            <Table columns={salesColumns} data={data.sales} emptyMessage="No sales in this period" />
          </>
        )}

        {activeTab === "returns" && (
          <>
            <p className="reports-table-meta">Refunds and returns for {periodLabel.toLowerCase()}.</p>
            <Table columns={returnColumns} data={data.returns} emptyMessage="No returns in this period" />
          </>
        )}

        {activeTab === "expenses" && (
          <>
            <p className="reports-table-meta">Operating expenses for {periodLabel.toLowerCase()}.</p>
            <Table columns={expenseColumns} data={data.expenses} emptyMessage="No expenses in this period" />
          </>
        )}

        {activeTab === "purchases" && (
          <>
            <p className="reports-table-meta">Supplier purchases recorded in {periodLabel.toLowerCase()}.</p>
            <Table columns={purchaseColumns} data={data.purchases} emptyMessage="No purchases in this period" />
          </>
        )}

        {activeTab === "inventory" && (
          <>
            <p className="reports-inventory-note">
              Inventory is a live snapshot and is not filtered by the report period.
            </p>
            <Table columns={invColumns} data={data.inventory} emptyMessage="No products" />
          </>
        )}
      </Card>
    </div>
  );
}
