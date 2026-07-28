import { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  Printer,
  Pause,
  CreditCard,
  Banknote,
  RotateCcw,
} from "lucide-react";
import { productService } from "../services/ProductService";
import { customerService } from "../services/CustomerService";
import { saleService } from "../services/SaleService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Select } from "../components/common/Input";
import SaleCompleteModal from "../components/sales/SaleCompleteModal";
import SaleReturnModal from "../components/sales/SaleReturnModal";
import ProductBilingualName from "../components/products/ProductBilingualName";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, calcVat, calcGrandTotal } from "../utils/format";
import { printReceipt } from "../utils/receipt";
import { PAYMENT_METHODS, SALE_STATUS } from "../utils/constants";
import "./Sales.css";

export default function Sales() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const vatPercent = Number(settings.vat_percent) || 0;
  const { submitting, guard } = useSubmitGuard();

  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentTab, setPaymentTab] = useState(PAYMENT_METHODS.CASH);
  const [cashReceived, setCashReceived] = useState("");
  const [heldSales, setHeldSales] = useState([]);
  const [lastSale, setLastSale] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [completeStep, setCompleteStep] = useState(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(PAYMENT_METHODS.CASH);
  const [completedSale, setCompletedSale] = useState(null);
  const [returnOpen, setReturnOpen] = useState(false);

  useEffect(() => {
    async function init() {
      const [products, customerResult, held] = await Promise.all([
        productService.getPosCatalog(),
        customerService.getAll({ limit: 100, page: 1 }),
        saleService.getHeldSales(),
      ]);
      setCatalog(products);
      setCustomers(customerResult.items);
      setHeldSales(held);
      setCatalogLoading(false);
    }
    init();
  }, []);

  const displayedProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalog.slice(0, 60);
    return catalog.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.name_ar?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
    );
  }, [catalog, search]);

  async function handleBarcodeSearch(e) {
    if (e.key !== "Enter" || !search.trim()) return;
    const exact = catalog.find((p) => p.barcode === search.trim());
    if (exact) {
      addToCart(exact);
      setSearch("");
      return;
    }
    const product = await productService.getByBarcode(search.trim());
    if (product) addToCart(product);
    setSearch("");
  }

  function addToCart(product) {
    setError("");
    setMessage("");
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                total: (i.quantity + 1) * i.unit_price,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          name_ar: product.name_ar || "",
          unit_price: product.selling_price,
          quantity: 1,
          discount: 0,
          total: product.selling_price,
        },
      ];
    });
  }

  function updateQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i;
          const qty = i.quantity + delta;
          if (qty <= 0) return null;
          return { ...i, quantity: qty, total: qty * i.unit_price };
        })
        .filter(Boolean)
    );
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  }

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const vat = calcVat(subtotal, Number(discount), vatPercent);
  const grandTotal = calcGrandTotal(subtotal, Number(discount), vat);
  const received = Number(cashReceived) || 0;
  const changeDue = Math.max(0, received - grandTotal);
  const balanceDue = Math.max(0, grandTotal - received);

  async function refreshCatalog() {
    const products = await productService.getPosCatalog();
    setCatalog(products);
  }

  function validateBeforeComplete() {
    if (cart.length === 0) {
      setError("Cart is empty");
      return false;
    }
    setError("");
    return true;
  }

  function openCompleteConfirm(paymentMethod) {
    if (!validateBeforeComplete()) return;
    setPendingPaymentMethod(paymentMethod);
    setCompleteStep("confirm");
  }

  function closeCompleteFlow() {
    setCompleteStep(null);
    setCompletedSale(null);
  }

  async function handleConfirmComplete() {
    const cartSnapshot = [...cart];
    try {
      await guard(async () => {
        const sale = await saleService.createSale({
          customerId: customerId ? Number(customerId) : null,
          items: cartSnapshot,
          discount: Number(discount),
          vat,
          paymentMethod: pendingPaymentMethod,
          status: SALE_STATUS.COMPLETED,
        });

        if (!sale) {
          throw new Error("Sale could not be saved. Please try again.");
        }

        const lineItems = sale.items?.length
          ? sale.items
          : cartSnapshot.map((item) => ({
              product_id: item.product_id,
              product_name: item.name,
              name: item.name,
              name_ar: item.name_ar,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: item.discount || 0,
              total: item.total,
            }));

        const receiptSale = {
          ...sale,
          amount_received: pendingPaymentMethod === PAYMENT_METHODS.CASH ? received : null,
          change_due: pendingPaymentMethod === PAYMENT_METHODS.CASH ? changeDue : null,
          balance_due: pendingPaymentMethod === PAYMENT_METHODS.CASH ? balanceDue : null,
          items: lineItems,
        };

        setLastSale(receiptSale);
        setCompletedSale(receiptSale);
        setCart([]);
        setDiscount(0);
        setCashReceived("");
        await refreshCatalog();
        setCompleteStep("print");
      });
    } catch (err) {
      setError(err.message);
      closeCompleteFlow();
    }
  }

  async function handlePrintReceipt() {
    if (!completedSale) return;
    try {
      await printReceipt({
        sale: completedSale,
        items: completedSale.items,
        settings,
        currency,
      });
      setMessage(`Receipt printed — ${completedSale.sale_number}`);
    } catch (err) {
      setError(err.message || "Print failed");
    }
    closeCompleteFlow();
  }

  function handleSkipPrint() {
    if (completedSale) {
      setMessage(`Sale ${completedSale.sale_number} completed successfully`);
    }
    closeCompleteFlow();
  }

  async function completeHeldSale(paymentMethod) {
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }
    try {
      await guard(async () => {
        const sale = await saleService.createSale({
          customerId: customerId ? Number(customerId) : null,
          items: cart,
          discount: Number(discount),
          vat,
          paymentMethod,
          status: SALE_STATUS.HELD,
        });
        setMessage(`Sale held — ${sale.sale_number}`);
        setHeldSales(await saleService.getHeldSales());
        setCart([]);
        setDiscount(0);
        setCashReceived("");
        setError("");
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePrintLast() {
    if (!lastSale) {
      setError("Complete a sale first to print receipt");
      return;
    }
    try {
      await printReceipt({
        sale: lastSale,
        items: lastSale.items,
        settings,
        currency,
      });
      setMessage(`Receipt printed — ${lastSale.sale_number}`);
    } catch (err) {
      setError(err.message || "Print failed");
    }
  }

  async function resumeHeld(saleId) {
    const sale = await saleService.getById(saleId);
    if (!sale?.items?.length) return;
    setCart(
      sale.items.map((i) => ({
        product_id: i.product_id,
        name: i.product_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
        discount: i.discount,
        total: i.total,
      }))
    );
    setDiscount(sale.discount);
    setCustomerId(sale.customer_id || "");
    await saleService.deleteHeldSale(saleId);
    setHeldSales(await saleService.getHeldSales());
  }

  if (catalogLoading) {
    return <LoadingSpinner message="Loading products..." />;
  }

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Process sales and manage the POS cart."
        actions={
          <Button variant="secondary" onClick={() => setReturnOpen(true)}>
            <RotateCcw size={16} /> Return
          </Button>
        }
      />

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}

      {heldSales.length > 0 && (
        <div className="pos-held-sales">
          <strong style={{ fontSize: "0.875rem" }}>Held:</strong>
          {heldSales.map((s) => (
            <Button key={s.id} variant="secondary" size="sm" onClick={() => resumeHeld(s.id)}>
              {s.sale_number} ({formatCurrency(s.total, currency)})
            </Button>
          ))}
        </div>
      )}

      <div className="pos-layout">
        <div className="pos-products">
          <div className="pos-search-row">
            <input
              className="form-input"
              placeholder="Search English, Arabic, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleBarcodeSearch}
              autoFocus
            />
          </div>

          <div className="pos-product-grid">
            {displayedProducts.map((p) => (
              <div
                key={p.id}
                className={`pos-product-card ${p.quantity <= 0 ? "low-stock" : ""}`}
                onClick={() => addToCart(p)}
              >
                <ProductBilingualName
                  name={p.name}
                  nameAr={p.name_ar}
                  size="sm"
                  align="center"
                  className="pos-product-name-block"
                />
                <div className="pos-product-price">{formatCurrency(p.selling_price, currency)}</div>
                <div className="pos-product-stock">
                  Stock: {p.quantity}{p.quantity <= 0 ? " (oversell OK)" : ""}
                </div>
              </div>
            ))}
            {!displayedProducts.length && (
              <p style={{ color: "var(--color-text-muted)", gridColumn: "1/-1", fontSize: "0.875rem" }}>
                {search ? "No products found" : "No products in stock — add products first"}
              </p>
            )}
          </div>
        </div>

        <div className="pos-right-panel">
          <div className="pos-cart">
            <div className="pos-section-header">Cart ({cart.length})</div>

            <div style={{ padding: "0.5rem 0.75rem" }}>
              <Select label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="pos-cart-items">
              {cart.length === 0 ? (
                <p style={{ padding: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
                  No items in cart
                </p>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="pos-cart-item">
                    <div>
                      <ProductBilingualName
                        name={item.name}
                        nameAr={item.name_ar}
                        size="sm"
                      />
                      <div className="pos-qty-controls">
                        <Button variant="ghost" size="sm" className="btn-icon" onClick={() => updateQty(item.product_id, -1)}>
                          <Minus size={14} />
                        </Button>
                        <span>{item.quantity}</span>
                        <Button variant="ghost" size="sm" className="btn-icon" onClick={() => updateQty(item.product_id, 1)}>
                          <Plus size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="btn-icon" onClick={() => removeItem(item.product_id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    <strong>{formatCurrency(item.total, currency)}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="pos-cart-summary">
              <div className="pos-summary-row"><span>Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
              <div className="pos-summary-row">
                <span>Discount</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: "90px", padding: "0.2rem 0.4rem", fontSize: "0.8125rem" }}
                  value={discount}
                  min={0}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="pos-summary-row"><span>VAT ({vatPercent}%)</span><span>{formatCurrency(vat, currency)}</span></div>
              <div className="pos-summary-row grand"><span>Total</span><span>{formatCurrency(grandTotal, currency)}</span></div>
            </div>
          </div>

          <div className="pos-payment">
            <div className="pos-payment-tabs">
            <button
                type="button"
                className={`pos-payment-tab ${paymentTab === PAYMENT_METHODS.CARD ? "active" : ""}`}
                onClick={() => setPaymentTab(PAYMENT_METHODS.CARD)}
              >
                <CreditCard size={16} /> Card
              </button> 

              <button
                type="button"
                className={`pos-payment-tab ${paymentTab === PAYMENT_METHODS.CASH ? "active" : ""}`}
                onClick={() => setPaymentTab(PAYMENT_METHODS.CASH)}
              >
                <Banknote size={16} /> Cash
              </button>
     
            </div>

            <div className="pos-payment-body">
              {paymentTab === PAYMENT_METHODS.CASH ? (
                <>
                  <label className="form-label">Cash Received (optional)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Leave empty or enter partial payment"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                  <div className="pos-change-display">
                    <div className="pos-change-label">{balanceDue > 0 ? "Balance Due" : "Change Due"}</div>
                    <div className="pos-change-value">
                      {formatCurrency(balanceDue > 0 ? balanceDue : changeDue, currency)}
                    </div>
                  </div>
                  <div className="pos-payment-actions">
                    <Button variant="secondary" disabled={submitting} onClick={() => completeHeldSale(PAYMENT_METHODS.CASH)}>
                      <Pause size={16} /> Hold
                    </Button>
                    <Button variant="secondary" disabled={submitting} onClick={handlePrintLast}>
                      <Printer size={16} /> Reprint
                    </Button>
                    <Button
                      disabled={submitting || cart.length === 0}
                      onClick={() => openCompleteConfirm(PAYMENT_METHODS.CASH)}
                      style={{ gridColumn: "1 / -1" }}
                    >
                      {submitting ? "Processing..." : "Complete Cash Sale"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                    Card payment — total {formatCurrency(grandTotal, currency)}
                  </p>
                  <div className="pos-payment-actions">
                    <Button variant="secondary" disabled={submitting} onClick={() => completeHeldSale(PAYMENT_METHODS.CARD)}>
                      <Pause size={16} /> Hold
                    </Button>
                    <Button variant="secondary" disabled={submitting} onClick={handlePrintLast}>
                      <Printer size={16} /> Reprint
                    </Button>
                    <Button
                      disabled={submitting || cart.length === 0}
                      onClick={() => openCompleteConfirm(PAYMENT_METHODS.CARD)}
                      style={{ gridColumn: "1 / -1" }}
                    >
                      {submitting ? "Processing..." : "Complete Card Sale"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <SaleCompleteModal
        step={completeStep}
        paymentMethod={pendingPaymentMethod}
        cart={cart}
        subtotal={subtotal}
        discount={Number(discount)}
        vat={vat}
        grandTotal={grandTotal}
        cashReceived={received}
        changeDue={changeDue}
        balanceDue={balanceDue}
        currency={currency}
        vatPercent={vatPercent}
        completedSale={completedSale}
        processing={submitting}
        onConfirmComplete={handleConfirmComplete}
        onCancel={closeCompleteFlow}
        onPrint={handlePrintReceipt}
        onSkipPrint={handleSkipPrint}
      />

      <SaleReturnModal
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        onSuccess={(result) => {
          setMessage(`Return ${result.returnNumber} — ${formatCurrency(result.totalRefund, currency)} refunded`);
          refreshCatalog();
        }}
        currency={currency}
      />
    </div>
  );
}
