import { Package, ShoppingBag, Tag, TrendingUp } from "lucide-react";
import { formatCurrency, formatQuantity } from "../../utils/format";
import "./ProductValueTotals.css";

export default function ProductValueTotals({
  quantity = 0,
  purchaseTotal = 0,
  sellingTotal = 0,
  currency = "SAR",
  compact = false,
  productCount,
  unitSymbol,
}) {
  const qty = Number(quantity) || 0;
  const purchase = Number(purchaseTotal) || 0;
  const selling = Number(sellingTotal) || 0;
  const profit = selling - purchase;
  const qtyLabel = unitSymbol ? formatQuantity(qty, unitSymbol) : String(qty);

  return (
    <div className={`product-value-totals ${compact ? "compact" : ""}`}>
      <div className="product-value-totals-head">
        <strong>{compact ? "Line totals" : "Stock value"}</strong>
        <small>
          {compact
            ? "Cost × quantity (purchase) and selling price × quantity"
            : productCount != null
              ? `${productCount} product${productCount === 1 ? "" : "s"} · quantity × price`
              : "Quantity × cost and quantity × selling price"}
        </small>
      </div>
      <div className="product-value-totals-grid">
        <div className="product-value-totals-item purchase">
          <span className="product-value-totals-icon">
            <ShoppingBag size={compact ? 14 : 16} />
          </span>
          <span className="product-value-totals-label">Purchase total</span>
          <strong>{formatCurrency(purchase, currency)}</strong>
          <small>Cost price × qty</small>
        </div>
        <div className="product-value-totals-item selling">
          <span className="product-value-totals-icon">
            <Tag size={compact ? 14 : 16} />
          </span>
          <span className="product-value-totals-label">Selling total</span>
          <strong>{formatCurrency(selling, currency)}</strong>
          <small>Selling price × qty</small>
        </div>
        <div className="product-value-totals-item qty">
          <span className="product-value-totals-icon">
            <Package size={compact ? 14 : 16} />
          </span>
          <span className="product-value-totals-label">Quantity</span>
          <strong>{qtyLabel}</strong>
          <small>On-hand stock</small>
        </div>
        <div className={`product-value-totals-item profit ${profit >= 0 ? "up" : "down"}`}>
          <span className="product-value-totals-icon">
            <TrendingUp size={compact ? 14 : 16} />
          </span>
          <span className="product-value-totals-label">Potential profit</span>
          <strong>{formatCurrency(profit, currency)}</strong>
          <small>If all stock is sold</small>
        </div>
      </div>
    </div>
  );
}
