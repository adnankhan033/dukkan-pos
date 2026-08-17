import { parseVatModeInput, vatModeToDbFields } from "../vatPricing";

export const IMPORT_MODES = {
  NEW_ONLY: "new_only",
  UPDATE: "update",
  SKIP_DUPLICATES: "skip_duplicates",
  REPLACE_ALL: "replace_all",
};

export const IMPORT_MODE_LABELS = {
  [IMPORT_MODES.NEW_ONLY]: "Import new products only",
  [IMPORT_MODES.UPDATE]: "Update existing products (match by SKU or barcode)",
  [IMPORT_MODES.SKIP_DUPLICATES]: "Skip duplicate SKUs / barcodes",
  [IMPORT_MODES.REPLACE_ALL]: "Replace all existing products",
};

function parseNumber(value, field, { allowEmpty = true, integer = false } = {}) {
  if (value === "" || value == null) {
    return allowEmpty ? { ok: true, value: null } : { ok: false, error: `${field} is required` };
  }
  const num = Number(String(value).replace(/,/g, "").trim());
  if (Number.isNaN(num)) {
    return { ok: false, error: `${field} must be a valid number` };
  }
  if (num < 0) {
    return { ok: false, error: `${field} cannot be negative` };
  }
  if (integer && !Number.isInteger(num)) {
    return { ok: false, error: `${field} must be a whole number` };
  }
  return { ok: true, value: num };
}

function parsePublished(value) {
  if (value === "" || value == null) return { ok: true, value: 1 };
  const norm = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "published", "active"].includes(norm)) {
    return { ok: true, value: 1 };
  }
  if (["0", "false", "no", "n", "unpublished", "inactive", "draft"].includes(norm)) {
    return { ok: true, value: 0 };
  }
  return { ok: false, error: 'published must be yes/no, 1/0, or active/inactive' };
}

function parseVat(value) {
  const mode = parseVatModeInput(value);
  if (!mode) {
    return { ok: false, error: "vat must be default, zero_rated, or exempt" };
  }
  const fields = vatModeToDbFields(mode);
  return {
    ok: true,
    mode,
    taxCategory: fields.tax_category,
    vatRate: fields.vat_rate,
    vatIncluded: fields.vat_included,
  };
}

function normKey(value) {
  const v = String(value ?? "").trim();
  return v ? v.toLowerCase() : "";
}

export function validateImportRows(
  rows,
  {
    skuIndex = new Map(),
    barcodeIndex = new Map(),
    unitIndex = new Map(),
    supplierIndex = new Map(),
    mode = IMPORT_MODES.NEW_ONLY,
  } = {}
) {
  const fileSku = new Map();
  const fileBarcode = new Map();
  const validated = [];
  const errors = [];

  for (const row of rows) {
    const issues = [];
    const d = row.data;

    if (!d.name?.trim()) {
      issues.push("name is required");
    }

    const selling = parseNumber(d.selling_price, "selling_price", { allowEmpty: false });
    if (!selling.ok) issues.push(selling.error);

    const cost = parseNumber(d.cost_price, "cost_price");
    if (!cost.ok) issues.push(cost.error);

    const qty = parseNumber(d.quantity, "quantity", { integer: true });
    if (!qty.ok) issues.push(qty.error);

    const minStock = parseNumber(d.min_stock, "min_stock", { integer: true });
    if (!minStock.ok) issues.push(minStock.error);

    const published = parsePublished(d.published);
    if (!published.ok) issues.push(published.error);

    const vat = parseVat(d.vat);
    if (!vat.ok) issues.push(vat.error);

    const skuKey = normKey(d.sku);
    const barcodeKey = normKey(d.barcode);

    if (skuKey) {
      if (fileSku.has(skuKey)) {
        issues.push(`duplicate SKU in file (also on row ${fileSku.get(skuKey)})`);
      } else {
        fileSku.set(skuKey, row.rowNumber);
      }
      if (skuIndex.has(skuKey)) {
        if (mode === IMPORT_MODES.NEW_ONLY) {
          issues.push(`SKU already exists in database (product id ${skuIndex.get(skuKey)})`);
        }
      }
    }

    if (barcodeKey) {
      if (fileBarcode.has(barcodeKey)) {
        issues.push(`duplicate barcode in file (also on row ${fileBarcode.get(barcodeKey)})`);
      } else {
        fileBarcode.set(barcodeKey, row.rowNumber);
      }
      if (barcodeIndex.has(barcodeKey)) {
        if (mode === IMPORT_MODES.NEW_ONLY) {
          issues.push(`barcode already exists in database (product id ${barcodeIndex.get(barcodeKey)})`);
        }
      }
    }

    const unitKey = normKey(d.unit);
    if (unitKey && unitIndex && !unitIndex.has(unitKey)) {
      issues.push(`unit "${d.unit}" not found — create it in Settings → Units first`);
    }

    // Supplier: resolved at import time (exact match, fuzzy match, or auto-create).

    if (issues.length) {
      errors.push({
        rowNumber: row.rowNumber,
        data: d,
        raw: row.raw,
        messages: issues,
      });
      validated.push({ ...row, valid: false, errors: issues });
    } else {
      validated.push({
        ...row,
        valid: true,
        parsed: {
          name: d.name.trim(),
          name_ar: d.name_ar?.trim() || null,
          sku: d.sku?.trim() || null,
          barcode: d.barcode?.trim() || null,
          category_name: d.category?.trim() || null,
          unit_name: d.unit?.trim() || null,
          supplier_name: d.supplier?.trim() || null,
          cost_price: cost.value ?? 0,
          selling_price: selling.value,
          tax_category: vat.taxCategory,
          vat_rate: vat.vatRate,
          vat_included: vat.vatIncluded,
          quantity: qty.value ?? 0,
          min_stock: minStock.value ?? 0,
          published: published.value,
        },
      });
    }
  }

  return { validated, errors };
}

export function buildErrorReportCsv(headers, errorRows) {
  const reportHeaders = ["row", "errors", ...headers];
  const lines = [reportHeaders.join(",")];

  for (const err of errorRows) {
    const cells = [
      err.rowNumber,
      `"${err.messages.join("; ").replace(/"/g, '""')}"`,
      ...(err.raw || []).map((c) => {
        const s = String(c ?? "");
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }),
    ];
    lines.push(cells.join(","));
  }

  return `\ufeff${lines.join("\r\n")}`;
}
