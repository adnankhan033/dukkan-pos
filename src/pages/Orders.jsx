import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ClipboardList, DollarSign, Eye, FileDown, RefreshCw, RotateCcw, ShoppingBag, Trash2, ShieldAlert } from "lucide-react";
import { saleService } from "../services/SaleService";
import { onSalesChanged } from "../services/SalesSync";
import { paymentMethodService } from "../services/PaymentMethodService";
import { onPaymentMethodsChanged } from "../services/PaymentMethodsSync";
import { zatcaService } from "../services/ZatcaService";
import { ensureReturnSchema } from "../database/connection";
import { useSettingsStore } from "../contexts/store";
import { usePermissions } from "../hooks/usePermissions";
import { useConfirm } from "../hooks/useConfirm";
import { useDebounce } from "../hooks/usePagination";
import { ORDER_PERIODS, ORDER_RETURN_FILTERS, ORDERS_PAGE_SIZE, SALE_STATUS, SALE_PAYMENT_STATUS_LABELS } from "../utils/constants";
import { resolveActivePhase } from "../zatca/core/config";
import { ZATCA_PHASES } from "../zatca/core/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import Pagination from "../components/common/Pagination";
import Badge from "../components/common/Badge";
import ZatcaOrderStatusBadge from "../components/zatca/ZatcaOrderStatusBadge";
import ZatcaXmlDownloadLink from "../components/zatca/ZatcaXmlDownloadLink";
import OrderDetailModal from "../components/orders/OrderDetailModal";
import SaleReturnModal from "../components/sales/SaleReturnModal";
import { Input, Select } from "../components/common/Input";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatDate, formatOrderDateTime } from "../utils/format";
import { getBusinessDateISO, getBusinessPeriodDateRange } from "../utils/businessDate";
import { resolvePaymentMethodLabel } from "../utils/paymentMethods";
import { printReceipt } from "../utils/receipt";
import { buildReportCompanyProfile } from "../utils/directoryExport/companyProfile";
import { exportOrdersPdf } from "../utils/ordersExport/exportOrdersPdf";
import { downloadArrayBuffer } from "../utils/productImport/download";
import "./Orders.css";

const PERIOD_TABS = [
  { id: ORDER_PERIODS.TODAY, label: "Today" },
  { id: ORDER_PERIODS.WEEK, label: "This Week" },
  { id: ORDER_PERIODS.MONTH, label: "This Month" },
  { id: ORDER_PERIODS.CUSTOM, label: "Custom Range" },
];

function periodToRangeKey(period) {
  if (period === ORDER_PERIODS.WEEK) return "rolling_week";
  if (period === ORDER_PERIODS.MONTH) return "monthly";
  return "daily";
}

function formatOrdersPeriodLabel(period, from, to, fromTime = "00:00", toTime = "23:59") {
  const ft = String(fromTime).slice(0, 5);
  const tt = String(toTime).slice(0, 5);
  if (period === ORDER_PERIODS.TODAY) return `Today · ${formatDate(from)} (${ft}–${tt})`;
  if (period === ORDER_PERIODS.WEEK) return `Last 7 Days · ${formatDate(from)} – ${formatDate(to)}`;
  if (period === ORDER_PERIODS.MONTH) return `This Month · ${formatDate(from)} – ${formatDate(to)}`;
  return `${formatDate(from)} ${ft} – ${formatDate(to)} ${tt}`;
}

function toTimeInputValue(value) {
  const raw = String(value ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);
  return "00:00";
}

function compareDateTimeRange(fromDate, fromTime, toDate, toTime) {
  const start = `${fromDate}T${toTimeInputValue(fromTime)}`;
  const end = `${toDate}T${toTimeInputValue(toTime)}`;
  return start <= end;
}

