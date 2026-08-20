/** VAT pricing — inclusive shelf prices and tax categories. */

export const TAX_CATEGORIES = {
  STANDARD: "standard",
  ZERO_RATED: "zero_rated",
  EXEMPT: "exempt",
};

export const TAX_CATEGORY_OPTIONS = [
  { value: TAX_CATEGORIES.STANDARD, label: "Standard (15% VAT)" },
  { value: TAX_CATEGORIES.ZERO_RATED, label: "Zero-rated (0%)" },
  { value: TAX_CATEGORIES.EXEMPT, label: "Exempt" },
];

export const VAT_PRICE_TYPE = {
  INHERIT: "inherit",
  INCLUSIVE: "inclusive",
  EXCLUSIVE: "exclusive",
};

function settingOn(value) {
  return value !== "0" && value !== "false" && value !== false;
}

/** Tax/VAT is on by default so existing stores keep current behavior. */
export function isTaxEnabled(storeSettings = {}) {
  const value = storeSettings.tax_enabled;
  if (value === undefined || value === null || value === "") return true;
  return settingOn(value);
}

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/** VAT embedded in a tax-inclusive price: price × rate / (100 + rate). */
export function extractVatFromInclusive(priceIncl, rate) {
  const r = Number(rate) || 0;
  if (r <= 0) return 0;
  return roundMoney((Number(priceIncl) * r) / (100 + r));
}

/** Net (excl. VAT) from an inclusive shelf price. */
export function extractExclusiveFromInclusive(priceIncl, rate) {
  return roundMoney(Number(priceIncl) - extractVatFromInclusive(priceIncl, rate));
}

/** Customer-facing shelf price from an exclusive unit price. */
export function exclusiveToInclusiveUnitPrice(priceExcl, rate) {
  const r = Number(rate) || 0;
  if (r <= 0) return roundMoney(priceExcl);
  return roundMoney(Number(priceExcl) * (1 + r / 100));
}

export function resolveStoreVatIncluded(storeSettings = {}) {
  return settingOn(storeSettings.vat_included ?? "1");
}

export function resolveProductVatSettings(product = {}, storeSettings = {}) {
  if (!isTaxEnabled(storeSettings)) {
    return { taxCategory: TAX_CATEGORIES.STANDARD, vatRate: 0, vatIncluded: false };
  }

  const taxCategory = product.tax_category || TAX_CATEGORIES.STANDARD;
  const storeRate = Number(storeSettings.vat_percent) || 0;

  let vatRate =
    product.vat_rate != null && product.vat_rate !== ""
      ? Number(product.vat_rate)
      : storeRate;

  if (taxCategory !== TAX_CATEGORIES.STANDARD) {
    vatRate = 0;
  }

  let vatIncluded;
  if (product.vat_included === 1 || product.vat_included === true) {
    vatIncluded = true;
  } else if (product.vat_included === 0 || product.vat_included === false) {
    vatIncluded = false;
  } else {
    vatIncluded = resolveStoreVatIncluded(storeSettings);
  }

  return { taxCategory, vatRate, vatIncluded };
}

/** Convert shelf selling price to tax-exclusive unit price for cart / sale storage. */
export function shelfToExclusiveUnitPrice(shelfPrice, { vatIncluded, vatRate }) {
  const price = Number(shelfPrice) || 0;
  if (!vatIncluded || !vatRate) return roundMoney(price);
  return extractExclusiveFromInclusive(price, vatRate);
}

/** Build a POS cart line from a catalog product. */
export function buildCartLineFromProduct(product, storeSettings = {}, quantity = 1) {
  const vat = resolveProductVatSettings(product, storeSettings);
  const shelfUnitPrice = roundMoney(product.selling_price);
  const unitPrice = shelfToExclusiveUnitPrice(shelfUnitPrice, vat);
  const lineTotalExcl = roundMoney(unitPrice * quantity);
  const shelfLineTotal = roundMoney(shelfUnitPrice * quantity);

  return {
    product_id: product.id,
    name: product.name,
    name_ar: product.name_ar || "",
    unit_symbol: product.unit_symbol || "pcs",
    unit_price: unitPrice,
    shelf_unit_price: shelfUnitPrice,
    catalog_shelf_unit_price: shelfUnitPrice,
    quantity,
    discount: 0,
    total: lineTotalExcl,
    shelf_line_total: shelfLineTotal,
    vat_rate: vat.vatRate,
    vat_included: vat.vatIncluded,
    tax_category: vat.taxCategory,
    price_overridden: false,
  };
}

/** Apply a customer-facing price to one cart line for this sale only. */
export function applyCartLineShelfPrice(item, shelfPrice) {
  const qty = Number(item.quantity) || 0;
  const shelfUnitPrice = roundMoney(Math.max(0, Number(shelfPrice) || 0));
  const catalogShelf = roundMoney(
    item.catalog_shelf_unit_price != null ? item.catalog_shelf_unit_price : item.shelf_unit_price
  );
  const unitPrice = shelfToExclusiveUnitPrice(shelfUnitPrice, {
    vatIncluded: item.vat_included,
    vatRate: item.vat_rate,
  });

  return {
    ...item,
    catalog_shelf_unit_price: catalogShelf,
    shelf_unit_price: shelfUnitPrice,
    unit_price: unitPrice,
    total: roundMoney(unitPrice * qty),
    shelf_line_total: roundMoney(shelfUnitPrice * qty),
    price_overridden: catalogShelf !== shelfUnitPrice,
  };
}

