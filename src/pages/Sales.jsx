import { useEffect, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  Printer,
  Pause,
  CreditCard,
  Banknote,
  RotateCcw,
  Search,
  ShoppingCart,
  ScanBarcode,
  User,
  X,
  Sparkles,
} from "lucide-react";
import { productService } from "../services/ProductService";
import { customerService } from "../services/CustomerService";
import { saleService } from "../services/SaleService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import Button from "../components/common/Button";
import { Select } from "../components/common/Input";
import SaleCompleteModal from "../components/sales/SaleCompleteModal";
import SaleReturnModal from "../components/sales/SaleReturnModal";
import ProductBilingualName from "../components/products/ProductBilingualName";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, calcVat, calcGrandTotal, formatQuantity } from "../utils/format";
import { printReceipt } from "../utils/receipt";
import { PAYMENT_METHODS, SALE_STATUS, POS_TOP_SELLERS_LIMIT } from "../utils/constants";
import { resolveActivePhase } from "../zatca/core/config";
import { ZATCA_PHASES } from "../zatca/core/constants";
import "./Sales.css";

const PRODUCT_HUES = [221, 262, 173, 32, 346, 199, 280, 150];

function productAccent(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRODUCT_HUES[Math.abs(hash) % PRODUCT_HUES.length];
}