const RETURN_FILTER_TABS = [
  { id: ORDER_RETURN_FILTERS.ALL, label: "All Invoices" },
  { id: ORDER_RETURN_FILTERS.NO_RETURN, label: "No Returns" },
  { id: ORDER_RETURN_FILTERS.WITH_RETURN, label: "With Returns" },
  { id: ORDER_RETURN_FILTERS.PARTIAL, label: "Partial Return" },
  { id: ORDER_RETURN_FILTERS.RETURNED, label: "Full Return" },
];

function paymentStatusBadge(status) {
  if (status === "pending") return <Badge variant="warning">Unpaid</Badge>;
  if (status === "partial") return <Badge variant="info">Partial</Badge>;
  return <Badge variant="success">Paid</Badge>;
}

function orderStatusBadge(status) {
  if (status === SALE_STATUS.RETURNED) return <Badge variant="neutral">Returned</Badge>;
  if (status === SALE_STATUS.PARTIAL_RETURN) return <Badge variant="warning">Partial Return</Badge>;
  if (status === SALE_STATUS.HELD) return <Badge variant="warning">Held</Badge>;
  return <Badge variant="success">Completed</Badge>;
}

export default function Orders() {
  const settings = useSettingsStore((s) => s.settings);
  const { isAdmin } = usePermissions();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const currency = settings.currency || "SAR";
  const vatPercent = Number(settings.vat_percent) || 0;
  const zatcaPhase = resolveActivePhase(settings);
  const showZatcaColumn = zatcaPhase === ZATCA_PHASES.PHASE2;

  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const businessToday = useMemo(() => {
    void clockTick;
    return getBusinessDateISO(settings);
  }, [settings, clockTick]);

  const [period, setPeriod] = useState(ORDER_PERIODS.TODAY);
  const [from, setFrom] = useState(() => getBusinessDateISO({}));
  const [to, setTo] = useState(() => getBusinessDateISO({}));
  const [draftFrom, setDraftFrom] = useState(() => getBusinessDateISO({}));
  const [draftTo, setDraftTo] = useState(() => getBusinessDateISO({}));
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");
  const [draftFromTime, setDraftFromTime] = useState("00:00");
  const [draftToTime, setDraftToTime] = useState("23:59");
  const [returnFilter, setReturnFilter] = useState(ORDER_RETURN_FILTERS.ALL);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [orders, setOrders] = useState([]);
  const [zatcaBySaleId, setZatcaBySaleId] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const debouncedSearch = useDebounce(search, 300);
  const totalPages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedReturns, setSelectedReturns] = useState([]);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnSaleId, setReturnSaleId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const periodLabel = useMemo(
    () => formatOrdersPeriodLabel(period, from, to, fromTime, toTime),
    [period, from, to, fromTime, toTime]
  );

  const loadPaymentMethods = useCallback(async () => {
    try {
      setPaymentMethods(await paymentMethodService.getAll({ includeInactive: true }));
    } catch {
      setPaymentMethods([]);
    }
  }, []);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  useEffect(() => {
    return onPaymentMethodsChanged(() => {
      loadPaymentMethods();
    });
  }, [loadPaymentMethods]);

  useEffect(() => {
    if (period === ORDER_PERIODS.CUSTOM) return;
    const range = getBusinessPeriodDateRange(periodToRangeKey(period), settings);
    setFrom(range.from);
    setTo(range.to);
    setDraftFrom(range.from);
    setDraftTo(range.to);
  }, [businessToday, period, settings]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureReturnSchema();
      const rangeArgs = { period, from, to, fromTime, toTime };
      const [result, periodStats] = await Promise.all([
        saleService.getByPeriodPaginated({
          ...rangeArgs,
          page,
          limit: ORDERS_PAGE_SIZE,
          returnFilter,
          search: debouncedSearch,
          paymentMethod: paymentFilter,
          paymentStatus: paymentStatusFilter,
        }),
        saleService.getPeriodStats(period, from, to, fromTime, toTime, paymentFilter),
      ]);
      setOrders(result.items);
      setTotal(result.total);
      setStats(periodStats);
      setSelectedIds(new Set());

      if (showZatcaColumn && result.items.length) {
        const statusMap = await zatcaService.getStatusBySaleIds(result.items.map((o) => o.id));
        setZatcaBySaleId(statusMap);
      } else {
        setZatcaBySaleId({});
      }
    } catch (err) {
      setOrders([]);
      setTotal(0);
      setStats(null);
      setZatcaBySaleId({});
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [period, from, to, fromTime, toTime, page, returnFilter, paymentFilter, paymentStatusFilter, debouncedSearch, showZatcaColumn]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    return onSalesChanged(() => {
      loadOrders();
    });
  }, [loadOrders]);

  function changePeriod(next) {
    setPeriod(next);
    setPage(1);
    if (next === ORDER_PERIODS.CUSTOM) {
      setDraftFrom(from);
      setDraftTo(to);
      setDraftFromTime(fromTime);
      setDraftToTime(toTime);
      return;
    }
    setFromTime("00:00");
    setToTime("23:59");
    setDraftFromTime("00:00");
    setDraftToTime("23:59");
    const range = getBusinessPeriodDateRange(periodToRangeKey(next), settings);
    setFrom(range.from);
    setTo(range.to);
    setDraftFrom(range.from);
    setDraftTo(range.to);
  }

  function applyCustomRange() {
    if (draftFrom > draftTo) {
      setError("Start date must be before or equal to end date.");
      return;
    }
    if (!compareDateTimeRange(draftFrom, draftFromTime, draftTo, draftToTime)) {
      setError("Start date/time must be before or equal to end date/time.");
      return;
    }
    setError("");
    setPeriod(ORDER_PERIODS.CUSTOM);
    setFrom(draftFrom);
    setTo(draftTo);
    setFromTime(draftFromTime);
    setToTime(draftToTime);
    setPage(1);
  }

  function changePaymentFilter(value) {
    setPaymentFilter(value);
    setPage(1);
  }

  function changePaymentStatusFilter(value) {
    setPaymentStatusFilter(value);
    setPage(1);
  }

  function changeReturnFilter(next) {
    setReturnFilter(next);
    setPage(1);
  }

  function changeSearch(value) {
    setSearch(value);
    setPage(1);
  }

  useEffect(() => {
    if (!showZatcaColumn) return undefined;

    const unsubscribe = zatcaService.subscribeSyncEvents(() => {
      loadOrders();
    });
    return unsubscribe;
  }, [showZatcaColumn, loadOrders]);

  async function openOrderDetail(row) {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedSale(null);
    setSelectedReturns([]);
    setError("");

    try {
      const requests = [
        saleService.getById(row.id),
        saleService.getReturnsForSale(row.id),
      ];
      if (showZatcaColumn) {
        requests.push(zatcaService.getBySaleId(row.id));
      }

      const results = await Promise.all(requests);
      const full = results[0];
      const returns = results[1];
      const zatcaRows = showZatcaColumn ? results[2] : [];

      if (!full) {
        setError("Order not found");
        setDetailOpen(false);
        return;
      }
      setSelectedSale(full);
      setSelectedReturns(returns);

      if (showZatcaColumn && zatcaRows?.[0]) {
        setZatcaBySaleId((prev) => ({ ...prev, [row.id]: zatcaRows[0] }));
      }
    } catch (err) {
      setError(err.message || "Failed to load order details");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handlePrint(sale) {
    try {
      await printReceipt({
        sale,
        items: sale.items || [],
        settings,
        currency,
      });
      setMessage(`Receipt printed — ${sale.sale_number}`);
    } catch (err) {
      setError(err.message || "Print failed");
    }
  }

  function openReturnFromDetail(sale) {
    setDetailOpen(false);
    setReturnSaleId(sale.id);
    setReturnOpen(true);
  }

  function handleReturnSuccess(result) {
    setMessage(
      `Return ${result.returnNumber} processed — ${formatCurrency(result.totalRefund, currency)} refunded`
    );
    loadOrders();
    if (selectedSale?.id === result.sale?.id) {
      setSelectedSale(result.sale);
      setSelectedReturns(result.returns);
      setDetailOpen(true);
    }
  }

  function toggleSelect(id) {
    const numId = Number(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(numId)) next.delete(numId);
      else next.add(numId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length && orders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((order) => Number(order.id))));
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setError("");
    setMessage("");
    try {
      const { orders: exportOrders, total, truncated, stats: exportStats } =
        await saleService.getOrdersExportData({
          period,
          from,
          to,
          fromTime,
          toTime,
          returnFilter,
          search: debouncedSearch,
          paymentMethod: paymentFilter,
        });

      if (total === 0) {
        setError("No invoices to export for the selected period and filters.");
        return;
      }

      const company = buildReportCompanyProfile(settings);
      const result = await exportOrdersPdf({
        orders: exportOrders,
        company,
        currency,
        periodLabel,
        returnFilter,
        search: debouncedSearch,
        stats: exportStats,
        totalMatched: total,
        truncated,
      });

      downloadArrayBuffer(result.buffer, result.filename, result.mimeType);

      const truncNote = result.truncated
        ? ` (first ${result.exportedCount} of ${result.totalMatched} — narrow the date range for full export)`
        : "";
      setMessage(`PDF downloaded — ${result.filename}${truncNote}`);
    } catch (err) {
      setError(err.message || "PDF export failed.");
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleBulkDelete() {
    if (!isAdmin || selectedIds.size === 0) return;

    const ok = await confirm({
      title: "Delete Selected Orders",
      message: `Permanently delete ${selectedIds.size} order(s)? Stock will be restored where applicable. Linked returns, payments, and ZATCA records will also be removed. This cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.size} Order(s)`,
      variant: "danger",
    });
    if (!ok) return;

    setBulkDeleting(true);
    setError("");
    setMessage("");
    try {
      const { deleted, failed } = await saleService.deleteMany([...selectedIds]);
      if (failed.length > 0 && deleted.length === 0) {
        setError(`Delete failed: ${failed.map((f) => f.message).join("; ")}`);
      } else if (failed.length > 0) {
        setMessage(`Deleted ${deleted.length} order(s). Failed ${failed.length}.`);
        setError(failed.map((f) => f.message).join("; "));
      } else {
        setMessage(`Deleted ${deleted.length} order(s) successfully.`);
      }
      if (selectedSale && deleted.includes(Number(selectedSale.id))) {
        setDetailOpen(false);
        setSelectedSale(null);
      }
      await loadOrders();
    } catch (err) {
      setError(err.message || "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  }

  const columns = [
    ...(isAdmin
      ? [
          {
            key: "select",
            label: (
              <input
                type="checkbox"
                className="orders-row-checkbox"
                checked={orders.length > 0 && selectedIds.size === orders.length}
                onChange={toggleSelectAll}
                onClick={(e) => e.stopPropagation()}
                aria-label="Select all orders"
              />
            ),
            stopPropagation: true,
            width: "42px",
            render: (row) => (
              <input
                type="checkbox"
                className="orders-row-checkbox"
                checked={selectedIds.has(Number(row.id))}
                onChange={() => toggleSelect(row.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${row.sale_number}`}
              />
            ),
          },
        ]
      : []),
    { key: "sale_number", label: "Order #" },
    {
      key: "created_at",
      label: "Date & Time",
      render: (r) => formatOrderDateTime(r.created_at),
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (r) => r.customer_name || "Walk-in",
    },
    {
      key: "item_count",
      label: "Items",
      render: (r) => r.item_count ?? 0,
    },
    {
      key: "payment_method",
      label: "Payment",
      render: (r) => (
        <span>{resolvePaymentMethodLabel(r.payment_method, paymentMethods)}</span>
      ),
    },
    {
      key: "payment_status",
      label: "Collection",
      render: (r) => paymentStatusBadge(r.payment_status || "paid"),
    },
    {
      key: "balance_due",
      label: "Balance",
      render: (r) => {
        const due = Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0));
        return due > 0 ? (
          <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>
            {formatCurrency(due, currency)}
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r) => orderStatusBadge(r.status),
    },
    ...(showZatcaColumn
      ? [
          {
            key: "zatca_status",
            label: "ZATCA",
            render: (r) => (
              <ZatcaOrderStatusBadge status={zatcaBySaleId[r.id]?.status} />
            ),
          },
          {
            key: "zatca_xml",
            label: "XML",
            stopPropagation: true,
            render: (r) => (
              <ZatcaXmlDownloadLink
                saleId={r.id}
                saleNumber={r.sale_number}
                record={zatcaBySaleId[r.id]}
              />
            ),
          },
        ]
      : []),
    {
      key: "total",
      label: "Total",
      render: (r) => formatCurrency(r.total, currency),
    },
    {
      key: "actions",
      label: "",
      stopPropagation: true,
      render: (r) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            openOrderDetail(r);
          }}
        >
          <Eye size={14} /> View
        </Button>
      ),
    },
  ];

  const statsPeriodLabel =
    period === ORDER_PERIODS.TODAY
      ? "today"
      : period === ORDER_PERIODS.WEEK
        ? "this week"
        : period === ORDER_PERIODS.MONTH
          ? "this month"
          : "in period";

  return (
    <div className="orders-page">
      <PageHeader
        title="All Invoices"
        subtitle="View and filter all invoices by date, payment method, and return status."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setReturnSaleId(null);
              setReturnOpen(true);
            }}
          >
            <RotateCcw size={16} /> Process Return
          </Button>
        }
      />

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="orders-filter-panel">
        <div className="orders-filter-panel-header">
          <div className="orders-filter-panel-title">
            <CalendarRange size={18} />
            <span>Date &amp; Time Filter</span>
          </div>
          <span className="orders-period-badge">{periodLabel}</span>
        </div>

        <div className="orders-period-tabs">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`orders-period-tab ${period === tab.id ? "active" : ""}`}
              onClick={() => changePeriod(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="orders-date-row">
          <Input
            label="From date"
            type="date"
            value={draftFrom}
            onChange={(e) => {
              setDraftFrom(e.target.value);
              setPeriod(ORDER_PERIODS.CUSTOM);
            }}
          />
          <Input
            label="From time"
            type="time"
            value={toTimeInputValue(draftFromTime)}
            onChange={(e) => {
              setDraftFromTime(e.target.value);
              setPeriod(ORDER_PERIODS.CUSTOM);
            }}
          />
          <span className="orders-date-separator">to</span>
          <Input
            label="To date"
            type="date"
            value={draftTo}
            onChange={(e) => {
              setDraftTo(e.target.value);
              setPeriod(ORDER_PERIODS.CUSTOM);
            }}
          />
          <Input
            label="To time"
            type="time"
            value={toTimeInputValue(draftToTime)}
            onChange={(e) => {
              setDraftToTime(e.target.value);
              setPeriod(ORDER_PERIODS.CUSTOM);
            }}
          />
          <Button
            variant="primary"
            onClick={() => {
              if (period === ORDER_PERIODS.CUSTOM && draftFrom === from && draftTo === to && draftFromTime === fromTime && draftToTime === toTime) {
                loadOrders();
              } else {
                applyCustomRange();
              }
            }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "orders-spin" : ""} />
            Apply
          </Button>
          <Button variant="secondary" onClick={handleExportPdf} disabled={exportingPdf || loading}>
            <FileDown size={16} />
            {exportingPdf ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
        <p className="orders-filter-timezone-note">
          Times use your store region ({settings.business_timezone || "Asia/Riyadh"}).
        </p>
      </div>

      {stats && (
        <div className="orders-stats">
          <StatCard
            label={`Invoices ${statsPeriodLabel}`}
            value={String(stats.orderCount)}
            icon={ClipboardList}
            variant="primary"
          />
          <StatCard
            label="Sales Total"
            value={formatCurrency(stats.salesTotal, currency)}
            icon={ShoppingBag}
            variant="info"
          />
          <StatCard
            label="Returns"
            value={formatCurrency(stats.returnsTotal, currency)}
            icon={RotateCcw}
            variant="warning"
          />
          <StatCard
            label="Net Total"
            value={formatCurrency(stats.netTotal, currency)}
            icon={DollarSign}
            variant="success"
          />
        </div>
      )}

      <Card className="orders-list-card">
        <div className="orders-list-toolbar">
          <SearchBar
            value={search}
            onChange={changeSearch}
            placeholder="Search invoice #, customer, payment..."
          />
          <Select
            label="Payment method"
            className="orders-payment-filter"
            value={paymentFilter}
            onChange={(e) => changePaymentFilter(e.target.value)}
          >
            <option value="all">All payment methods</option>
            {paymentMethods.map((method) => (
              <option key={method.code} value={method.code}>
                {method.label}
                {!method.is_active ? " (disabled)" : ""}
              </option>
            ))}
          </Select>
          <Select
            label="Collection"
            className="orders-payment-filter"
            value={paymentStatusFilter}
            onChange={(e) => changePaymentStatusFilter(e.target.value)}
          >
            <option value="all">All collection statuses</option>
            <option value="paid">{SALE_PAYMENT_STATUS_LABELS.paid}</option>
            <option value="unpaid">Unpaid / Partial</option>
            <option value="pending">{SALE_PAYMENT_STATUS_LABELS.pending}</option>
            <option value="partial">{SALE_PAYMENT_STATUS_LABELS.partial}</option>
          </Select>
          <span className="orders-list-count">
            {total.toLocaleString()} invoice{total !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="orders-return-filters">
          <span className="orders-return-filters-label">Return status</span>
          <div className="orders-return-filters-tabs">
            {RETURN_FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`orders-return-filter-tab ${returnFilter === tab.id ? "active" : ""}`}
                onClick={() => changeReturnFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && orders.length > 0 && (
          <div className="orders-bulk-bar">
            <input
              type="checkbox"
              className="orders-row-checkbox"
              checked={selectedIds.size === orders.length && orders.length > 0}
              onChange={toggleSelectAll}
            />
            <span className="orders-bulk-count">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : "Select all on page"}
            </span>
            <span className="orders-bulk-admin-note">
              <ShieldAlert size={14} /> Administrator only
            </span>
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={bulkDeleting}
                  onClick={handleBulkDelete}
                >
                  <Trash2 size={14} />
                  {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
                </Button>
                <Button variant="ghost" size="sm" disabled={bulkDeleting} onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <LoadingSpinner message="Loading invoices..." />
        ) : (
          <>
            <Table
              columns={columns}
              data={orders}
              onRowClick={openOrderDetail}
              emptyMessage={
                returnFilter === ORDER_RETURN_FILTERS.ALL
                  ? `No orders for ${periodLabel.toLowerCase()}`
                  : `No matching orders for ${periodLabel.toLowerCase()} with this return filter`
              }
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={setPage}
              itemLabel="orders"
            />
          </>
        )}
      </Card>

      <OrderDetailModal
        isOpen={detailOpen}
        loading={detailLoading}
        sale={selectedSale}
        returns={selectedReturns}
        zatcaRecord={selectedSale ? zatcaBySaleId[selectedSale.id] : null}
        showZatca={showZatcaColumn}
        currency={currency}
        vatPercent={vatPercent}
        settings={settings}
        onClose={() => {
          setDetailOpen(false);
          setSelectedSale(null);
        }}
        onPrint={handlePrint}
        onReturn={openReturnFromDetail}
        onPaymentRecorded={async () => {
          await loadOrders();
          if (selectedSale?.id) {
            const refreshed = await saleService.getById(selectedSale.id);
            setSelectedSale(refreshed);
          }
        }}
      />

      <SaleReturnModal
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        onSuccess={handleReturnSuccess}
        currency={currency}
        initialSaleId={returnSaleId}
      />
      {confirmDialog}
    </div>
  );
}
