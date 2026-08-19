import { CheckCircle2, Package } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import ProductBilingualName from "../products/ProductBilingualName";
import { formatCurrency, formatQuantity } from "../../utils/format";
import { cartItemDisplayLineTotal, cartItemDisplayUnitPrice } from "../../utils/vatPricing";
import "./CartVerifyModal.css";

export default function CartVerifyModal({
  isOpen,
  cart = [],
  customerName = null,
  subtotal,
  discount,
  vat,
  grandTotal,
  currency,
  vatPercent,
  onClose,
}) {
  const itemCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify selected items"
      footer={
        <Button onClick={onClose}>
          <CheckCircle2 size={16} /> Looks good
        </Button>
      }
    >
      <div className="cart-verify">
        <div className="cart-verify-hero">
          <span className="cart-verify-hero-icon" aria-hidden="true">
            <Package size={18} />
          </span>
          <div>
            <p>
              {cart.length} {cart.length === 1 ? "line" : "lines"} · {itemCount}{" "}
              {itemCount === 1 ? "item" : "items"}
            </p>
            <strong>{formatCurrency(grandTotal, currency)}</strong>
          </div>
          <span className="cart-verify-customer">{customerName || "Walk-in"}</span>
        </div>

        <div className="cart-verify-table" role="table">
          <div className="cart-verify-head" role="row">
            <span>#</span>
            <span>Item</span>
            <span>Qty</span>
            <span>Each</span>
            <span>Total</span>
          </div>
          {cart.map((item, index) => (
            <div key={item.product_id} className="cart-verify-row" role="row">
              <span className="cart-verify-index">{index + 1}</span>
              <div className="cart-verify-name">
                <ProductBilingualName name={item.name} nameAr={item.name_ar} size="sm" />
              </div>
              <span className="cart-verify-qty">
                ×{formatQuantity(item.quantity, item.unit_symbol)}
              </span>
              <span>{formatCurrency(cartItemDisplayUnitPrice(item), currency)}</span>
              <strong>{formatCurrency(cartItemDisplayLineTotal(item), currency)}</strong>
            </div>
          ))}
        </div>

        <div className="cart-verify-totals">
          <div>
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          <div>
            <span>Discount</span>
            <span>{formatCurrency(discount, currency)}</span>
          </div>
          <div>
            <span>VAT ({vatPercent}%)</span>
            <span>{formatCurrency(vat, currency)}</span>
          </div>
          <div className="cart-verify-grand">
            <span>Total due</span>
            <strong>{formatCurrency(grandTotal, currency)}</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
}
