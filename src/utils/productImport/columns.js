/** Canonical product import/export column definitions (UTF-8). */
export const PRODUCT_IMPORT_COLUMNS = [
  { key: "name", label: "name", required: true },
  { key: "name_ar", label: "name_ar", required: false },
  { key: "sku", label: "sku", required: false },
  { key: "barcode", label: "barcode", required: false },
  { key: "category", label: "category", required: false },
  { key: "cost_price", label: "cost_price", required: false },
  { key: "selling_price", label: "selling_price", required: true },
  { key: "quantity", label: "quantity", required: false },
  { key: "min_stock", label: "min_stock", required: false },
  { key: "published", label: "published", required: false },
];

/** Map common header variants (English / aliases) to canonical keys. */
const HEADER_ALIASES = {
  name: ["name", "product_name", "product name", "english name", "title"],
  name_ar: ["name_ar", "arabic_name", "arabic name", "name ar", "name (arabic)"],
  sku: ["sku", "product_sku", "product sku", "code"],
  barcode: ["barcode", "bar code", "upc", "ean"],
  category: ["category", "category_name", "category name", "cat"],
  cost_price: ["cost_price", "cost price", "cost", "purchase_price", "purchase price"],
  selling_price: ["selling_price", "selling price", "price", "sale_price", "sale price", "retail_price"],
  quantity: ["quantity", "qty", "stock", "on_hand", "on hand"],
  min_stock: ["min_stock", "min stock", "minimum_stock", "minimum stock", "reorder_level"],
  published: ["published", "active", "visible", "status"],
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
    cost_price: get("cost_price"),
    selling_price: get("selling_price"),
    quantity: get("quantity"),
    min_stock: get("min_stock"),
    published: get("published"),
  };
}

export function templateHeaders() {
  return PRODUCT_IMPORT_COLUMNS.map((c) => c.label);
}

export function templateSampleRow() {
  return [
    "Sample Product",
    "منتج تجريبي",
    "SKU-001",
    "1234567890123",
    "Beverages",
    "5.00",
    "10.00",
    "100",
    "10",
    "yes",
  ];
}
