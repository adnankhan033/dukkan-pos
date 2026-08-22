import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  CreditCard,
  FileDown,
  Lock,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { dailyCloseService } from "../services/DailyCloseService";
import { settingsService } from "../services/SettingsService";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { getBusinessDateISO } from "../utils/businessDate";
import { buildCompanyProfile } from "../utils/directoryExport/companyProfile";
import { exportDailyClosePdf } from "../utils/dailyClose/exportDailyClosePdf";
import { downloadArrayBuffer } from "../utils/productImport/download";
import { formatCurrency, formatDate, formatDateTime, todayISO } from "../utils/format";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import { Input, Select } from "../components/common/Input";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import "./DailyClose.css";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "custom", label: "Pick Date" },
];

const PAYMENT_FILTERS = [
  { id: "all", label: "All Payments" },
  { id: "cash", label: "Cash Only" },
  { id: "card", label: "Card Only" },
];

const TABS = [
  { id: "sales", label: "Sales", icon: ShoppingBag },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "history", label: "Close History", icon: CalendarCheck },
];

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DailyClose() {
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";

  const businessToday = useMemo(() => getBusinessDateISO(settings), [settings]);

  const [preset, setPreset] = useState("today");
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [draftDate, setDraftDate] = useState(() => todayISO());
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [data, setData] = useState(null);
  const [history, setHistory] = useState({ items: [], total: 0 });
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [cashCounted, setCashCounted] = useState("");
  const [closing, setClosing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!selectedDate) return;
    setError("");
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const closeData = await dailyCloseService.getDailyCloseData(selectedDate, {
        paymentMethod: paymentFilter,
      });
      setData(closeData);

      try {
        const closeHistory = await dailyCloseService.getCloseHistory({ page: 1, limit: 20 });
        setHistory(closeHistory);
      } catch (historyErr) {
        console.warn("Daily close history unavailable:", historyErr);
        setHistory({ items: [], total: 0 });
      }
    } catch (err) {
      console.error("Daily close load failed:", err);
      const detail =
        err?.message ||
        (typeof err === "string" ? err : null) ||
        "Failed to load daily close data.";
      setError(detail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, paymentFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (preset !== "today") return;
    const date = businessToday || todayISO();
    setSelectedDate(date);
    setDraftDate(date);
  }, [businessToday, preset]);

  function applyPreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset === "custom") {
      setDraftDate(selectedDate);
      return;
    }
    const date = nextPreset === "yesterday" ? yesterdayISO() : businessToday || todayISO();
    setSelectedDate(date);
    setDraftDate(date);
  }

  function applyCustomDate() {
    if (!draftDate) return;
    setPreset("custom");
    setSelectedDate(draftDate);
  }

  async function handleExportPdf() {
    if (!data) return;
    setExporting(true);
    setError("");
    try {
      const allSettings = await settingsService.getAll();
      const company = buildCompanyProfile(allSettings);
      const exportData =
        paymentFilter === "all"
          ? data
          : await dailyCloseService.getDailyCloseData(selectedDate, { paymentMethod: paymentFilter });
      const result = exportDailyClosePdf({
        data: exportData,
        company,
        currency,
        closeRecord: data.existingClose,
      });
      downloadArrayBuffer(result.buffer, result.filename, result.mimeType);
      setMessage(`PDF downloaded — ${result.filename}`);
    } catch (err) {
      setError(err.message || "PDF export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleCloseDay() {
    setClosing(true);
    setError("");
    try {
      const record = await dailyCloseService.closeDay({
        date: selectedDate,
        user,
        notes: closeNotes,
        cashCounted: cashCounted === "" ? null : cashCounted,
      });
      setCloseModalOpen(false);
      setCloseNotes("");
      setCashCounted("");
      setMessage(
        data?.isClosed
          ? `Day re-closed for ${formatDate(selectedDate)}.`
          : `Day closed for ${formatDate(selectedDate)}.`
      );
      await loadData({ silent: true });
      return record;
    } catch (err) {
      setError(err.message || "Failed to close day.");
    } finally {
      setClosing(false);
    }
  }

  const summary = data?.summary;

  const salesColumns = [
    { key: "sale_number", label: "Sale #" },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "Walk-in" },
    {
      key: "payment_method",
      label: "Payment",
      render: (r) => (
        <Badge variant={r.payment_method === "card" ? "info" : "success"}>
          {r.payment_method === "card" ? "Card" : "Cash"}
        </Badge>
      ),
    },
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
    { key: "created_at", label: "Time", render: (r) => formatDateTime(r.created_at) },
  ];

  const returnColumns = [
    { key: "return_number", label: "Return #" },
    { key: "sale_number", label: "Sale #" },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "Walk-in" },
    { key: "total_refund", label: "Refund", render: (r) => formatCurrency(r.total_refund, currency) },
    { key: "created_at", label: "Time", render: (r) => formatDateTime(r.created_at) },
  ];

  const historyColumns = [
    { key: "business_date", label: "Date", render: (r) => formatDate(r.business_date) },
    { key: "net_sales", label: "Net Sales", render: (r) => formatCurrency(r.net_sales, currency) },
    { key: "cash_total", label: "Cash", render: (r) => formatCurrency(r.cash_total, currency) },
    { key: "card_total", label: "Card", render: (r) => formatCurrency(r.card_total, currency) },
    { key: "sales_count", label: "Sales" },
    {
      key: "closed_by_username",
      label: "Closed By",
      render: (r) => r.closed_by_username || "—",
    },
    { key: "closed_at", label: "Closed At", render: (r) => formatDateTime(r.closed_at) },
  ];

  if (loading && !summary) {
    return <LoadingSpinner message="Loading daily close..." />;
  }

  return (
    <div className="daily-close-page">
      <PageHeader
        title="Daily Close"
        subtitle="End-of-day sales summary, cash reconciliation, PDF report, and close history."
      />

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="daily-close-toolbar">
        <div className="daily-close-toolbar-header">
          <div className="daily-close-toolbar-title">
            <div className="daily-close-toolbar-icon">
              <CalendarCheck size={20} />
            </div>
            <div>
              <h3>Close Date & Filters</h3>
              <p>Business date: {formatDate(selectedDate)}</p>
            </div>
          </div>
          <div className="daily-close-actions">
            <Button variant="secondary" disabled={refreshing} onClick={() => loadData({ silent: true })}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} /> Refresh
            </Button>
            <Button variant="secondary" disabled={exporting || !data} onClick={handleExportPdf}>
              <FileDown size={16} /> {exporting ? "Exporting…" : "Export PDF"}
            </Button>
            <Button disabled={!data || closing} onClick={() => setCloseModalOpen(true)}>
              <Lock size={16} /> {data?.isClosed ? "Re-Close Day" : "Close Day"}
            </Button>
          </div>
        </div>

        <div className="daily-close-presets">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`daily-close-preset ${preset === item.id ? "active" : ""}`}
              onClick={() => applyPreset(item.id)}
            >
              {item.label}
            </button>
          ))}
          <span
            className={`daily-close-status ${data?.isClosed ? "closed" : "open"}`}
          >
            {data?.isClosed ? "Closed" : "Open"}
          </span>
        </div>

        <div className="daily-close-filters">
          {preset === "custom" && (
            <div className="daily-close-filter-group">
              <label>Business Date</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
                <Button variant="secondary" onClick={applyCustomDate}>Apply</Button>
              </div>
            </div>
          )}
          <div className="daily-close-filter-group">
            <label>Payment Filter</label>
            <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              {PAYMENT_FILTERS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {summary?.heldCount > 0 && (
        <div className="daily-close-warning">
          <AlertTriangle size={18} />
          {summary.heldCount} held order(s) for this date — complete or cancel them before closing the day.
        </div>
      )}

      {data?.isClosed && data.existingClose && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <strong>Day already closed</strong>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                By {data.existingClose.closed_by_username} · {formatDateTime(data.existingClose.closed_at)}
              </p>
            </div>
            {data.existingClose.cash_variance != null && (
              <Badge variant={Number(data.existingClose.cash_variance) === 0 ? "success" : "warning"}>
                Cash variance: {formatCurrency(data.existingClose.cash_variance, currency)}
              </Badge>
            )}
          </div>
        </Card>
      )}

      {summary && (
        <div className="daily-close-stats">
          <StatCard label="Gross Sales" value={formatCurrency(summary.grossSales, currency)} icon={ShoppingBag} />
          <StatCard label="Returns" value={formatCurrency(summary.returnsTotal, currency)} icon={RotateCcw} variant="warning" />
          <StatCard label="Net Sales" value={formatCurrency(summary.netSales, currency)} icon={Banknote} variant="success" />
          <StatCard label="Cash in drawer (Net)" value={formatCurrency(summary.cashTotal, currency)} icon={Banknote} />
          <StatCard label="Card / bank (Net)" value={formatCurrency(summary.cardTotal, currency)} icon={CreditCard} />
          <StatCard label="Pay later (not cash)" value={formatCurrency(summary.creditTotal || 0, currency)} icon={CreditCard} />
          <StatCard label="Sales Count" value={summary.salesCount} icon={ShoppingBag} />
        </div>
      )}

      <Card>
        <div className="daily-close-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`daily-close-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === "sales" && data?.sales ? ` (${data.sales.length})` : ""}
              {tab.id === "returns" && data?.returns ? ` (${data.returns.length})` : ""}
              {tab.id === "history" && history.total ? ` (${history.total})` : ""}
            </button>
          ))}
        </div>

        {activeTab === "sales" && (
          <Table columns={salesColumns} data={data?.sales || []} emptyMessage="No sales for this date." />
        )}
        {activeTab === "returns" && (
          <Table columns={returnColumns} data={data?.returns || []} emptyMessage="No returns for this date." />
        )}
        {activeTab === "history" && (
          <Table columns={historyColumns} data={history.items} emptyMessage="No closed days yet." />
        )}
      </Card>

      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title={data?.isClosed ? "Re-Close Day" : "Close Day"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseModalOpen(false)} disabled={closing}>
              Cancel
            </Button>
            <Button onClick={handleCloseDay} disabled={closing || summary?.heldCount > 0}>
              {closing ? "Closing…" : data?.isClosed ? "Update Close" : "Confirm Close"}
            </Button>
          </>
        }
      >
        {summary && (
          <>
            <p style={{ marginTop: 0, color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              Review totals for <strong>{formatDate(selectedDate)}</strong> before closing. This records an official end-of-day snapshot and enables PDF reporting.
            </p>
            <dl className="daily-close-close-summary">
              <div>
                <dt>Gross Sales</dt>
                <dd>{formatCurrency(summary.grossSales, currency)}</dd>
              </div>
              <div>
                <dt>Returns</dt>
                <dd>{formatCurrency(summary.returnsTotal, currency)}</dd>
              </div>
              <div>
                <dt>Net Sales</dt>
                <dd>{formatCurrency(summary.netSales, currency)}</dd>
              </div>
              <div>
                <dt>Expected cash in drawer</dt>
                <dd>{formatCurrency(summary.cashTotal, currency)}</dd>
              </div>
              <div>
                <dt>Card / bank</dt>
                <dd>{formatCurrency(summary.cardTotal, currency)}</dd>
              </div>
              <div>
                <dt>Pay later</dt>
                <dd>{formatCurrency(summary.creditTotal || 0, currency)}</dd>
              </div>
              <div>
                <dt>Sales / Returns</dt>
                <dd>{summary.salesCount} / {summary.returnsCount}</dd>
              </div>
            </dl>
            <Input
              label="Cash Counted (optional)"
              type="number"
              min="0"
              step="0.01"
              value={cashCounted}
              onChange={(e) => setCashCounted(e.target.value)}
              placeholder={String(summary.cashTotal.toFixed(2))}
            />
            {cashCounted !== "" && Number.isFinite(Number(cashCounted)) && (
              <p
                className={`daily-close-variance ${
                  Number(cashCounted) - summary.cashTotal >= 0 ? "positive" : "negative"
                }`}
                style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}
              >
                Variance: {formatCurrency(Number(cashCounted) - summary.cashTotal, currency)}
              </p>
            )}
            <div style={{ marginTop: "1rem" }}>
              <Input
                label="Notes (optional)"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Shift notes, variance explanation, etc."
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
