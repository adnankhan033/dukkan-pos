import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Badge from "../common/Badge";
import { Input, Select, Textarea } from "../common/Input";
import { Card, StatCard } from "../common/Card";
import { LoadingSpinner, Alert } from "../common/Loading";
import { useSubmitGuard } from "../../hooks/useSubmitGuard";
import { customerService } from "../../services/CustomerService";
import { paymentMethodService } from "../../services/PaymentMethodService";
import { SALE_PAYMENT_STATUS_LABELS } from "../../utils/constants";
import { resolvePaymentMethodLabel } from "../../utils/paymentMethods";
import { formatCurrency, formatDateTime } from "../../utils/format";

function StatusBadge({ status }) {
  const variant = status === "paid" ? "success" : status === "pending" ? "warning" : "info";
  return <Badge variant={variant}>{SALE_PAYMENT_STATUS_LABELS[status] || status}</Badge>;
}

export default function CustomerAccountModal({ customer, currency, isOpen, onClose, onUpdated }) {
  const { submitting, guard } = useSubmitGuard();
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [error, setError] = useState("");
  const [showFullLedger, setShowFullLedger] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "",
    saleId: "",
    paymentMethod: "cash",
    notes: "",
    paymentDate: "",
  });

  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!customer?.id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [ledgerData, methods] = await Promise.all([
        customerService.getLedger(customer.id),
        paymentMethodService.getActiveForPos(),
      ]);
      setLedger(ledgerData);
      setPaymentMethods(methods.filter((m) => m.code !== "pay_later"));
    } catch (err) {
      setLedger(null);
      setLoadError(err.message || "Could not load customer account");
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    if (isOpen && customer) {
      setError("");
      setShowFullLedger(false);
      setPayForm({
        amount: "",
        saleId: "",
        paymentMethod: "cash",
        notes: "",
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      load();
    }
  }, [isOpen, customer, load]);

  const pendingOrders = useMemo(
    () =>
      (ledger?.orders ?? []).filter(
        (order) => order.payment_status === "pending" || order.payment_status === "partial"
      ),
    [ledger]
  );

  const allRecords = useMemo(() => {
    const orders = (ledger?.orders ?? []).map((order) => ({
      recordType: "order",
      sortDate: order.created_at,
      id: `o-${order.id}`,
      orderId: order.id,
      reference: order.sale_number,
      date: order.created_at,
      amount: order.total,
      paid: order.amount_paid,
      due: order.balance_due,
      status: order.payment_status,
    }));
    const payments = (ledger?.payments ?? []).map((payment) => ({
      recordType: "payment",
      sortDate: payment.payment_date || payment.created_at,
      id: `p-${payment.id}`,
      reference: payment.sale_number || "General payment",
      date: payment.payment_date || payment.created_at,
      amount: payment.amount,
      method: payment.payment_method,
      notes: payment.notes,
    }));
    return [...orders, ...payments].sort(
      (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
    );
  }, [ledger]);

  const visibleRecords = showFullLedger ? allRecords : allRecords.slice(0, 8);
  const balanceDue = ledger?.summary?.balance_pending ?? 0;
  const canRecordPayment = balanceDue > 0.01 || pendingOrders.length > 0;

  async function handlePayment(e) {
    e.preventDefault();
    setError("");
    try {
      await guard(async () => {
        await customerService.recordPayment({
          customerId: customer.id,
          amount: payForm.amount,
          notes: payForm.notes,
          saleId: payForm.saleId ? Number(payForm.saleId) : null,
          paymentMethod: payForm.paymentMethod,
          paymentDate: payForm.paymentDate || null,
        });
        onUpdated?.();
        await load();
        setPayForm((prev) => ({ ...prev, amount: "", saleId: "", notes: "" }));
      });
    } catch (err) {
      setError(err.message);
    }
  }

  function fillBalance() {
    const target = payForm.saleId
      ? pendingOrders.find((order) => String(order.id) === String(payForm.saleId))
      : null;
    const amount = target?.balance_due ?? ledger?.summary?.balance_pending ?? 0;
    setPayForm((prev) => ({ ...prev, amount: String(amount) }));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer ? `${customer.name} — Account` : "Customer Account"}
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loading ? (
        <LoadingSpinner message="Loading account..." />
      ) : (
        <>
          {loadError && <Alert type="error">{loadError}</Alert>}
          <div className="customer-account-stats">
            <StatCard
              icon={Receipt}
              label="Total invoiced"
              value={formatCurrency(ledger?.summary?.total_invoiced ?? 0, currency)}
            />
            <StatCard
              icon={Wallet}
              label="Total paid"
              value={formatCurrency(ledger?.summary?.total_paid ?? 0, currency)}
            />
            <StatCard
              icon={Wallet}
              label="Balance due"
              value={formatCurrency(balanceDue, currency)}
              variant={balanceDue > 0 ? "warning" : "primary"}
            />
          </div>

          {canRecordPayment && (
            <Card className="customer-account-pay-card">
              <h4>Record payment</h4>
              {error && <Alert type="error">{error}</Alert>}
              <form onSubmit={handlePayment} className="customer-account-pay-form">
                <div className="form-row">
                  <Select
                    label="Apply to invoice"
                    value={payForm.saleId}
                    onChange={(e) => setPayForm({ ...payForm, saleId: e.target.value })}
                  >
                    <option value="">Oldest unpaid first (auto)</option>
                    {pendingOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.sale_number} — due {formatCurrency(order.balance_due, currency)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Payment method"
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.code} value={method.code}>
                        {method.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="form-row">
                  <Input
                    label="Amount"
                    type="number"
                    min="0"
                    step="0.01"
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
                </div>
                <Textarea
                  label="Notes"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                />
                <div className="customer-account-pay-actions">
                  <Button type="button" variant="secondary" onClick={fillBalance}>
                    Fill balance
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Record payment"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card className="customer-account-ledger">
            <div className="customer-account-ledger-header">
              <h4>Account history</h4>
              {allRecords.length > 8 && (
                <Button variant="ghost" size="sm" onClick={() => setShowFullLedger((v) => !v)}>
                  {showFullLedger ? (
                    <>
                      <ChevronUp size={14} /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Show all ({allRecords.length})
                    </>
                  )}
                </Button>
              )}
            </div>
            {visibleRecords.length === 0 ? (
              <p className="customer-account-empty">No orders or payments yet.</p>
            ) : (
              <div className="customer-account-records">
                {visibleRecords.map((record) => (
                  <div key={record.id} className={`customer-account-record ${record.recordType}`}>
                    <div>
                      <strong>{record.reference}</strong>
                      <small>{formatDateTime(record.date)}</small>
                    </div>
                    <div className="customer-account-record-meta">
                      {record.recordType === "order" ? (
                        <>
                          <StatusBadge status={record.status} />
                          <span>{formatCurrency(record.amount, currency)}</span>
                          {record.due > 0 && (
                            <span className="customer-account-due">
                              Due {formatCurrency(record.due, currency)}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Badge variant="success">Payment</Badge>
                          <span>{formatCurrency(record.amount, currency)}</span>
                          <span className="customer-account-method">
                            {resolvePaymentMethodLabel(record.method, paymentMethods)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </Modal>
  );
}
