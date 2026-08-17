import { CheckCircle2, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../common/Button";
import ProductBilingualName from "../products/ProductBilingualName";
import ReceiptPreviewFrame from "../receipt/ReceiptPreviewFrame";
import { formatCurrency } from "../../utils/format";
import "./SaleCompleteModal.css";

export default function SaleCompleteModal({
  step,
  paymentMethod,
  paymentMethodLabel,
  collectsCash = false,
  cart,
  subtotal,
  discount,
  vat,
  grandTotal,
  cashReceived,
  changeDue,
  balanceDue = 0,
  isPayLater = false,
  customerName = null,
  currency,
  vatPercent,
  completedSale,
  settings,
  processing = false,
  printingReceipt = false,
  zatcaQueued = false,
  onConfirmComplete,
  onCancel,
  onPrint,
  onSkipPrint,
}) {
  if (!step) return null;

  const methodLabel =
    paymentMethodLabel ||
    String(paymentMethod || "cash").replace(/_/g, " ");
  const showCashFields = collectsCash || paymentMethod === "cash";

  return (
    <div className="sale-complete-overlay" onClick={step === "confirm" ? onCancel : undefined}>
      <div
        className={`sale-complete-modal ${step === "print" ? "sale-complete-modal--with-preview" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {step === "confirm" && (
          <>
            <div className="sale-complete-header">
              <h3>{isPayLater ? "Complete pay later order?" : "Complete this sale?"}</h3>
              <p>
                {isPayLater
                  ? "The invoice will be saved on the customer's account. Payment can be recorded later."
                  : "Review the order before confirming payment."}
              </p>
            </div>
            <div className="sale-complete-body">
              {isPayLater && (
                <div className="sale-complete-credit-note">
                  <strong>Customer:</strong> {customerName || "Selected customer"}
                  <span>Balance due after sale: {formatCurrency(grandTotal, currency)}</span>
                </div>
              )}
              <div className="sale-complete-items">
                {cart.map((item) => (
                  <div key={item.product_id} className="sale-complete-item">
                    <div className="sale-complete-item-name">
                      <ProductBilingualName name={item.name} nameAr={item.name_ar} size="sm" />
                      <span className="sale-complete-item-qty">× {item.quantity}</span>
                    </div>
                    <strong>{formatCurrency(item.total, currency)}</strong>
                  </div>
                ))}
              </div>
              <div className="sale-complete-summary">
                <div className="sale-complete-row">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="sale-complete-row">
                  <span>Discount</span>
                  <span>{formatCurrency(discount, currency)}</span>
                </div>
                <div className="sale-complete-row">
                  <span>VAT ({vatPercent}%)</span>
                  <span>{formatCurrency(vat, currency)}</span>
                </div>
                {showCashFields && (
                  <>
                    <div className="sale-complete-row">
                      <span>Cash received</span>
                      <span>{formatCurrency(cashReceived, currency)}</span>
                    </div>
                    {balanceDue > 0 ? (
                      <div className="sale-complete-row">
                        <span>Balance due</span>
                        <span>{formatCurrency(balanceDue, currency)}</span>
                      </div>
                    ) : (
                      <div className="sale-complete-row">
                        <span>Change</span>
                        <span>{formatCurrency(changeDue, currency)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="sale-complete-row">
                  <span>Payment</span>
                  <span>{methodLabel}</span>
                </div>
                <div className="sale-complete-row grand">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal, currency)}</span>
                </div>
              </div>
            </div>
            <div className="sale-complete-footer">
              <Button variant="secondary" onClick={onCancel} disabled={processing}>
                No, Cancel
              </Button>
              <Button onClick={onConfirmComplete} disabled={processing}>
                {processing
                  ? "Processing..."
                  : isPayLater
                    ? "Yes, Save On Account"
                    : "Yes, Complete Sale"}
              </Button>
            </div>
          </>
        )}

        {step === "print" && completedSale && (
          <>
            <div className="sale-complete-body sale-complete-body--print">
              <div className="sale-complete-success sale-complete-success--compact">
                <div className="sale-complete-success-icon">
                  <CheckCircle2 size={28} />
                </div>
                <h4>Sale completed!</h4>
                <p>
                  <strong>{completedSale.sale_number}</strong> — {formatCurrency(completedSale.total, currency)}
                </p>
              </div>

              <ReceiptPreviewFrame
                sale={completedSale}
                items={completedSale.items}
                settings={settings}
                currency={currency}
                label="Receipt preview"
              />

              <p className="sale-complete-print-hint">
                {printingReceipt
                  ? "Print dialog open — cancel or print, then tap Done when finished."
                  : "Review the receipt above, then print or tap Done."}
              </p>

              {zatcaQueued && (
                <p className="sale-complete-zatca-note">
                  Invoice queued for ZATCA.{" "}
                  <Link to="/zatca-sync">View today&apos;s sync status →</Link>
                </p>
              )}
            </div>
            <div className="sale-complete-footer split">
              <Button variant="secondary" onClick={onSkipPrint} disabled={printingReceipt}>
                Done
              </Button>
              <div className="footer-actions">
                <Button onClick={onPrint} disabled={printingReceipt}>
                  <Printer size={16} /> {printingReceipt ? "Printing…" : "Print Receipt"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