function productInitial(name = "") {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export default function Sales() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const vatPercent = Number(settings.vat_percent) || 0;
  const zatcaPhase2 = resolveActivePhase(settings) === ZATCA_PHASES.PHASE2;
  const { submitting, guard } = useSubmitGuard();

  const [topProducts, setTopProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
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

  const searchRef = useRef(null);
  const checkoutRef = useRef({});

  useEffect(() => {
    async function init() {
      try {
        const [products, customerResult, held] = await Promise.all([
          productService.getTopSellingForPos(POS_TOP_SELLERS_LIMIT),
          customerService.getAll({ limit: 100, page: 1 }),
          saleService.getHeldSales(),
        ]);
        setTopProducts(products);
        setCustomers(customerResult.items);
        setHeldSales(held);
      } catch (err) {
        setError(err.message || "Failed to load POS. Restart the app and try again.");
      } finally {
        setCatalogLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await productService.searchForPos(term);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const isSearching = search.trim().length > 0;

  const cartQtyMap = useMemo(() => {
    const map = new Map();
    for (const item of cart) {
      map.set(item.product_id, item.quantity);
    }
    return map;
  }, [cart]);

  const displayedProducts = useMemo(() => {
    if (isSearching) return searchResults;
    return topProducts;
  }, [isSearching, searchResults, topProducts]);

  async function handleBarcodeSearch(e) {
    if (e.key !== "Enter" || !search.trim()) return;
    const code = search.trim();
    const exact =
      topProducts.find((p) => p.barcode === code) ||
      searchResults.find((p) => p.barcode === code);
    if (exact) {
      addToCart(exact);
      setSearch("");
      return;
    }
    const product = await productService.getByBarcode(code);
    if (product) addToCart(product);
    setSearch("");
  }

  function focusSearch() {
    queueMicrotask(() => searchRef.current?.focus());
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
          unit_symbol: product.unit_symbol || "pcs",
          unit_price: product.selling_price,
          quantity: 1,
          discount: 0,
          total: product.selling_price,
        },
      ];
    });
    focusSearch();
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

  function clearCart() {
    setCart([]);
    setDiscount(0);
    setCashReceived("");
    setError("");
  }

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const vat = calcVat(subtotal, Number(discount), vatPercent);
  const grandTotal = calcGrandTotal(subtotal, Number(discount), vat);
  const received = Number(cashReceived) || 0;
  const changeDue = Math.max(0, received - grandTotal);
  const balanceDue = Math.max(0, grandTotal - received);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function refreshTopProducts() {
    const products = await productService.getTopSellingForPos(POS_TOP_SELLERS_LIMIT);
    setTopProducts(products);
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

  function advanceCashCheckout() {
    if (!validateBeforeComplete()) return;

    if (paymentTab === PAYMENT_METHODS.CASH) {
      const currentReceived = Number(cashReceived) || 0;
      if (currentReceived < grandTotal) {
        setCashReceived(String(grandTotal));
      }
    }

    openCompleteConfirm(paymentTab);
  }

  function closeCompleteFlow() {
    setCompleteStep(null);
    setCompletedSale(null);
  }

  function setExactCash() {
    setCashReceived(String(grandTotal));
  }

  function addQuickCash(amount) {
    setCashReceived(String((Number(cashReceived) || 0) + amount));
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
        await refreshTopProducts();
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
    focusSearch();
  }

  function handleSkipPrint() {
    if (completedSale) {
      setMessage(`Sale ${completedSale.sale_number} completed successfully`);
    }
    closeCompleteFlow();
    focusSearch();
  }

  checkoutRef.current = {
    cart,
    completeStep,
    submitting,
    search,
    returnOpen,
    advanceCashCheckout,
    handleConfirmComplete,
    handleSkipPrint,
  };

  useEffect(() => {
    function handleCheckoutEnter(e) {
      if (e.key !== "Enter" || e.repeat) return;
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

      const {
        cart: items,
        completeStep: step,
        submitting: busy,
        search: query,
        returnOpen: returnModalOpen,
        advanceCashCheckout: advance,
        handleConfirmComplete: confirmComplete,
        handleSkipPrint: skipPrint,
      } = checkoutRef.current;

      if (returnModalOpen) return;

      const target = e.target;
      if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (target.classList?.contains("pos-discount-input")) return;
      if (target.classList?.contains("pos-search-input") && query.trim()) return;

      if (step === "confirm") {
        e.preventDefault();
        if (!busy) confirmComplete();
        return;
      }

      if (step === "print") {
        e.preventDefault();
        skipPrint();
        return;
      }

      if (items.length === 0) return;

      e.preventDefault();
      advance();
    }

    window.addEventListener("keydown", handleCheckoutEnter);
    return () => window.removeEventListener("keydown", handleCheckoutEnter);
  }, []);

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
    <div className="pos-page">
      <header className="pos-topbar">
        <div className="pos-topbar-main">
          <div className="pos-topbar-brand">
            <div className="pos-topbar-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="pos-topbar-title">Point of Sale</h1>
              <p className="pos-topbar-subtitle">
                Top {POS_TOP_SELLERS_LIMIT} sellers · search or scan for other products
              </p>
            </div>
          </div>

          <div className="pos-topbar-metrics">
            <div className="pos-metric">
              <span className="pos-metric-label">In cart</span>
              <strong className="pos-metric-value">{cartItemCount}</strong>
            </div>
            <div className="pos-metric pos-metric-total">
              <span className="pos-metric-label">Total</span>
              <strong className="pos-metric-value">{formatCurrency(grandTotal, currency)}</strong>
            </div>
          </div>
        </div>

        <div className="pos-topbar-actions">
          <Button variant="secondary" onClick={() => setReturnOpen(true)}>
            <RotateCcw size={16} /> Return
          </Button>
        </div>
      </header>

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}

      {heldSales.length > 0 && (
        <div className="pos-held-strip">
          <span className="pos-held-label">
            <Pause size={14} /> Held sales
          </span>
          <div className="pos-held-chips">
            {heldSales.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pos-held-chip"
                onClick={() => resumeHeld(s.id)}
              >
                <span>{s.sale_number}</span>
                <strong>{formatCurrency(s.total, currency)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pos-layout">
        <section className="pos-catalog" aria-label="Product catalog">
          <div className="pos-catalog-toolbar">
            <div className="pos-search-wrap">
              <Search size={18} className="pos-search-icon" />
              <input
                ref={searchRef}
                className="pos-search-input"
                placeholder="Search name, Arabic, SKU, or scan barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleBarcodeSearch}
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  className="pos-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              ) : (
                <span className="pos-search-hint">
                  <ScanBarcode size={14} /> Enter
                </span>
              )}
            </div>

            <div className="pos-top-sellers-label">
              <Sparkles size={16} />
              <span>{isSearching ? "Search results" : `Top ${POS_TOP_SELLERS_LIMIT} sellers`}</span>
            </div>
          </div>

          <div className="pos-catalog-meta">
            <span>
              {searchLoading
                ? "Searching…"
                : `${displayedProducts.length} product${displayedProducts.length !== 1 ? "s" : ""}`}
              {isSearching ? ` matching “${search.trim()}”` : " shown"}
            </span>
          </div>

          <div className="pos-product-grid">
            {displayedProducts.map((p) => {
              const inCart = cartQtyMap.get(p.id) || 0;
              const hue = productAccent(p.name);
              const lowStock = p.quantity <= 0;

              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pos-product-card ${lowStock ? "low-stock" : ""} ${inCart ? "in-cart" : ""}`}
                  onClick={() => addToCart(p)}
                  style={{ "--product-accent": `${hue}` }}
                >
                  {inCart > 0 && <span className="pos-product-badge">{inCart}</span>}
                  <div className="pos-product-thumb">{productInitial(p.name)}</div>
                  <ProductBilingualName
                    name={p.name}
                    nameAr={p.name_ar}
                    size="sm"
                    align="center"
                    className="pos-product-name-block"
                  />
                  <div className="pos-product-price">{formatCurrency(p.selling_price, currency)}</div>
                  <div className="pos-product-meta">
                    {p.category_name && (
                      <span className="pos-product-category">{p.category_name}</span>
                    )}
                    <span className={`pos-product-stock ${lowStock ? "warn" : ""}`}>
                      {formatQuantity(p.quantity, p.unit_symbol)}
                      {lowStock ? " · oversell OK" : ""}
                    </span>
                  </div>
                </button>
              );
            })}

            {!displayedProducts.length && !searchLoading && (
              <div className="pos-empty-catalog">
                <Search size={32} strokeWidth={1.5} />
                <p>{isSearching ? "No products match your search" : "No top sellers yet"}</p>
                {isSearching && (
                  <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="pos-checkout" aria-label="Cart and payment">
          <div className="pos-cart-panel">
            <div className="pos-cart-header">
              <div className="pos-cart-title">
                <ShoppingCart size={18} />
                <span>Cart</span>
                {cart.length > 0 && <span className="pos-cart-count">{cart.length}</span>}
              </div>
              {cart.length > 0 && (
                <button type="button" className="pos-clear-cart" onClick={clearCart}>
                  Clear
                </button>
              )}
            </div>

            <div className="pos-customer-row">
              <User size={16} className="pos-customer-icon" />
              <Select
                label=""
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="pos-customer-select"
              >
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="pos-cart-items">
              {cart.length === 0 ? (
                <div className="pos-cart-empty">
                  <ShoppingCart size={36} strokeWidth={1.25} />
                  <p>Your cart is empty</p>
                  <span>Select products from the catalog to begin</span>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="pos-cart-item">
                    <div className="pos-cart-item-main">
                      <ProductBilingualName name={item.name} nameAr={item.name_ar} size="sm" />
                      <div className="pos-cart-item-price">
                        {formatCurrency(item.unit_price, currency)} each
                      </div>
                    </div>
                    <div className="pos-cart-item-footer">
                      <div className="pos-qty-controls">
                        <button
                          type="button"
                          className="pos-qty-btn"
                          onClick={() => updateQty(item.product_id, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="pos-qty-value">
                          {formatQuantity(item.quantity, item.unit_symbol)}
                        </span>
                        <button
                          type="button"
                          className="pos-qty-btn"
                          onClick={() => updateQty(item.product_id, 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong className="pos-line-total">{formatCurrency(item.total, currency)}</strong>
                      <button
                        type="button"
                        className="pos-remove-btn"
                        onClick={() => removeItem(item.product_id)}
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pos-cart-summary">
              <div className="pos-summary-row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="pos-summary-row pos-summary-discount">
                <span>Discount</span>
                <input
                  type="number"
                  className="pos-discount-input"
                  value={discount}
                  min={0}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="pos-summary-row">
                <span>VAT ({vatPercent}%)</span>
                <span>{formatCurrency(vat, currency)}</span>
              </div>
              <div className="pos-summary-row pos-summary-grand">
                <span>Total due</span>
                <span>{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>
          </div>

          <div className="pos-payment-panel">
            <div className="pos-payment-tabs">
              <button
                type="button"
                className={`pos-payment-tab ${paymentTab === PAYMENT_METHODS.CASH ? "active" : ""}`}
                onClick={() => setPaymentTab(PAYMENT_METHODS.CASH)}
              >
                <Banknote size={18} /> Cash
              </button>
              <button
                type="button"
                className={`pos-payment-tab ${paymentTab === PAYMENT_METHODS.CARD ? "active" : ""}`}
                onClick={() => setPaymentTab(PAYMENT_METHODS.CARD)}
              >
                <CreditCard size={18} /> Card
              </button>
            </div>

            <div className="pos-payment-body">
              {paymentTab === PAYMENT_METHODS.CASH ? (
                <>
                  <label className="pos-field-label">Cash received</label>
                  <input
                    className="pos-cash-input"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />

                  <div className="pos-quick-cash">
                    <button type="button" className="pos-quick-btn" onClick={setExactCash}>
                      Exact
                    </button>
                    {[50, 100, 200, 500].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className="pos-quick-btn"
                        onClick={() => addQuickCash(amount)}
                      >
                        +{amount}
                      </button>
                    ))}
                  </div>

                  <div className="pos-change-display">
                    <span className="pos-change-label">
                      {balanceDue > 0 ? "Balance due" : "Change due"}
                    </span>
                    <span className="pos-change-value">
                      {formatCurrency(balanceDue > 0 ? balanceDue : changeDue, currency)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="pos-card-info">
                  <CreditCard size={28} strokeWidth={1.25} />
                  <p>Card payment</p>
                  <strong>{formatCurrency(grandTotal, currency)}</strong>
                </div>
              )}

              <div className="pos-payment-actions">
                <Button
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => completeHeldSale(paymentTab)}
                >
                  <Pause size={16} /> Hold
                </Button>
                <Button variant="secondary" disabled={submitting} onClick={handlePrintLast}>
                  <Printer size={16} /> Reprint
                </Button>
                <Button
                  className="pos-complete-btn"
                  disabled={submitting || cart.length === 0}
                  onClick={() => openCompleteConfirm(paymentTab)}
                >
                  {submitting
                    ? "Processing…"
                    : paymentTab === PAYMENT_METHODS.CASH
                      ? "Complete cash sale"
                      : "Complete card sale"}
                </Button>
              </div>
            </div>
          </div>
        </aside>
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
        zatcaQueued={zatcaPhase2 && Boolean(completedSale)}
        onConfirmComplete={handleConfirmComplete}
        onCancel={closeCompleteFlow}
        onPrint={handlePrintReceipt}
        onSkipPrint={handleSkipPrint}
      />

      <SaleReturnModal
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        onSuccess={(result) => {
          setMessage(
            `Return ${result.returnNumber} — ${formatCurrency(result.totalRefund, currency)} refunded`
          );
          refreshTopProducts();
        }}
        currency={currency}
      />
    </div>
  );
}
