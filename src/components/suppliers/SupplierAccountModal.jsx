import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Truck, Package, ChevronDown, ChevronUp, List } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Table from "../common/Table";
import Badge from "../common/Badge";
import { Input, Select, Textarea } from "../common/Input";
import { Card, StatCard } from "../common/Card";
import { LoadingSpinner, Alert } from "../common/Loading";
import { useSubmitGuard } from "../../hooks/useSubmitGuard";
import { supplierService } from "../../services/SupplierService";
import { purchaseService } from "../../services/PurchaseService";
import { PURCHASE_PAYMENT_STATUS_LABELS, PURCHASE_TYPE } from "../../utils/constants";
import { formatCurrency, formatDateTime, formatSignedCurrency } from "../../utils/format";

const PURCHASE_TYPE_LABELS = {
  [PURCHASE_TYPE.MARKET]: "Market",
  [PURCHASE_TYPE.SUPPLIER_PAID]: "Paid delivery",
  [PURCHASE_TYPE.SUPPLIER_CREDIT]: "On credit",
};

function StatusBadge({ status }) {
  const variant = status === "paid" ? "success" : status === "pending" ? "warning" : "info";
  return <Badge variant={variant}>{PURCHASE_PAYMENT_STATUS_LABELS[status] || status}</Badge>;
}

