/** Canonical product import/export column definitions (UTF-8). */
import { IMPORT_VAT_DEFAULTS } from "./vatDefaults.js";

export const PRODUCT_IMPORT_COLUMNS = [
  {
    key: "name",
    label: "name",
    title: "English Name",
    required: true,
    example: "Fresh Milk 1L",
    hint: "Required. Shown on POS and receipts.",
  },
  {
    key: "name_ar",
    label: "name_ar",
    title: "Arabic Name",
    required: false,
    example: "حليب طازج ١ لتر",
    hint: "Optional. Used on bilingual receipts and labels.",
  },
  {
    key: "sku",
    label: "sku",
    title: "SKU",
    required: false,
    example: "MILK-1L",
    hint: "Your internal product code. Used to match updates.",
  },
  {
    key: "barcode",
    label: "barcode",
    title: "Barcode",
    required: false,
    example: "6281000123453",
    hint: "EAN-13 / UPC. Used for scanner lookup and duplicate detection.",
  },
  {
    key: "category",
    label: "category",
    title: "Category",
    required: false,
    example: "Dairy",
    hint: "Category name. Created automatically if it does not exist.",
  },
  {
    key: "unit",
    label: "unit",
    title: "Unit",
    required: false,
    example: "L",
    hint: "Unit symbol or name (e.g. pcs, L, kg). Must already exist in Settings → Units.",
  },
  {
    key: "supplier",
    label: "supplier",
    title: "Supplier",
    required: false,
    example: "Almarai Trading",
    hint: "Supplier company name. Exact match, similar spelling, or auto-created if new. Leave blank if none.",
  },
  {
    key: "cost_price",
    label: "cost_price",
    title: "Cost Price",
    required: false,
    example: "4.50",
    hint: "Purchase cost per unit.",
  },
  {
    key: "selling_price",
    label: "selling_price",
    title: "Selling Price",
    required: true,
    example: "11.50",
    hint: "Required. Shelf price customers pay when price type is inclusive (Saudi retail default).",
  },
  {
    key: "tax_category",
    label: "tax_category",
    title: "Tax Category",
    required: false,
    example: "standard",
    hint: "standard · zero_rated · exempt. Use standard for normal 15% VAT items.",
  },
  {
    key: "vat_rate",
    label: "vat_rate",
    title: "VAT Rate %",
    required: false,
    example: "15",
    hint: "Optional override. Leave blank to use store VAT % from Settings.",
  },
  {
    key: "vat_price_type",
    label: "vat_price_type",
    title: "Price Type",
    required: false,
    example: "inclusive",
    hint: "inherit · inclusive · exclusive. inherit = use store setting (recommended).",
  },
  {
    key: "quantity",
    label: "quantity",
    title: "Quantity",
    required: false,
    example: "50",
    hint: "Opening stock on hand.",
  },
  {
    key: "min_stock",
    label: "min_stock",
    title: "Min Stock",
    required: false,
    example: "10",
    hint: "Low-stock alert threshold.",
  },
  {
    key: "published",
    label: "published",
    title: "Published",
    required: false,
    example: "yes",
    hint: "yes = visible in Sales POS · no = unpublished draft",
  },
];

/** Map common header variants (English / aliases) to canonical keys. */
const HEADER_ALIASES = {
  name: ["name", "product_name", "product name", "english name", "english_name", "title"],
  name_ar: ["name_ar", "arabic_name", "arabic name", "name ar", "name (arabic)"],
  sku: ["sku", "product_sku", "product sku", "code", "item code", "item_code"],
  barcode: ["barcode", "bar code", "upc", "ean", "ean13", "gtin"],
  category: ["category", "category_name", "category name", "cat"],
  unit: ["unit", "unit_name", "unit name", "unit_symbol", "unit symbol", "uom"],
  supplier: ["supplier", "supplier_name", "supplier name", "vendor", "vendor_name", "vendor name"],
  cost_price: ["cost_price", "cost price", "cost", "purchase_price", "purchase price"],
  selling_price: [
    "selling_price",
    "selling price",
    "price",
    "sale_price",
    "sale price",
    "retail_price",
    "retail price",
    "shelf_price",
    "shelf price",
  ],
  tax_category: [
    "tax_category",
    "tax category",
    "vat_category",
    "vat category",
    "tax treatment",
    "tax_treatment",
  ],
  vat_rate: ["vat_rate", "vat rate", "vat_percent", "vat percent", "vat %", "tax_rate", "tax rate"],
  vat_price_type: [
    "vat_price_type",
    "vat price type",
    "price_type",
    "price type",
    "vat_included",
    "vat included",
    "price includes vat",
    "price_includes_vat",
  ],
  quantity: ["quantity", "qty", "stock", "on_hand", "on hand", "opening_stock", "opening stock"],
  min_stock: ["min_stock", "min stock", "minimum_stock", "minimum stock", "reorder_level", "reorder level"],
  published: ["published", "active", "visible", "status", "is_published", "is published"],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\ufeff/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function mapHeaders(rawHeaders) {
  const mapping = {};
  const normalizedAliases = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [
      key,
      aliases.map((a) => normalizeHeader(a)),
    ])
  );

  rawHeaders.forEach((header, index) => {
    const norm = normalizeHeader(header);
    if (!norm) return;

    for (const [key, aliases] of Object.entries(normalizedAliases)) {
      if (aliases.includes(norm) || norm === key) {
        if (mapping[key] == null) mapping[key] = index;
        break;
      }
    }
  });

  return mapping;
}

