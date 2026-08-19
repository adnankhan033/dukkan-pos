import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  Wallet,
  Smartphone,
  Clock,
  ChevronRight,
  Eye,
} from "lucide-react";
import { productService } from "../services/ProductService";
import { onCatalogChanged } from "../services/CatalogSync";
import { paymentMethodService } from "../services/PaymentMethodService";
import { onPaymentMethodsChanged } from "../services/PaymentMethodsSync";
import { customerService } from "../services/CustomerService";
import { saleService } from "../services/SaleService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { usePermissions } from "../hooks/usePermissions";
import { useConfirm } from "../hooks/useConfirm";
import Button from "../components/common/Button";
import SearchableSelect from "../components/common/SearchableSelect";
import SaleCompleteModal from "../components/sales/SaleCompleteModal";
import SaleReturnModal from "../components/sales/SaleReturnModal";
import PosProductEditModal from "../components/sales/PosProductEditModal";
import PosCustomerModal from "../components/sales/PosCustomerModal";
import HeldSalesBar from "../components/sales/HeldSalesBar";
import LastOrderReprintModal from "../components/sales/LastOrderReprintModal";
import CartLineSheet from "../components/sales/CartLineSheet";
import CartVerifyModal from "../components/sales/CartVerifyModal";
import ProductBilingualName from "../components/products/ProductBilingualName";
import { LoadingSpinner } from "../components/common/Loading";
import { notify } from "../utils/notify";
import { formatCurrency, formatQuantity } from "../utils/format";
import {
  buildCartLineFromProduct,
  calcCartTotals,
  cartItemDisplayLineTotal,
  cartItemDisplayUnitPrice,
} from "../utils/vatPricing";
import { printReceipt } from "../utils/receipt";
import {
  paymentMethodCollectsCash,
  paymentMethodRequiresCustomer,
  resolvePaymentMethodLabel,
  isPayLaterMethod,
} from "../utils/paymentMethods";
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

function settingEnabled(value, fallback = true) {
  if (value == null || value === "") return fallback;
  return value !== "0" && value !== "false";
}

function PosPaymentMethodIcon({ icon, size = 18 }) {
  if (icon === "credit-card") return <CreditCard size={size} />;
  if (icon === "smartphone") return <Smartphone size={size} />;
  if (icon === "clock") return <Clock size={size} />;
  if (icon === "wallet") return <Wallet size={size} />;
  return <Banknote size={size} />;
}

function paymentMethodTone(method) {
  const code = String(method?.code || "").toLowerCase();
  const icon = String(method?.icon || "");
  if (isPayLaterMethod(code)) return "later";
  if (icon === "smartphone" || code === "transfer") return "transfer";
  if (icon === "wallet") return "wallet";
  if (code === "card" || icon === "credit-card") return "card";
  if (paymentMethodCollectsCash(method) || code === "cash" || icon === "banknote") return "cash";
  return "card";
}

function paymentMethodHint(method) {
  const code = String(method?.code || "").toLowerCase();
  if (isPayLaterMethod(code)) return "Save on the customer account";
  if (paymentMethodCollectsCash(method) || code === "cash") return "Take cash and finish the sale";
  if (code === "transfer" || method?.icon === "smartphone") return "Mark the transfer as received";
  if (method?.icon === "wallet") return "Collect with a digital wallet";
  return "Charge the card and finish the sale";
}

