import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, DollarSign, Eye, RotateCcw, ShoppingBag } from "lucide-react";
import { saleService } from "../services/SaleService";
import { ensureReturnSchema } from "../database/connection";
import { useSettingsStore } from "../contexts/store";
import { ORDER_PERIODS, ORDER_RETURN_FILTERS, SALE_STATUS } from "../utils/constants";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import SearchBar from "../components/common/SearchBar";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import OrderDetailModal from "../components/orders/OrderDetailModal";
import SaleReturnModal from "../components/sales/SaleReturnModal";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatDateTime } from "../utils/format";
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

function matchesReturnFilter(order, filter) {
  switch (filter) {
    case ORDER_RETURN_FILTERS.NO_RETURN:
      return order.status === SALE_STATUS.COMPLETED;
    case ORDER_RETURN_FILTERS.WITH_RETURN:
      return (
        order.status === SALE_STATUS.PARTIAL_RETURN || order.status === SALE_STATUS.RETURNED
      );
    case ORDER_RETURN_FILTERS.PARTIAL:
      return order.status === SALE_STATUS.PARTIAL_RETURN;
    case ORDER_RETURN_FILTERS.RETURNED:
      return order.status === SALE_STATUS.RETURNED;
    default:
      return true;
  }
}

function orderStatusBadge(status) {
  if (status === SALE_STATUS.RETURNED) return <Badge variant="neutral">Returned</Badge>;
  if (status === SALE_STATUS.PARTIAL_RETURN) return <Badge variant="warning">Partial Return</Badge>;
  if (status === SALE_STATUS.HELD) return <Badge variant="warning">Held</Badge>;
  return <Badge variant="success">Completed</Badge>;
}

export default function Orders() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const vatPercent = Number(settings.vat_percent) || 0;

  const [period, setPeriod] = useState(ORDER_PERIODS.TODAY);
  const [returnFilter, setReturnFilter] = useState(ORDER_RETURN_FILTERS.ALL);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedReturns, setSelectedReturns] = useState([]);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnSaleId, setReturnSaleId] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureReturnSchema();
      const [list, periodStats] = await Promise.all([
        saleService.getByPeriod(period),
        saleService.getPeriodStats(period),
      ]);
      setOrders(list);
      setStats(periodStats);
    } catch (err) {
      setOrders([]);
      setStats(null);
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesReturnFilter(o, returnFilter)) return false;
      if (!term) return true;
      return (
        o.sale_number?.toLowerCase().includes(term) ||
        o.customer_name?.toLowerCase().includes(term) ||
        o.payment_method?.toLowerCase().includes(term)
      );
    });
  }, [orders, search, returnFilter]);

  async function openOrderDetail(row) {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedSale(null);
    setSelectedReturns([]);
    setError("");

    try {
      const [full, returns] = await Promise.all([
        saleService.getById(row.id),
        saleService.getReturnsForSale(row.id),
      ]);
      if (!full) {
        setError("Order not found");
        setDetailOpen(false);
        return;
      }
      setSelectedSale(full);
      setSelectedReturns(returns);
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

  const columns = [
    { key: "sale_number", label: "Order #" },
    {
      key: "created_at",
      label: "Date & Time",
      render: (r) => formatDateTime(r.created_at),
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
            onClick={() => setPeriod(tab.id)}
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
            onChange={setSearch}
            placeholder="Search order #, customer, payment..."
          />
          <span className="orders-list-count">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
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
                onClick={() => setReturnFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading orders..." />
        ) : (
          <Table
            columns={columns}
            data={filteredOrders}
            onRowClick={openOrderDetail}
            emptyMessage={
              returnFilter === ORDER_RETURN_FILTERS.ALL
                ? `No orders ${periodLabel}`
                : `No matching orders ${periodLabel} for this return filter`
            }
          />
        )}
      </Card>

      <OrderDetailModal
        isOpen={detailOpen}
        loading={detailLoading}
        sale={selectedSale}
        returns={selectedReturns}
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
    </div>
  );
}