export function rowToProduct(rawRow, headerMap) {
  const get = (key) => {
    const idx = headerMap[key];
    if (idx == null) return "";
    const val = rawRow[idx];
    return val == null ? "" : String(val).trim();
  };

  return {
    name: get("name"),
    name_ar: get("name_ar"),
    sku: get("sku"),
    barcode: get("barcode"),
    category: get("category"),
    unit: get("unit"),
    supplier: get("supplier"),
    cost_price: get("cost_price"),
    selling_price: get("selling_price"),
    tax_category: get("tax_category") || IMPORT_VAT_DEFAULTS.tax_category,
    vat_rate: get("vat_rate"),
    vat_price_type: get("vat_price_type") || IMPORT_VAT_DEFAULTS.vat_price_type,
    quantity: get("quantity"),
    min_stock: get("min_stock"),
    published: get("published"),
  };
}

export function templateHeaders() {
  return PRODUCT_IMPORT_COLUMNS.map((c) => c.label);
}

export function templateSampleRows() {
  return [
    [
      "Pepsi 330ml",
      "بيبسي ٣٣٠ مل",
      "PEPSI-330",
      "6281000123453",
      "Beverages",
      "pcs",
      "",
      "8.50",
      "11.50",
      "standard",
      "15",
      "inclusive",
      "120",
      "24",
      "yes",
    ],
    [
      "Fresh Milk 1L",
      "حليب طازج ١ لتر",
      "MILK-1L",
      "6281000987654",
      "Dairy",
      "L",
      "Almarai Trading",
      "4.50",
      "8.00",
      "standard",
      "",
      "inherit",
      "50",
      "10",
      "yes",
    ],
    [
      "Arabic Coffee 250g",
      "قهوة عربية ٢٥٠ جم",
      "COFF-250",
      "6281012345678",
      "Beverages",
      "kg",
      "",
      "25.00",
      "45.00",
      "zero_rated",
      "0",
      "inclusive",
      "20",
      "5",
      "yes",
    ],
  ];
}

/** @deprecated use templateSampleRows()[0] */
export function templateSampleRow() {
  return templateSampleRows()[0];
}

export function templateInstructionsRows() {
  return [
    ["Product Import Template — Dukkan POS"],
    [""],
    ["Required columns", "name, selling_price"],
    ["Optional columns", "All other columns below"],
    [""],
    ["Column", "Required", "Description", "Example"],
    ...PRODUCT_IMPORT_COLUMNS.map((col) => [
      col.label,
      col.required ? "Yes" : "No",
      col.hint,
      col.example,
    ]),
    [""],
    ["Published values", "yes, no, 1, 0, active, inactive, published, draft"],
    [
      "Tax category",
      "standard (15% VAT) · zero_rated (0%) · exempt (0%, exempt treatment)",
    ],
    [
      "Price type (vat_price_type)",
      "inherit (use store default) · inclusive (shelf price incl. VAT) · exclusive (VAT added at checkout)",
    ],
    [
      "VAT-inclusive example",
      "Pepsi selling_price 11.50 · vat_price_type inclusive · vat_rate 15 → net 10.00 + VAT 1.50",
    ],
    ["Duplicate matching", "Imports match existing products by SKU or barcode"],
    ["Category", "New category names are created automatically"],
    ["Unit", "Must match an existing unit symbol or name (Settings → Units)"],
    ["Supplier", "Matched to existing supplier (fuzzy spelling OK) or created automatically"],
    [""],
    ["Fill in the Products sheet starting from row 2, then import via Products → Import / Export."],
  ];
}
