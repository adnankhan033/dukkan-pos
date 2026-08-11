import { useCallback, useEffect, useState } from "react";
import { ClipboardList, DollarSign, Eye, RotateCcw, ShoppingBag, Trash2, ShieldAlert } from "lucide-react";
import { saleService } from "../services/SaleService";
import { zatcaService } from "../services/ZatcaService";
import { ensureReturnSchema } from "../database/connection";
import { useSettingsStore } from "../contexts/store";
import { usePermissions } from "../hooks/usePermissions";
import { useConfirm } from "../hooks/useConfirm";
import { useDebounce } from "../hooks/usePagination";
import { ORDER_PERIODS, ORDER_RETURN_FILTERS, ORDERS_PAGE_SIZE, SALE_STATUS } from "../utils/constants";
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
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatOrderDateTime } from "../utils/format";
import { printReceipt } from "../utils/receipt";
import "./Orders.css";

const PERIOD_TABS = [
  { id: ORDER_PERIODS.TODAY, label: "Today" },
  { id: ORDER_PERIODS.WEEK, label: "This Week" },
  { id: ORDER_PERIODS.MONTH, label: "This Month" },
];

const RETURN_FILTER_TABS = [
  { id: ORDER_RETURN_FILTERS.ALL, label: "All Orders" },
  { id: ORDER_RETURN_FILTERS.NO_RETURN, label: "No Returns" },
  { id: ORDER_RETURN_FILTERS.WITH_RETURN, label: "With Returns" },
  { id: ORDER_RETURN_FILTERS.PARTIAL, label: "Partial Return" },
  { id: ORDER_RETURN_FILTERS.RETURNED, label: "Full Return" },
];

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

  const [period, setPeriod] = useState(ORDER_PERIODS.TODAY);
  const [returnFilter, setReturnFilter] = useState(ORDER_RETURN_FILTERS.ALL);
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

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureReturnSchema();
      const [result, periodStats] = await Promise.all([
        saleService.getByPeriodPaginated({
          period,
          page,
          limit: ORDERS_PAGE_SIZE,
          returnFilter,
          search: debouncedSearch,
        }),
        saleService.getPeriodStats(period),
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
  }, [period, page, returnFilter, debouncedSearch, showZatcaColumn]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function changePeriod(next) {
    setPeriod(next);
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
        <span style={{ textTransform: "capitalize" }}>{r.payment_method || "cash"}</span>
      ),
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

  const periodLabel =
    period === ORDER_PERIODS.TODAY
      ? "today"
      : period === ORDER_PERIODS.WEEK
        ? "this week"
        : "this month";

  return (
    <div className="orders-page">
      <PageHeader
        title="Orders"
        subtitle="Filter orders by date and return status. Click any row for details, print, or process returns."
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

      {stats && (
        <div className="orders-stats">
          <StatCard
            label={`Orders ${periodLabel}`}
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
            placeholder="Search order #, customer, payment..."
          />
          <span className="orders-list-count">
            {total.toLocaleString()} order{total !== 1 ? "s" : ""}
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
          <LoadingSpinner message="Loading orders..." />
        ) : (
          <>
            <Table
              columns={columns}
              data={orders}
              onRowClick={openOrderDetail}
              emptyMessage={
                returnFilter === ORDER_RETURN_FILTERS.ALL
                  ? `No orders ${periodLabel}`
                  : `No matching orders ${periodLabel} for this return filter`
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
        onClose={() => {
          setDetailOpen(false);
          setSelectedSale(null);
        }}
        onPrint={handlePrint}
        onReturn={openReturnFromDetail}
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