export default function SupplierAccountModal({ supplier, currency, isOpen, onClose, onUpdated }) {
  const { submitting, guard } = useSubmitGuard();
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [showFullLedger, setShowFullLedger] = useState(false);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState(null);
  const [deliveryItems, setDeliveryItems] = useState({});
  const [loadingDeliveryId, setLoadingDeliveryId] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", purchaseId: "", notes: "", paymentDate: "" });

  const load = useCallback(async () => {
    if (!supplier?.id) return;
    setLoading(true);
    try {
      const [ledgerData, productList] = await Promise.all([
        supplierService.getLedger(supplier.id),
        supplierService.getProductsBySupplier(supplier.id),
      ]);
      setLedger(ledgerData);
      setProducts(productList);
    } finally {
      setLoading(false);
    }
  }, [supplier?.id]);

  useEffect(() => {
    if (isOpen && supplier) {
      setError("");
      setShowFullLedger(false);
      setExpandedDeliveryId(null);
      setDeliveryItems({});
      setPayForm({
        amount: "",
        purchaseId: "",
        notes: "",
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      load();
    }
  }, [isOpen, supplier, load]);

  const allRecords = useMemo(() => {
    const deliveries = (ledger?.deliveries ?? []).map((d) => ({
      recordType: "delivery",
      sortDate: d.created_at,
      id: `d-${d.id}`,
      deliveryId: d.id,
      reference: d.purchase_number,
      date: d.created_at,
      amount: d.total,
      paid: d.amount_paid,
      due: d.balance_due,
      status: d.payment_status,
      purchaseType: d.purchase_type,
      notes: d.notes,
    }));
    const payments = (ledger?.payments ?? []).map((p) => ({
      recordType: "payment",
      sortDate: p.payment_date || p.created_at,
      id: `p-${p.id}`,
      reference: p.purchase_number || "Extra paid",
      date: p.payment_date || p.created_at,
      amount: p.amount,
      notes: p.notes,
    }));
    return [...deliveries, ...payments].sort(
      (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
    );
  }, [ledger]);

  async function handlePayment(e) {
    e.preventDefault();
    setError("");
    try {
      await guard(async () => {
        await supplierService.recordPayment({
          supplierId: supplier.id,
          amount: payForm.amount,
          notes: payForm.notes,
          purchaseId: payForm.purchaseId ? Number(payForm.purchaseId) : null,
          paymentDate: payForm.paymentDate || null,
        });
        onUpdated?.();
        onClose();
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDeliveryItems(deliveryId) {
    if (expandedDeliveryId === deliveryId) {
      setExpandedDeliveryId(null);
      return;
    }

    setExpandedDeliveryId(deliveryId);

    if (deliveryItems[deliveryId]) return;

    setLoadingDeliveryId(deliveryId);
    try {
      const purchase = await purchaseService.getById(deliveryId);
      setDeliveryItems((prev) => ({
        ...prev,
        [deliveryId]: purchase?.items ?? [],
      }));
    } finally {
      setLoadingDeliveryId(null);
    }
  }

  const pendingDeliveries =
    ledger?.deliveries?.filter(
      (d) => d.payment_status === "pending" || d.payment_status === "partial"
    ) ?? [];

  const deliveryColumns = [
    { key: "purchase_number", label: "Delivery #" },
    { key: "created_at", label: "Date", render: (r) => formatDateTime(r.created_at) },
    {
      key: "purchase_type",
      label: "Type",
      render: (r) => PURCHASE_TYPE_LABELS[r.purchase_type] || r.purchase_type,
    },
    { key: "total", label: "Amount", render: (r) => formatCurrency(r.total, currency) },
    { key: "amount_paid", label: "Paid", render: (r) => formatCurrency(r.amount_paid || 0, currency) },
    { key: "balance_due", label: "Due", render: (r) => formatCurrency(r.balance_due, currency) },
    { key: "payment_status", label: "Status", render: (r) => <StatusBadge status={r.payment_status} /> },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => toggleDeliveryItems(r.id)}>
          {expandedDeliveryId === r.id ? "Hide items" : "View items"}
        </Button>
      ),
    },
  ];

  const paymentColumns = [
    { key: "payment_date", label: "Date", render: (r) => r.payment_date },
    { key: "amount", label: "Amount", render: (r) => formatCurrency(r.amount, currency) },
    {
      key: "purchase_number",
      label: "For delivery",
      render: (r) => r.purchase_number || "Extra paid (next delivery)",
    },
    { key: "notes", label: "Notes", render: (r) => r.notes || "-" },
  ];

  const productColumns = [
    { key: "name", label: "Product" },
    { key: "sku", label: "SKU", render: (r) => r.sku || "-" },
    { key: "quantity", label: "Stock" },
    { key: "cost_price", label: "Cost", render: (r) => formatCurrency(r.cost_price, currency) },
  ];

  if (!supplier) return null;

  const balancePending = ledger?.summary?.balance_pending ?? 0;
  const amountDue = Math.max(0, balancePending);
  const advanceBalance = Math.max(0, -balancePending);

  function renderDeliveryItemsBlock(deliveryId) {
    if (expandedDeliveryId !== deliveryId) return null;

    const items = deliveryItems[deliveryId];
    if (loadingDeliveryId === deliveryId) {
      return (
        <div style={{ padding: "0.75rem 0", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          Loading items...
        </div>
      );
    }

    if (!items?.length) {
      return (
        <div style={{ padding: "0.75rem 0", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          No line items for this delivery.
        </div>
      );
    }

    return (
      <div
        style={{
          margin: "0.5rem 0 1rem",
          padding: "0.75rem",
          background: "var(--color-bg-subtle)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.875rem",
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.35rem 0",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span>
              {item.product_name} × {item.quantity}
            </span>
            <strong>{formatCurrency(item.total, currency)}</strong>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      closeOnOverlay={!submitting}
      title={`${supplier.company} — Account`}
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Close
        </Button>
      }
    >
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {error && <Alert>{error}</Alert>}

          {amountDue > 0.01 ? (
            <Alert type="warning" title="− Still to pay">
              You still need to pay this supplier {formatSignedCurrency(amountDue, currency, "out")}.
            </Alert>
          ) : advanceBalance > 0.01 ? (
            <Alert type="success" title="+ Extra paid">
              You already paid {formatSignedCurrency(advanceBalance, currency, "in")} extra. It will be used on the next delivery.
            </Alert>
          ) : (
            <Alert type="info" title="Settled">
              This account is settled. You can still pay extra — it will be used on the next delivery.
            </Alert>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <StatCard
              label="Total delivered"
              value={formatCurrency(ledger?.summary?.total_delivered ?? 0, currency)}
              icon={Truck}
              variant="info"
            />
            <StatCard
              label="Total paid"
              value={formatCurrency(ledger?.summary?.total_paid ?? 0, currency)}
              icon={Wallet}
              variant="success"
            />
            <StatCard
              label="Still to pay"
              value={formatSignedCurrency(amountDue, currency, "out")}
              icon={Wallet}
              variant={amountDue > 0 ? "danger" : "success"}
            />
            <StatCard
              label="Extra paid"
              value={formatSignedCurrency(advanceBalance, currency, "in")}
              icon={Wallet}
              variant={advanceBalance > 0 ? "success" : "info"}
            />
            <StatCard label="Linked products" value={String(products.length)} icon={Package} variant="primary" />
          </div>

          <Card style={{ marginBottom: "1.25rem" }}>
              <h4 className="card-title" style={{ marginBottom: "0.35rem" }}>
                Record payment (cash given to supplier)
              </h4>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                You can pay more than what you owe. Extra cash is kept as + Extra paid and used automatically on the next delivery.
              </p>
              <form onSubmit={handlePayment}>
                <div className="form-row">
                  <Input
                    label="Amount *"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    required
                  />
                  <Input
                    label="Payment date"
                    type="date"
                    value={payForm.paymentDate}
                    onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                  />
                  <Select
                    label="Apply to delivery (optional)"
                    value={payForm.purchaseId}
                    onChange={(e) => setPayForm({ ...payForm, purchaseId: e.target.value })}
                  >
                    <option value="">Oldest pending first, then extra paid</option>
                    {pendingDeliveries.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.purchase_number} — due {formatCurrency(d.balance_due, currency)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                  <Textarea
                    label="Notes"
                    value={payForm.notes}
                    onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                    placeholder="e.g. Paid extra for next delivery"
                  />
                </div>
                <Button type="submit" disabled={submitting} style={{ marginTop: "0.75rem" }}>
                  {submitting ? "Saving..." : "Record Payment"}
                </Button>
              </form>
            </Card>

          {!showFullLedger && (
            <>
              <h4 className="card-title" style={{ marginBottom: "0.5rem" }}>
                Recent deliveries
              </h4>
              <Table
                columns={deliveryColumns}
                data={(ledger?.deliveries ?? []).slice(0, 5)}
                emptyMessage="No deliveries yet"
              />
              {expandedDeliveryId &&
                (ledger?.deliveries ?? []).slice(0, 5).some((d) => d.id === expandedDeliveryId) &&
                renderDeliveryItemsBlock(expandedDeliveryId)}

              <h4 className="card-title" style={{ margin: "1.25rem 0 0.5rem" }}>
                Recent payments
              </h4>
              <Table
                columns={paymentColumns}
                data={(ledger?.payments ?? []).slice(0, 5)}
                emptyMessage="No payments recorded"
              />
            </>
          )}

          {showFullLedger && (
            <div style={{ marginBottom: "1.25rem" }}>
              <h4 className="card-title" style={{ marginBottom: "0.75rem" }}>
                Full account history
              </h4>
              {allRecords.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No records yet.</p>
              ) : (
                <div className="supplier-ledger-list">
                  {allRecords.map((record) => (
                    <div
                      key={record.id}
                      style={{
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        marginBottom: "0.5rem",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto auto",
                          gap: "0.75rem",
                          alignItems: "center",
                          padding: "0.75rem 1rem",
                          fontSize: "0.875rem",
                        }}
                      >
                        <Badge variant={record.recordType === "delivery" ? "info" : "success"}>
                          {record.recordType === "delivery" ? "Delivery" : "Payment"}
                        </Badge>
                        <div>
                          <strong>{record.reference}</strong>
                          <div style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
                            {record.recordType === "delivery"
                              ? formatDateTime(record.date)
                              : record.date}
                            {record.notes ? ` · ${record.notes}` : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {record.recordType === "delivery" ? (
                            <>
                              <div>{formatCurrency(record.amount, currency)}</div>
                              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                                Paid {formatCurrency(record.paid || 0, currency)} · Due{" "}
                                {formatCurrency(record.due ?? 0, currency)}
                              </div>
                            </>
                          ) : (
                            <div style={{ color: "var(--color-success)", fontWeight: 600 }}>
                              Paid {formatCurrency(record.amount, currency)}
                            </div>
                          )}
                        </div>
                        {record.recordType === "delivery" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleDeliveryItems(record.deliveryId)}
                            title="View products in this delivery"
                          >
                            {expandedDeliveryId === record.deliveryId ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </Button>
                        )}
                      </div>
                      {record.recordType === "delivery" &&
                        renderDeliveryItemsBlock(record.deliveryId)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {products.length > 0 && (
            <>
              <h4 className="card-title" style={{ margin: "1.25rem 0 0.5rem" }}>
                Products from this supplier
              </h4>
              <Table columns={productColumns} data={products} />
            </>
          )}

          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid var(--color-border)",
              textAlign: "center",
            }}
          >
            <Button
              variant="secondary"
              onClick={() => {
                setShowFullLedger((v) => !v);
                setExpandedDeliveryId(null);
              }}
            >
              <List size={16} />
              {showFullLedger
                ? "Show recent records only"
                : `View all account records (${allRecords.length})`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