export default function Sales() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const vatPercent = Number(settings.vat_percent) || 0;
  const zatcaPhase2 = resolveActivePhase(settings) === ZATCA_PHASES.PHASE2;
  const { submitting, guard } = useSubmitGuard();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { canPerformAction } = usePermissions();
  const canEditProducts = canPerformAction("products_edit");
  const canManageCustomers = canPerformAction("customers_manage");

  const [topProducts, setTopProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerError, setCustomerError] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentTab, setPaymentTab] = useState(PAYMENT_METHODS.CASH);
  const [cashReceived, setCashReceived] = useState("");
  const [heldSales, setHeldSales] = useState([]);
  const [lastSale, setLastSale] = useState(null);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintSale, setReprintSale] = useState(null);
  const [reprintLoading, setReprintLoading] = useState(false);

  const [completeStep, setCompleteStep] = useState(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(PAYMENT_METHODS.CASH);
  const [completedSale, setCompletedSale] = useState(null);
  const [printOnComplete, setPrintOnComplete] = useState(true);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [cartLineId, setCartLineId] = useState(null);
  const [cartVerifyOpen, setCartVerifyOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerModalInitialName, setCustomerModalInitialName] = useState("");
  const customerCreateResolverRef = useRef(null);
  const customerSelectRef = useRef(null);
  const customerRowRef = useRef(null);

  const searchRef = useRef(null);
  const lastScanAtRef = useRef(0);
  const checkoutRef = useRef({});

  const loadPaymentMethods = useCallback(async () => {
    try {
      const methods = await paymentMethodService.getActiveForPos();
      setPaymentMethods(methods);
      setPaymentTab((current) => {
        if (methods.some((method) => method.code === current)) return current;
        const defaultMethod = methods.find((method) => method.is_default) || methods[0];
        return defaultMethod?.code || PAYMENT_METHODS.CASH;
      });
    } catch {
      setPaymentMethods([]);
    }
  }, []);

  const posPaymentMethods = useMemo(
    () =>
      paymentMethods.length
        ? paymentMethods
        : [
            { code: PAYMENT_METHODS.CASH, label: "Cash", icon: "banknote", collect_cash: 1 },
            { code: PAYMENT_METHODS.CARD, label: "Card", icon: "credit-card", collect_cash: 0 },
          ],
    [paymentMethods]
  );
  const selectedPaymentMethod = useMemo(
    () =>
      posPaymentMethods.find((method) => method.code === paymentTab) ||
      posPaymentMethods.find((method) => method.is_default) ||
      posPaymentMethods[0] ||
      null,
    [posPaymentMethods, paymentTab]
  );
  const hasCashTender = posPaymentMethods.some((method) => paymentMethodCollectsCash(method));

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.name,
        hint: customer.phone || customer.email || undefined,
      })),
    [customers]
  );

  const loadCustomers = useCallback(async () => {
    try {
      const items = await customerService.getAllForExport();
      setCustomers(items);
    } catch {
      setCustomers([]);
    }
  }, []);

  function upsertCustomer(customer) {
    if (!customer?.id) return;
    setCustomers((prev) => {
      const next = prev.filter((row) => row.id !== customer.id);
      next.push(customer);
      next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return next;
    });
  }

  function openCustomerModal(initialName = "") {
    return new Promise((resolve) => {
      customerCreateResolverRef.current = resolve;
      setCustomerModalInitialName(initialName);
      setCustomerModalOpen(true);
    });
  }

  function closeCustomerModal(result = null) {
    setCustomerModalOpen(false);
    setCustomerModalInitialName("");
    const resolve = customerCreateResolverRef.current;
    customerCreateResolverRef.current = null;
    resolve?.(result);
  }

  function handleCustomerChange(id) {
    setCustomerId(id);
    if (id) setCustomerError("");
  }

  function handleCustomerSaved(customer) {
    upsertCustomer(customer);
    setCustomerId(String(customer.id));
    setCustomerError("");
    notify.success(`Customer "${customer.name}" added and selected.`, { title: "Customer saved" });
    closeCustomerModal(String(customer.id));
  }

  async function handleCreateCustomerOption(name) {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return null;

    const existing = customers.find(
      (customer) => customer.name?.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return String(existing.id);

    if (!canManageCustomers) {
      notify.warning("You do not have permission to add customers.", { title: "Permission required" });
      return null;
    }

    return openCustomerModal(trimmed);
  }

  function handleAddCustomerClick() {
    if (!canManageCustomers) {
      notify.warning("You do not have permission to add customers.", { title: "Permission required" });
      return;
    }
    openCustomerModal("").then((id) => {
      if (id) {
        setCustomerId(id);
        setCustomerError("");
      }
    });
  }

  useEffect(() => {
    async function init() {
      try {
        const [products, held, lastOrder] = await Promise.all([
          productService.getTopSellingForPos(POS_TOP_SELLERS_LIMIT),
          saleService.getHeldSales(),
          saleService.getLastCompletedSale(),
        ]);
        setTopProducts(products);
        setHeldSales(held);
        if (lastOrder?.items?.length) setLastSale(lastOrder);
        await loadCustomers();
      } catch (err) {
        notify.error(err.message || "Failed to load POS. Restart the app and try again.", {
          title: "POS unavailable",
        });
      } finally {
        setCatalogLoading(false);
      }
    }
    init();
    loadPaymentMethods();
  }, [loadPaymentMethods, loadCustomers]);

  useEffect(() => {
    return onPaymentMethodsChanged(() => {
      loadPaymentMethods();
    });
  }, [loadPaymentMethods]);

  useEffect(() => {
    return onCatalogChanged(async () => {
      try {
        const [products, catalog] = await Promise.all([
          productService.getTopSellingForPos(POS_TOP_SELLERS_LIMIT),
          productService.getPosCatalog(500),
        ]);
        setTopProducts(products);
        const catalogIds = new Set(catalog.map((p) => p.id));
        setCart((prev) => prev.filter((item) => catalogIds.has(item.product_id)));
      } catch {
        // Ignore background refresh errors.
      }
    });
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
    e.preventDefault();
    e.stopPropagation();
    const code = search.trim();
    const exact =
      topProducts.find((p) => p.barcode === code) ||
      searchResults.find((p) => p.barcode === code);
    if (exact) {
      addToCart(exact);
      setSearch("");
      lastScanAtRef.current = Date.now();
      return;
    }
    const product = await productService.getByBarcode(code);
    if (product) addToCart(product);
    setSearch("");
    lastScanAtRef.current = Date.now();
  }

  function focusSearch() {
    queueMicrotask(() => searchRef.current?.focus());
  }

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        const quantity = existing.quantity + 1;
        return prev.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity,
                total: i.unit_price * quantity,
                shelf_line_total: i.shelf_unit_price * quantity,
              }
            : i
        );
      }
      return [...prev, buildCartLineFromProduct(product, settings, 1)];
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
          return {
            ...i,
            quantity: qty,
            total: qty * i.unit_price,
            shelf_line_total: qty * i.shelf_unit_price,
          };
        })
        .filter(Boolean)
    );
  }

  function setItemQty(productId, quantity) {
    const qty = Math.max(0, Math.floor(Number(quantity) || 0));
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        return {
          ...item,
          quantity: qty,
          total: qty * item.unit_price,
          shelf_line_total: qty * item.shelf_unit_price,
        };
      })
    );
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
    setCartLineId((current) => (current === productId ? null : current));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
    setCashReceived("");
    setCartLineId(null);
  }

  const cartTotals = useMemo(
    () => calcCartTotals(cart, Number(discount)),
    [cart, discount]
  );
  const subtotal = cartTotals.subtotal;
  const vat = cartTotals.vat;
  const grandTotal = cartTotals.total;
  const received = Number(cashReceived) || 0;
  const changeDue = Math.max(0, received - grandTotal);
  const balanceDue = Math.max(0, grandTotal - received);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartLineItem = cart.find((item) => item.product_id === cartLineId) || null;

  async function refreshTopProducts() {
    const products = await productService.getTopSellingForPos(POS_TOP_SELLERS_LIMIT);
    setTopProducts(products);
  }

  function openProductEdit(productId, e) {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    setEditProductId(Number(productId));
  }

  function closeProductEdit() {
    setEditProductId(null);
  }

  function patchCatalogProduct(updated) {
    const patch = (list) =>
      list.map((p) =>
        p.id === updated.id
          ? {
              ...p,
              name: updated.name,
              name_ar: updated.name_ar,
              barcode: updated.barcode,
              selling_price: updated.selling_price,
              tax_category: updated.tax_category,
              vat_rate: updated.vat_rate,
              vat_included: updated.vat_included,
              unit_symbol: updated.unit_symbol || p.unit_symbol,
              category_name: updated.category_name ?? p.category_name,
              quantity: updated.quantity ?? p.quantity,
            }
          : p
      );

    setTopProducts((prev) => patch(prev));
    setSearchResults((prev) => patch(prev));
  }

  function applyProductUpdateToCart(updated) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== updated.id) return item;
        const line = buildCartLineFromProduct(updated, settings, item.quantity);
        return { ...line, discount: item.discount || 0 };
      })
    );
  }

  function handleProductSaved(updated) {
    patchCatalogProduct(updated);
    applyProductUpdateToCart(updated);
    notify.success(`"${updated.name}" price refreshed in cart.`, { title: "Product updated" });
  }

  function validateBeforeComplete(paymentMethod = paymentTab) {
    if (cart.length === 0) {
      notify.warning("Add at least one item before completing the sale.", { title: "Cart is empty" });
      return false;
    }

    const method = posPaymentMethods.find((entry) => entry.code === paymentMethod);
    if (paymentMethodRequiresCustomer(method) && !customerId) {
      const message = "Select a customer for pay later.";
      setCustomerError(message);
      notify.warning(message, { title: "Customer required" });
      requestAnimationFrame(() => {
        const row = customerRowRef.current;
        if (row) {
          row.classList.remove("pos-customer-shake");
          void row.offsetWidth;
          row.classList.add("pos-customer-shake");
        }
        customerSelectRef.current?.focus?.();
      });
      return false;
    }

    setCustomerError("");
    return true;
  }

  function openCompleteConfirm(paymentMethod) {
    if (submitting || completeStep) return;
    if (!validateBeforeComplete(paymentMethod)) return;

    const method =
      posPaymentMethods.find((entry) => entry.code === paymentMethod) || selectedPaymentMethod;

    setPaymentTab(paymentMethod);

    if (paymentMethodCollectsCash(method)) {
      const currentReceived = Number(cashReceived) || 0;
      if (currentReceived < grandTotal) {
        setCashReceived(String(grandTotal));
      }
    }

    setPendingPaymentMethod(paymentMethod);
    setPrintOnComplete(settingEnabled(settings.receipt_print_on_complete, true));
    setCompleteStep("confirm");
  }

  function advanceCashCheckout() {
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
    const shouldPrint = printOnComplete;
    try {
      await guard(async () => {
        const payLater = isPayLaterMethod(pendingPaymentMethod);
        const sale = await saleService.createSale({
          customerId: customerId ? Number(customerId) : null,
          items: cartSnapshot,
          discount: Number(discount),
          vat,
          paymentMethod: pendingPaymentMethod,
          status: SALE_STATUS.COMPLETED,
          amountPaid: payLater ? 0 : grandTotal,
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

        const pendingMethod = paymentMethods.find((method) => method.code === pendingPaymentMethod);
        const pendingCollectsCash = paymentMethodCollectsCash(pendingMethod);

        const receiptSale = {
          ...sale,
          amount_received: pendingCollectsCash ? received : null,
          change_due: pendingCollectsCash ? changeDue : null,
          balance_due: payLater
            ? Math.max(0, sale.total - (sale.amount_paid || 0))
            : pendingCollectsCash
              ? balanceDue
              : null,
          items: lineItems,
        };

        setLastSale(receiptSale);
        setCompletedSale(receiptSale);
        setCart([]);
        setDiscount(0);
        setCashReceived("");
        await refreshTopProducts();

        if (shouldPrint) {
          try {
            await printReceipt({
              sale: receiptSale,
              items: receiptSale.items,
              settings,
              currency,
            });
          } catch (err) {
            notify.error(err.message || "Print failed", { title: "Print failed" });
          }
        }

        notify.success(`Sale ${receiptSale.sale_number} is complete.`, { title: "Sale completed" });
        closeCompleteFlow();
        focusSearch();
      });
    } catch (err) {
      notify.error(err.message, { title: "Sale failed" });
      closeCompleteFlow();
    }
  }

  async function handlePrintReceipt() {
    if (!completedSale || printingReceipt) return;
    setPrintingReceipt(true);
    try {
      await printReceipt({
        sale: completedSale,
        items: completedSale.items,
        settings,
        currency,
      });
    } catch (err) {
      notify.error(err.message || "Print failed", { title: "Print failed" });
    } finally {
      setPrintingReceipt(false);
    }
  }

  function handleSkipPrint() {
    if (completedSale) {
      notify.success(`Sale ${completedSale.sale_number} is complete.`, { title: "Sale completed" });
    }
    closeCompleteFlow();
    focusSearch();
  }

  checkoutRef.current = {
    cart,
    completeStep,
    submitting,
    returnOpen,
    advanceCashCheckout,
    handleConfirmComplete,
    handleSkipPrint,
    openCompleteConfirm,
    cashMethodCode:
      posPaymentMethods.find((method) => paymentMethodCollectsCash(method))?.code ||
      PAYMENT_METHODS.CASH,
  };

  useEffect(() => {
    function handleCheckoutEnter(e) {
      if (e.key !== "Enter" || e.repeat) return;
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

      const {
        cart: items,
        completeStep: step,
        submitting: busy,
        returnOpen: returnModalOpen,
        advanceCashCheckout: advance,
        handleConfirmComplete: confirmComplete,
        handleSkipPrint: skipPrint,
        openCompleteConfirm: startCheckout,
        cashMethodCode,
      } = checkoutRef.current;

      if (returnModalOpen) return;

      // Ignore Enter shortly after a barcode scan (scanners often send CR+LF).
      if (Date.now() - lastScanAtRef.current < 400) return;

      const target = e.target;
      if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (target.classList?.contains("pos-discount-input")) return;
      if (target.classList?.contains("pos-search-input")) return;

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
      if (target.classList?.contains("pos-cash-input")) {
        startCheckout(cashMethodCode);
        return;
      }
      advance();
    }

    window.addEventListener("keydown", handleCheckoutEnter);
    return () => window.removeEventListener("keydown", handleCheckoutEnter);
  }, []);

  async function parkCurrentCart(paymentMethod) {
    const sale = await saleService.createSale({
      customerId: customerId ? Number(customerId) : null,
      items: cart,
      discount: Number(discount),
      vat,
      paymentMethod,
      status: SALE_STATUS.HELD,
    });
    setCart([]);
    setDiscount(0);
    setCashReceived("");
    return sale;
  }

  async function completeHeldSale(paymentMethod) {
    if (cart.length === 0) {
      notify.warning("Add at least one item before holding a sale.", { title: "Cart is empty" });
      return;
    }
    try {
      await guard(async () => {
        const sale = await parkCurrentCart(paymentMethod);
        notify.success(`${sale.sale_number} is waiting in Held tickets.`, { title: "Sale held" });
        setHeldSales(await saleService.getHeldSales());
      });
    } catch (err) {
      notify.error(err.message, { title: "Could not hold sale" });
    }
  }

  async function handlePrintLast() {
    if (submitting) return;
    setReprintOpen(true);
    setReprintLoading(true);
    setReprintSale(null);
    try {
      const sale = await saleService.getLastCompletedSale();
      if (!sale?.items?.length) {
        setReprintOpen(false);
        notify.warning("No completed order to reprint.", { title: "No last order" });
        return;
      }
      setReprintSale(sale);
      setLastSale(sale);
    } catch (err) {
      setReprintOpen(false);
      notify.error(err.message || "Could not load the last order.", { title: "Reprint failed" });
    } finally {
      setReprintLoading(false);
    }
  }

  function closeReprint() {
    setReprintOpen(false);
    setReprintSale(null);
    setReprintLoading(false);
  }

  async function resumeHeld(hold) {
    if (submitting || completeStep) return;
    const saleId = hold?.id ?? hold;
    try {
      await guard(async () => {
        let parkedNumber = null;
        if (cart.length > 0) {
          const parked = await parkCurrentCart(paymentTab);
          parkedNumber = parked.sale_number;
        }

        const sale = await saleService.getById(saleId);
        if (!sale?.items?.length) {
          notify.warning("This held ticket has no items left.", { title: "Cannot resume" });
          setHeldSales(await saleService.getHeldSales());
          return;
        }

        setCart(
          sale.items.map((item) => ({
            product_id: item.product_id,
            name: item.product_name || item.name,
            name_ar: item.name_ar,
            unit_price: item.unit_price,
            quantity: item.quantity,
            discount: item.discount,
            total: item.total,
          }))
        );
        setDiscount(sale.discount || 0);
        setCustomerId(sale.customer_id ? String(sale.customer_id) : "");
        await saleService.deleteHeldSale(saleId);
        setHeldSales(await saleService.getHeldSales());
        focusSearch();

        if (parkedNumber) {
          notify.success(`Current cart held as ${parkedNumber}. ${sale.sale_number} is back in the cart.`, {
            title: "Ticket resumed",
          });
        } else {
          notify.success(`${sale.sale_number} is back in the cart.`, { title: "Ticket resumed" });
        }
      });
    } catch (err) {
      notify.error(err.message || "Could not resume this ticket.", { title: "Resume failed" });
    }
  }

  async function discardHeld(hold) {
    if (submitting) return;
    const ok = await confirm({
      title: "Discard held ticket?",
      message: `${hold.sale_number} will be deleted. This cannot be undone.`,
      confirmLabel: "Discard ticket",
      cancelLabel: "Keep ticket",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await saleService.deleteHeldSale(hold.id);
      setHeldSales(await saleService.getHeldSales());
      notify.success(`${hold.sale_number} was discarded.`, { title: "Ticket discarded" });
    } catch (err) {
      notify.error(err.message || "Could not discard this ticket.", { title: "Discard failed" });
    }
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

      {heldSales.length > 0 && (
        <HeldSalesBar
          holds={heldSales}
          currency={currency}
          busy={submitting}
          onResume={resumeHeld}
          onDiscard={discardHeld}
        />
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
                <div
                  key={p.id}
                  className={`pos-product-card ${lowStock ? "low-stock" : ""} ${inCart ? "in-cart" : ""}`}
                  style={{ "--product-accent": `${hue}` }}
                >
                  {canEditProducts && (
                    <button
                      type="button"
                      className="pos-product-edit-btn"
                      onClick={(e) => openProductEdit(p.id, e)}
                      aria-label={`Edit ${p.name}`}
                      title="Edit product"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {inCart > 0 && <span className="pos-product-badge">{inCart}</span>}
                  <button type="button" className="pos-product-card-body" onClick={() => addToCart(p)}>
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
                </div>
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
                <div className="pos-cart-header-actions">
                  <button
                    type="button"
                    className="pos-view-cart"
                    onClick={() => setCartVerifyOpen(true)}
                  >
                    <Eye size={14} /> View
                  </button>
                  <button type="button" className="pos-clear-cart" onClick={clearCart}>
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div
              ref={customerRowRef}
              className={`pos-customer-row ${customerError ? "is-invalid" : ""}`}
            >
              <User size={16} className="pos-customer-icon" />
              <SearchableSelect
                ref={customerSelectRef}
                className="pos-customer-select"
                value={customerId}
                onChange={handleCustomerChange}
                options={customerOptions}
                placeholder="Search customer…"
                noneLabel="Walk-in customer"
                clearable
                menuPortal
                error={customerError}
                creatable={canManageCustomers}
                onCreateOption={handleCreateCustomerOption}
                createLabel={(term) => `Add "${term}"…`}
              />
              {canManageCustomers && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="pos-customer-add-btn"
                  onClick={handleAddCustomerClick}
                  title="Add new customer"
                >
                  <Plus size={16} />
                </Button>
              )}
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
                  <div
                    key={item.product_id}
                    className={`pos-cart-item ${item.quantity > 1 ? "is-multi" : ""} ${
                      cartLineId === item.product_id ? "is-active" : ""
                    }`}
                  >
                    <div className="pos-cart-item-top">
                      <button
                        type="button"
                        className="pos-cart-item-hit"
                        onClick={() => setCartLineId(item.product_id)}
                      >
                        <div className="pos-cart-item-main">
                          <ProductBilingualName name={item.name} nameAr={item.name_ar} size="sm" />
                          <div className="pos-cart-item-price">
                            {formatCurrency(cartItemDisplayUnitPrice(item), currency)} each
                            {item.quantity > 1 ? ` · tap to review ×${item.quantity}` : " · tap to review"}
                          </div>
                        </div>
                        <span className="pos-cart-qty-badge" aria-hidden="true">
                          ×{item.quantity}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="pos-cart-view-btn"
                        onClick={() => setCartVerifyOpen(true)}
                        aria-label="View all selected items"
                        title="View all selected items"
                      >
                        <Eye size={13} />
                      </button>
                      {canEditProducts && (
                        <button
                          type="button"
                          className="pos-cart-edit-btn"
                          onClick={() => openProductEdit(item.product_id)}
                          aria-label={`Edit ${item.name}`}
                          title="Edit product"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
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
                        <button
                          type="button"
                          className="pos-qty-value"
                          onClick={() => setCartLineId(item.product_id)}
                          aria-label={`Review quantity for ${item.name}`}
                        >
                          {formatQuantity(item.quantity, item.unit_symbol)}
                        </button>
                        <button
                          type="button"
                          className="pos-qty-btn"
                          onClick={() => updateQty(item.product_id, 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong className="pos-line-total">
                        {formatCurrency(cartItemDisplayLineTotal(item), currency)}
                      </strong>
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
                <span>Subtotal (excl. VAT)</span>
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
                <span>VAT</span>
                <span>{formatCurrency(vat, currency)}</span>
              </div>
              <div className="pos-summary-row pos-summary-grand">
                <span>Total due</span>
                <span>{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>
          </div>

          <div className="pos-payment-panel">
            {hasCashTender && (
              <div className="pos-payment-body">
                <label className="pos-field-label">Cash received</label>
                <p className="pos-field-hint">Used when you tap Cash. Leave empty for exact amount.</p>
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
              </div>
            )}

            <section className="pos-pay-methods" aria-label="Complete sale">
              <header className="pos-pay-methods-head">
                <div className="pos-pay-methods-copy">
                  <p className="pos-pay-methods-kicker">Complete this sale</p>
                  <h3 className="pos-pay-methods-title">Tap a payment method</h3>
                </div>
                <div className="pos-pay-methods-due">
                  {formatCurrency(grandTotal, currency)}
                </div>
              </header>

              <div className="pos-pay-list">
                {posPaymentMethods.map((method) => {
                  const later = isPayLaterMethod(method.code);
                  const empty = cart.length === 0;
                  return (
                    <button
                      key={method.code}
                      type="button"
                      className={`pos-pay-row pos-pay-row--${paymentMethodTone(method)}`}
                      disabled={submitting || empty || Boolean(completeStep)}
                      aria-label={`Complete sale with ${method.label}`}
                      onClick={() => openCompleteConfirm(method.code)}
                    >
                      <span className="pos-pay-row-icon">
                        <PosPaymentMethodIcon icon={method.icon} size={20} />
                      </span>
                      <span className="pos-pay-row-copy">
                        <span className="pos-pay-row-label">{method.label}</span>
                        <span className="pos-pay-row-hint">
                          {submitting
                            ? "Processing…"
                            : empty
                              ? "Add items first"
                              : paymentMethodHint(method)}
                        </span>
                      </span>
                      <span className="pos-pay-row-action">
                        {later ? "Save" : "Pay"}
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="pos-payment-actions">
              <Button
                variant="secondary"
                disabled={submitting}
                onClick={() => completeHeldSale(paymentTab)}
              >
                <Pause size={16} /> Hold
              </Button>
              <Button variant="secondary" disabled={submitting} onClick={handlePrintLast}>
                <Printer size={16} /> Reprint last
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <SaleCompleteModal
        step={completeStep}
        paymentMethod={pendingPaymentMethod}
        paymentMethodLabel={resolvePaymentMethodLabel(pendingPaymentMethod, posPaymentMethods)}
        collectsCash={paymentMethodCollectsCash(
          posPaymentMethods.find((method) => method.code === pendingPaymentMethod)
        )}
        cart={cart}
        subtotal={subtotal}
        discount={Number(discount)}
        vat={vat}
        grandTotal={grandTotal}
        cashReceived={received}
        changeDue={changeDue}
        balanceDue={balanceDue}
        isPayLater={isPayLaterMethod(pendingPaymentMethod)}
        customerName={
          customerId
            ? customers.find((entry) => String(entry.id) === String(customerId))?.name
            : null
        }
        currency={currency}
        vatPercent={vatPercent}
        completedSale={completedSale}
        settings={settings}
        processing={submitting}
        printingReceipt={printingReceipt}
        zatcaQueued={zatcaPhase2 && Boolean(completedSale)}
        printInvoice={printOnComplete}
        onPrintInvoiceChange={setPrintOnComplete}
        onConfirmComplete={handleConfirmComplete}
        onCancel={closeCompleteFlow}
        onPrint={handlePrintReceipt}
        onSkipPrint={handleSkipPrint}
      />

      {cartLineItem && (
        <CartLineSheet
          item={cartLineItem}
          currency={currency}
          onSetQty={(qty) => setItemQty(cartLineItem.product_id, qty)}
          onRemove={() => removeItem(cartLineItem.product_id)}
          onClose={() => setCartLineId(null)}
        />
      )}

      <CartVerifyModal
        isOpen={cartVerifyOpen}
        cart={cart}
        customerName={
          customerId
            ? customers.find((entry) => String(entry.id) === String(customerId))?.name
            : null
        }
        subtotal={subtotal}
        discount={Number(discount)}
        vat={vat}
        grandTotal={grandTotal}
        currency={currency}
        vatPercent={vatPercent}
        onClose={() => setCartVerifyOpen(false)}
      />

      <LastOrderReprintModal
        isOpen={reprintOpen}
        loading={reprintLoading}
        sale={reprintSale}
        settings={settings}
        currency={currency}
        onClose={closeReprint}
      />

      <SaleReturnModal
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        onSuccess={(result) => {
          notify.success(
            `Return ${result.returnNumber} — ${formatCurrency(result.totalRefund, currency)} refunded`,
            { title: "Return completed" }
          );
          refreshTopProducts();
        }}
        currency={currency}
      />

      <PosProductEditModal
        isOpen={editProductId != null}
        productId={editProductId}
        currency={currency}
        onClose={closeProductEdit}
        onSaved={handleProductSaved}
      />

      <PosCustomerModal
        isOpen={customerModalOpen}
        initialName={customerModalInitialName}
        onClose={() => closeCustomerModal(null)}
        onSaved={handleCustomerSaved}
      />
      {confirmDialog}
    </div>
  );
}
