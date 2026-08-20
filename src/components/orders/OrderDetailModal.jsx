import { useEffect, useMemo, useState } from "react";
import { Printer, RotateCcw, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Badge from "../common/Badge";
import { Input } from "../common/Input";
import ReceiptPreviewFrame from "../receipt/ReceiptPreviewFrame";
import ZatcaOrderStatusBadge from "../zatca/ZatcaOrderStatusBadge";
import ZatcaInvoiceXmlActions from "../zatca/ZatcaInvoiceXmlActions";
import ZatcaSyncedQrDisplay from "../zatca/ZatcaSyncedQrDisplay";
import ProductBilingualName from "../products/ProductBilingualName";
import InvoiceRevisionTimeline from "./InvoiceRevisionTimeline";
import { LoadingSpinner, Alert } from "../common/Loading";
import { customerService } from "../../services/CustomerService";
import { formatCurrency, formatOrderDateTime, formatDateTime } from "../../utils/format";
import { SALE_STATUS } from "../../utils/constants";
import { isTaxEnabled } from "../../utils/vatPricing";
import { resolvePaymentMethodLabel } from "../../utils/paymentMethods";
import { revisionLabel, saleViewForRevision, originalInvoiceBalance } from "../../utils/invoiceRevisions";
import "./OrderDetailModal.css";

function paymentStatusBadge(status) {
  if (status === "pending") return <Badge variant="warning">Unpaid</Badge>;
  if (status === "partial") return <Badge variant="info">Partial</Badge>;
  return <Badge variant="success">Paid</Badge>;
}

function statusBadge(status) {
  if (status === SALE_STATUS.RETURNED) return <Badge variant="neutral">Returned</Badge>;
  if (status === SALE_STATUS.PARTIAL_RETURN) return <Badge variant="warning">Partial Return</Badge>;
  if (status === SALE_STATUS.HELD) return <Badge variant="warning">Held</Badge>;
  return <Badge variant="success">Completed</Badge>;
}

export default function OrderDetailModal({
  isOpen,
  loading = false,
  sale,
  returns = [],
  zatcaRecord = null,
  showZatca = false,
  currency,
  vatPercent,
  settings,
  onClose,
  onPrint,
  onReturn,
  onUpdate,
  onPaymentRecorded,
  initialRevision = null,
}) {
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState("");
  const [paying, setPaying] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState(null);

  const revisions = sale?.revisions || [];
  const currentRevision = Number(sale?.revision) || revisions[revisions.length - 1]?.revision || 1;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedRevision(initialRevision || currentRevision);
    setPayAmount("");
    setPayError("");
  }, [isOpen, sale?.id, currentRevision, initialRevision]);

  const viewingRevision =
    revisions.find((row) => Number(row.revision) === Number(selectedRevision || currentRevision)) ||
    null;
  const viewSale = useMemo(
    () => saleViewForRevision(sale, viewingRevision),
    [sale, viewingRevision]
  );

  if (!isOpen) return null;

  const lineItems = viewSale?.items || [];
  const balanceDue = originalInvoiceBalance(sale);
  const canRecordPayment =
    sale?.customer_id &&
    balanceDue > 0 &&
    sale.status !== SALE_STATUS.HELD &&
    !viewSale?.isHistorical;
  const viewingLabel = revisionLabel(viewSale?.viewingRevision || currentRevision);

  async function handleRecordPayment() {
    if (!sale?.customer_id) return;
    setPayError("");
    setPaying(true);
    try {
      await customerService.recordPayment({
        customerId: sale.customer_id,
        amount: payAmount || balanceDue,
        saleId: sale.id,
        paymentMethod: "cash",
      });
      setPayAmount("");
      await onPaymentRecorded?.();
    } catch (err) {
      setPayError(err.message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        sale
          ? revisions.length > 0
            ? `Order ${sale.sale_number} · ${viewingLabel}`
            : `Order ${sale.sale_number}`
          : "Order Details"
      }
      size="xl"
      footer={
        sale && !loading ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {sale.status === SALE_STATUS.COMPLETED && onUpdate && !viewSale?.isHistorical && (
              <Button variant="secondary" onClick={() => onUpdate(sale)}>
                <Pencil size={16} /> Update Invoice
              </Button>
            )}
            {sale.status !== SALE_STATUS.HELD && !viewSale?.isHistorical && (
              <Button variant="secondary" onClick={() => onReturn?.(sale)}>
                <RotateCcw size={16} /> Return Items
              </Button>
            )}
            <Button onClick={() => onPrint?.(viewSale || sale)}>
              <Printer size={16} /> {viewSale?.isHistorical ? `Print ${viewingLabel}` : "Print Receipt"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {loading ? (
        <LoadingSpinner message="Loading order details..." />
      ) : !sale ? (
        <p className="order-detail-empty">Order could not be loaded.</p>
      ) : (
        <>
          {revisions.length > 0 ? (
            <InvoiceRevisionTimeline
              revisions={revisions}
              currentRevision={currentRevision}
              selectedRevision={viewSale?.viewingRevision || currentRevision}
              currency={currency}
              onSelect={setSelectedRevision}
            />
          ) : null}

          {viewSale?.isHistorical ? (
            <Alert type="info" title={`Viewing ${viewingLabel}`}>
              This is a saved snapshot. The latest invoice is Revision {currentRevision}. Print uses
              the version you are viewing.
            </Alert>
          ) : null}

          <div className="order-detail-grid">
            <section className="order-detail-section">
              <h4>Order Info</h4>
              <dl className="order-detail-dl">
                <dt>Status</dt>
                <dd>{statusBadge(sale.status)}</dd>
                <dt>Date</dt>
                <dd>{formatOrderDateTime(viewSale?.created_at || sale.created_at)}</dd>
                <dt>Customer</dt>
                <dd>{viewSale?.customer_name || sale.customer_name || "Walk-in Customer"}</dd>
                <dt>Payment</dt>
                <dd style={{ textTransform: "capitalize" }}>
                  {resolvePaymentMethodLabel(viewSale?.payment_method || sale.payment_method)}
                </dd>
                <dt>Collection</dt>
                <dd>{paymentStatusBadge(sale.payment_status || "paid")}</dd>
                <dt>Amount paid</dt>
                <dd>{formatCurrency(sale.amount_paid || 0, currency)}</dd>
                {balanceDue > 0 && (
                  <>
                    <dt>Balance due</dt>
                    <dd style={{ color: "var(--color-danger)", fontWeight: 700 }}>
                      {formatCurrency(balanceDue, currency)}
                    </dd>
                  </>
                )}
                {sale.notes && (
                  <>
                    <dt>Notes</dt>
                    <dd>{sale.notes}</dd>
                  </>
                )}
              </dl>
            </section>

            <section className="order-detail-section">
              <h4>Totals</h4>
              <div className="order-totals">
                <div><span>Subtotal</span><span>{formatCurrency(viewSale?.subtotal ?? sale.subtotal, currency)}</span></div>
                <div><span>Discount</span><span>{formatCurrency(viewSale?.discount ?? sale.discount, currency)}</span></div>
                {isTaxEnabled(settings) || Number(viewSale?.vat ?? sale.vat) > 0 ? (
                  <div><span>VAT ({vatPercent}%)</span><span>{formatCurrency(viewSale?.vat ?? sale.vat, currency)}</span></div>
                ) : null}
                <div className="grand"><span>Total</span><span>{formatCurrency(viewSale?.total ?? sale.total, currency)}</span></div>
              </div>
            </section>
          </div>

          {canRecordPayment && (
            <section className="order-detail-section order-detail-payment-box">
              <h4>Record customer payment</h4>
              {payError && <Alert type="error">{payError}</Alert>}
              <div className="order-detail-payment-form">
                <Input
                  label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={String(balanceDue)}
                />
                <Button onClick={handleRecordPayment} disabled={paying}>
                  {paying ? "Saving..." : `Record ${formatCurrency(payAmount || balanceDue, currency)}`}
                </Button>
              </div>
              <p className="order-detail-payment-hint">
                Payment will be linked to this invoice and added to {sale.customer_name}&apos;s account.
              </p>
            </section>
          )}

          {sale.status !== SALE_STATUS.HELD && (
            <section className="order-detail-section order-detail-receipt-preview">
              <h4>Receipt Preview</h4>
              <ReceiptPreviewFrame
                sale={viewSale || sale}
                items={lineItems}
                settings={settings}
                currency={currency}
                label=""
                compact
              />
            </section>
          )}

          {showZatca && (
            <section className="order-detail-section" style={{ marginTop: "1rem" }}>
              <h4>ZATCA E-Invoice</h4>
              {zatcaRecord ? (
                <>
                  <ZatcaSyncedQrDisplay record={zatcaRecord} />
                  <dl className="order-detail-dl">
                    <dt>Sync status</dt>
                    <dd>
                      <ZatcaOrderStatusBadge status={zatcaRecord.status} />
                    </dd>
                    <dt>Environment</dt>
                    <dd>{zatcaRecord.environment || "—"}</dd>
                    {zatcaRecord.synced_at && (
                      <>
                        <dt>Synced at</dt>
                        <dd>{formatDateTime(zatcaRecord.synced_at)}</dd>
                      </>
                    )}
                    {zatcaRecord.last_attempt_at && (
                      <>
                        <dt>Last attempt</dt>
                        <dd>{formatDateTime(zatcaRecord.last_attempt_at)}</dd>
                      </>
                    )}
                    {zatcaRecord.next_retry_at && (
                      <>
                        <dt>Next retry</dt>
                        <dd>{formatDateTime(zatcaRecord.next_retry_at)}</dd>
                      </>
                    )}
                    {zatcaRecord.error_message && (
                      <>
                        <dt>Error</dt>
                        <dd className="order-detail-zatca-error">{zatcaRecord.error_message}</dd>
                      </>
                    )}
                  </dl>
                  <ZatcaInvoiceXmlActions record={zatcaRecord} />
                </>
              ) : (
                <p className="order-detail-empty">
                  No ZATCA queue entry for this order (sale may pre-date Phase 2 or ZATCA was disabled).
                </p>
              )}
              <Link to="/zatca-sync" className="order-detail-zatca-link">
                Open Daily ZATCA Sync →
              </Link>
            </section>
          )}

          <section className="order-detail-section" style={{ marginTop: "1rem" }}>
            <h4>
              Items ({lineItems.length})
              {revisions.length > 0 ? ` · ${viewingLabel}` : ""}
            </h4>
            {lineItems.length === 0 ? (
              <p className="order-detail-empty">No line items recorded for this order.</p>
            ) : (
              <div className="order-items-table-wrap">
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id ?? `${item.product_id}-${item.unit_price}`}>
                        <td>
                          <ProductBilingualName
                            name={item.product_name || item.name}
                            nameAr={item.name_ar}
                            size="sm"
                          />
                          {item.barcode && (
                            <div className="order-item-barcode">{item.barcode}</div>
                          )}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.unit_price, currency)}</td>
                        <td>{formatCurrency(item.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {returns.length > 0 && (
            <section className="order-detail-section" style={{ marginTop: "1rem" }}>
              <h4>Return History</h4>
              <div className="order-returns-list">
                {returns.map((ret) => (
                  <div key={ret.id} className="order-return-row">
                    <div>
                      <strong>{ret.return_number}</strong>
                      <span className="order-return-date">{formatOrderDateTime(ret.created_at)}</span>
                    </div>
                    <div className="order-return-summary">{ret.items_summary || "—"}</div>
                    <strong>{formatCurrency(ret.total_refund, currency)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