/** Cart totals with per-line VAT rates and proportional order discount. */
export function calcCartTotals(cart = [], orderDiscount = 0, storeSettings = null) {
  const subtotal = roundMoney(cart.reduce((sum, item) => sum + (Number(item.total) || 0), 0));
  const discount = Math.max(0, Number(orderDiscount) || 0);
  const taxOn = storeSettings == null ? true : isTaxEnabled(storeSettings);

  let vat = 0;
  for (const item of cart) {
    const lineExcl = Number(item.total) || 0;
    const lineShare = subtotal > 0 ? lineExcl / subtotal : 0;
    const lineDiscount = discount * lineShare;
    const taxableExcl = Math.max(0, lineExcl - lineDiscount);
    const rate = taxOn ? Number(item.vat_rate) || 0 : 0;
    vat += (taxableExcl * rate) / 100;
  }

  vat = roundMoney(vat);
  const total = roundMoney(Math.max(0, subtotal - discount + vat));

  return { subtotal, discount, vat, total };
}

/** Display unit price on POS (shelf / customer-facing). */
export function cartItemDisplayUnitPrice(item) {
  if (item.shelf_unit_price != null) return roundMoney(item.shelf_unit_price);
  if (item.vat_included) {
    return exclusiveToInclusiveUnitPrice(item.unit_price, item.vat_rate);
  }
  return roundMoney(item.unit_price);
}

/** Display line total on POS (customer-facing). */
export function cartItemDisplayLineTotal(item) {
  if (item.shelf_line_total != null) return roundMoney(item.shelf_line_total);
  return roundMoney(cartItemDisplayUnitPrice(item) * (Number(item.quantity) || 0));
}

export function vatIncludedToPriceType(vatIncluded) {
  if (vatIncluded === 1 || vatIncluded === true) return VAT_PRICE_TYPE.INCLUSIVE;
  if (vatIncluded === 0 || vatIncluded === false) return VAT_PRICE_TYPE.EXCLUSIVE;
  return VAT_PRICE_TYPE.INHERIT;
}

export function priceTypeToVatIncluded(priceType) {
  if (priceType === VAT_PRICE_TYPE.INCLUSIVE) return 1;
  if (priceType === VAT_PRICE_TYPE.EXCLUSIVE) return 0;
  return null;
}

/** Simple product VAT mode — one field instead of tax category + rate + price type. */
export const VAT_MODE = {
  DEFAULT: "default",
  ZERO_RATED: "zero_rated",
  EXEMPT: "exempt",
};

export function productToVatMode(product = {}) {
  const cat = product.tax_category || TAX_CATEGORIES.STANDARD;
  if (cat === TAX_CATEGORIES.ZERO_RATED) return VAT_MODE.ZERO_RATED;
  if (cat === TAX_CATEGORIES.EXEMPT) return VAT_MODE.EXEMPT;
  return VAT_MODE.DEFAULT;
}

export function vatModeToDbFields(vatMode) {
  switch (vatMode) {
    case VAT_MODE.ZERO_RATED:
      return { tax_category: TAX_CATEGORIES.ZERO_RATED, vat_rate: null, vat_included: null };
    case VAT_MODE.EXEMPT:
      return { tax_category: TAX_CATEGORIES.EXEMPT, vat_rate: null, vat_included: null };
    default:
      return { tax_category: TAX_CATEGORIES.STANDARD, vat_rate: null, vat_included: null };
  }
}

/** Parse import/form VAT values: default · zero_rated · exempt */
export function parseVatModeInput(value) {
  if (value === "" || value == null) return VAT_MODE.DEFAULT;
  const norm = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["default", "store", "standard", "inherit", "normal", "yes", "15"].includes(norm)) {
    return VAT_MODE.DEFAULT;
  }
  if (["zero", "zero_rated", "0", "zero_rate"].includes(norm)) {
    return VAT_MODE.ZERO_RATED;
  }
  if (["exempt", "exempted", "no_vat", "none"].includes(norm)) {
    return VAT_MODE.EXEMPT;
  }
  return null;
}

export function storeDefaultVatLabel(storeSettings = {}) {
  const rate = storeSettings.vat_percent || "15";
  return resolveStoreVatIncluded(storeSettings)
    ? `Store default (${rate}% VAT included in price)`
    : `Store default (${rate}% VAT added at checkout)`;
}

/** Preview net + VAT for product form helper text. */
export function previewVatBreakdown(shelfPrice, storeSettings, productOverrides = {}) {
  const vat = resolveProductVatSettings(productOverrides, storeSettings);
  const price = Number(shelfPrice) || 0;
  if (!price || vat.taxCategory !== TAX_CATEGORIES.STANDARD) {
    return { net: price, vat: 0, gross: price, vatIncluded: vat.vatIncluded, vatRate: vat.vatRate };
  }
  if (vat.vatIncluded) {
    const vatAmount = extractVatFromInclusive(price, vat.vatRate);
    return {
      net: roundMoney(price - vatAmount),
      vat: vatAmount,
      gross: price,
      vatIncluded: true,
      vatRate: vat.vatRate,
    };
  }
  const vatAmount = roundMoney((price * vat.vatRate) / 100);
  return {
    net: price,
    vat: vatAmount,
    gross: roundMoney(price + vatAmount),
    vatIncluded: false,
    vatRate: vat.vatRate,
  };
}
