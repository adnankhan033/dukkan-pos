import { Printer, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Badge from "../common/Badge";
import ZatcaOrderStatusBadge from "../zatca/ZatcaOrderStatusBadge";
import ZatcaInvoiceXmlActions from "../zatca/ZatcaInvoiceXmlActions";
import ZatcaSyncedQrDisplay from "../zatca/ZatcaSyncedQrDisplay";
import ProductBilingualName from "../products/ProductBilingualName";
import { LoadingSpinner } from "../common/Loading";
import { formatCurrency, formatOrderDateTime, formatDateTime } from "../../utils/format";
import { SALE_STATUS } from "../../utils/constants";
import "./OrderDetailModal.css";

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
  onClose,
  onPrint,
  onReturn,
}) {
  if (!isOpen) return null;

  const lineItems = sale?.items || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={sale ? `Order ${sale.sale_number}` : "Order Details"}
      size="xl"
      footer={
        sale && !loading ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {sale.status !== SALE_STATUS.HELD && (
              <Button variant="secondary" onClick={() => onReturn?.(sale)}>
                <RotateCcw size={16} /> Return Items
              </Button>
            )}
            <Button onClick={() => onPrint?.(sale)}>
              <Printer size={16} /> Print Receipt
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
          <div className="order-detail-grid">
            <section className="order-detail-section">
              <h4>Order Info</h4>
              <dl className="order-detail-dl">
                <dt>Status</dt>
                <dd>{statusBadge(sale.status)}</dd>
                <dt>Date</dt>
                <dd>{formatOrderDateTime(sale.created_at)}</dd>
                <dt>Customer</dt>
                <dd>{sale.customer_name || "Walk-in Customer"}</dd>
                <dt>Payment</dt>
                <dd style={{ textTransform: "capitalize" }}>{sale.payment_method || "cash"}</dd>
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
                <div><span>Subtotal</span><span>{formatCurrency(sale.subtotal, currency)}</span></div>
                <div><span>Discount</span><span>{formatCurrency(sale.discount, currency)}</span></div>
                <div><span>VAT ({vatPercent}%)</span><span>{formatCurrency(sale.vat, currency)}</span></div>
                <div className="grand"><span>Total</span><span>{formatCurrency(sale.total, currency)}</span></div>
              </div>
            </section>
          </div>

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
            <h4>Items ({lineItems.length})</h4>
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
