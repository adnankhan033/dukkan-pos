import { query, queryOne, execute, insert, getDatabase } from "../database/connection";
import { categoryService } from "./CategoryService";
import { unitService } from "./UnitService";
import { invalidateDashboardCache } from "./DashboardCache";
import { PRODUCT_IMPORT_BATCH_SIZE } from "../utils/constants";
import { IMPORT_MODES } from "../utils/productImport/validate";
import { templateHeaders, templateSampleRows } from "../utils/productImport/columns";
import { rowsToCsv } from "../utils/productImport/csv";
import {
  buildExcelWorkbook,
  buildTemplateWorkbook,
  workbookToArrayBuffer,
} from "../utils/productImport/excel";

const EXPORT_HEADERS = [
  "name",
  "name_ar",
  "sku",
  "barcode",
  "category",
  "unit",
  "supplier",
  "cost_price",
  "selling_price",
  "quantity",
  "min_stock",
  "published",
];

class ProductImportService {
  async ensureImportLogsTable() {
    await execute(
      `CREATE TABLE IF NOT EXISTS import_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        file_name TEXT,
        mode TEXT,
        total_rows INTEGER DEFAULT 0,
        imported INTEGER DEFAULT 0,
        updated INTEGER DEFAULT 0,
        skipped INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    );
  }

  async logOperation(entry) {
    await this.ensureImportLogsTable();
    await insert(
      `INSERT INTO import_logs (operation, file_name, mode, total_rows, imported, updated, skipped, failed, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.operation,
        entry.fileName || null,
        entry.mode || null,
        entry.totalRows ?? 0,
        entry.imported ?? 0,
        entry.updated ?? 0,
        entry.skipped ?? 0,
        entry.failed ?? 0,
        entry.details ? JSON.stringify(entry.details) : null,
      ]
    );
  }

  async getExistingIndex() {
    const rows = await query(
      `SELECT id, lower(trim(sku)) AS sku_key, lower(trim(barcode)) AS barcode_key
       FROM products
       WHERE (sku IS NOT NULL AND trim(sku) != '')
          OR (barcode IS NOT NULL AND trim(barcode) != '')`
    );

    const skuIndex = new Map();
    const barcodeIndex = new Map();

    for (const row of rows) {
      if (row.sku_key) skuIndex.set(row.sku_key, row.id);
      if (row.barcode_key) barcodeIndex.set(row.barcode_key, row.id);
    }

    return { skuIndex, barcodeIndex };
  }

  async getReferenceIndexes() {
    const [units, suppliers] = await Promise.all([
      unitService.getAll(),
      query("SELECT id, company FROM suppliers ORDER BY company ASC"),
    ]);

    const unitIndex = new Map();
    for (const unit of units) {
      if (unit.symbol?.trim()) {
        unitIndex.set(unit.symbol.trim().toLowerCase(), unit.id);
      }
      if (unit.name?.trim()) {
        unitIndex.set(unit.name.trim().toLowerCase(), unit.id);
      }
    }

    const supplierIndex = new Map();
    for (const supplier of suppliers) {
      if (supplier.company?.trim()) {
        supplierIndex.set(supplier.company.trim().toLowerCase(), supplier.id);
      }
    }

    return { unitIndex, supplierIndex };
  }

  async getValidationIndexes() {
    const [{ skuIndex, barcodeIndex }, { unitIndex, supplierIndex }] = await Promise.all([
      this.getExistingIndex(),
      this.getReferenceIndexes(),
    ]);
    return { skuIndex, barcodeIndex, unitIndex, supplierIndex };
  }

  async findProductId(parsed, skuIndex, barcodeIndex) {
    const skuKey = parsed.sku?.trim().toLowerCase();
    const barcodeKey = parsed.barcode?.trim().toLowerCase();

    if (skuKey && skuIndex.has(skuKey)) return skuIndex.get(skuKey);
    if (barcodeKey && barcodeIndex.has(barcodeKey)) return barcodeIndex.get(barcodeKey);
    return null;
  }

  async resolveCategoryId(name, cache) {
    if (!name?.trim()) return null;
    const key = name.trim().toLowerCase();
    if (cache.has(key)) return cache.get(key);

    const existing = await queryOne(
      "SELECT id FROM categories WHERE lower(trim(name)) = lower(trim($1))",
      [name.trim()]
    );
    if (existing?.id) {
      cache.set(key, existing.id);
      return existing.id;
    }

    const created = await categoryService.create({ name: name.trim() });
    cache.set(key, created.id);
    return created.id;
  }

  resolveUnitId(nameOrSymbol, unitIndex) {
    const key = nameOrSymbol?.trim().toLowerCase();
    if (!key) return null;
    return unitIndex.get(key) ?? null;
  }

  resolveSupplierId(company, supplierIndex) {
    const key = company?.trim().toLowerCase();
    if (!key) return null;
    return supplierIndex.get(key) ?? null;
  }

  async deleteAllProducts() {
    await execute("DELETE FROM inventory");
    await execute("DELETE FROM sale_items");
    await execute("DELETE FROM purchase_items");
    await execute("DELETE FROM sale_return_items");
    await execute("DELETE FROM products");
  }

  async beginBatch() {
    await execute("BEGIN IMMEDIATE");
  }

  async commitBatch() {
    await execute("COMMIT");
  }

  async rollbackBatch() {
    try {
      await execute("ROLLBACK");
    } catch {
      /* ignore */
    }
  }

  async insertProduct(parsed, categoryId, unitId, supplierId) {
    return insert(
      `INSERT INTO products (name, name_ar, sku, barcode, category_id, unit_id, supplier_id, cost_price, selling_price, quantity, min_stock, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        parsed.name,
        parsed.name_ar,
        parsed.sku,
        parsed.barcode,
        categoryId,
        unitId,
        supplierId,
        parsed.cost_price,
        parsed.selling_price,
        parsed.quantity,
        parsed.min_stock,
        parsed.published,
      ]
    );
  }

  async updateProduct(id, parsed, categoryId, unitId, supplierId) {
    await execute(
      `UPDATE products SET
        name = $1, name_ar = $2, sku = $3, barcode = $4, category_id = $5, unit_id = $6, supplier_id = $7,
        cost_price = $8, selling_price = $9, quantity = $10, min_stock = $11,
        published = $12, updated_at = datetime('now')
       WHERE id = $13`,
      [
        parsed.name,
        parsed.name_ar,
        parsed.sku,
        parsed.barcode,
        categoryId,
        unitId,
        supplierId,
        parsed.cost_price,
        parsed.selling_price,
        parsed.quantity,
        parsed.min_stock,
        parsed.published,
        id,
      ]
    );
    return id;
  }

  async yieldToUi() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async runImport(validatedRows, { mode, fileName, onProgress, isCancelled = () => false }) {
    await getDatabase();
    await this.ensureImportLogsTable();

    const summary = {
      totalRows: validatedRows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      cancelled: false,
    };

    const startTime = Date.now();
    let processed = 0;

    const report = (phase = "importing") => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed > 0 ? processed / elapsed : 0;
      const remaining = importTotal - processed;
      const etaSeconds = rate > 0 ? Math.round(remaining / rate) : null;

      onProgress?.({
        phase,
        processed,
        total: importTotal,
        percent: importTotal ? Math.round((processed / importTotal) * 100) : 100,
        imported: summary.imported,
        updated: summary.updated,
        skipped: summary.skipped,
        failed: summary.failed,
        etaSeconds,
      });
    };

    if (mode === IMPORT_MODES.REPLACE_ALL) {
      await this.deleteAllProducts();
    }

    let { skuIndex, barcodeIndex } = await this.getExistingIndex();
    const { unitIndex, supplierIndex } = await this.getReferenceIndexes();
    const categoryCache = new Map();

    const validRows = validatedRows.filter((r) => r.valid);
    const importTotal = validRows.length;

    for (let i = 0; i < validRows.length; i += PRODUCT_IMPORT_BATCH_SIZE) {
      if (isCancelled()) {
        summary.cancelled = true;
        break;
      }

      const batch = validRows.slice(i, i + PRODUCT_IMPORT_BATCH_SIZE);

      try {
        await this.beginBatch();

        for (const row of batch) {
          if (isCancelled()) {
            summary.cancelled = true;
            break;
          }

          try {
            const parsed = row.parsed;
            const existingId = await this.findProductId(parsed, skuIndex, barcodeIndex);
            const categoryId = await this.resolveCategoryId(parsed.category_name, categoryCache);
            const unitId = this.resolveUnitId(parsed.unit_name, unitIndex);
            const supplierId = this.resolveSupplierId(parsed.supplier_name, supplierIndex);

            if (existingId) {
              if (mode === IMPORT_MODES.NEW_ONLY || mode === IMPORT_MODES.SKIP_DUPLICATES) {
                summary.skipped += 1;
              } else if (mode === IMPORT_MODES.UPDATE || mode === IMPORT_MODES.REPLACE_ALL) {
                await this.updateProduct(existingId, parsed, categoryId, unitId, supplierId);
                summary.updated += 1;
              } else {
                summary.skipped += 1;
              }
            } else {
              const newId = await this.insertProduct(parsed, categoryId, unitId, supplierId);
              summary.imported += 1;
              if (parsed.sku) skuIndex.set(parsed.sku.toLowerCase(), newId);
              if (parsed.barcode) barcodeIndex.set(parsed.barcode.toLowerCase(), newId);
            }
          } catch (err) {
            summary.failed += 1;
            summary.errors.push({
              rowNumber: row.rowNumber,
              data: row.data,
              raw: row.raw,
              messages: [err.message || "Import failed"],
            });
          }

          processed += 1;
        }

        await this.commitBatch();
      } catch (batchErr) {
        await this.rollbackBatch();
        for (const row of batch) {
          summary.failed += 1;
          summary.errors.push({
            rowNumber: row.rowNumber,
            data: row.data,
            raw: row.raw,
            messages: [batchErr.message || "Batch transaction failed"],
          });
        }
      }

      report("importing");
      await this.yieldToUi();
    }

    const invalidRows = validatedRows.filter((r) => !r.valid);
    summary.failed += invalidRows.length;
    for (const row of invalidRows) {
      summary.errors.push({
        rowNumber: row.rowNumber,
        data: row.data,
        raw: row.raw,
        messages: row.errors || ["Validation failed"],
      });
    }

    await this.logOperation({
      operation: "import",
      fileName,
      mode,
      totalRows: summary.totalRows,
      imported: summary.imported,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed,
      details: {
        cancelled: summary.cancelled,
        errorCount: summary.errors.length,
      },
    });

    report("done");
    invalidateDashboardCache();
    return summary;
  }

  async getAllForExport() {
    return query(
      `SELECT p.name, p.name_ar, p.sku, p.barcode, c.name AS category,
              u.symbol AS unit, s.company AS supplier,
              p.cost_price, p.selling_price, p.quantity, p.min_stock, p.published
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ORDER BY p.name ASC`
    );
  }

  productToExportRow(p) {
    return [
      p.name || "",
      p.name_ar || "",
      p.sku || "",
      p.barcode || "",
      p.category || "",
      p.unit || "",
      p.supplier || "",
      Number(p.cost_price ?? 0).toFixed(2),
      Number(p.selling_price ?? 0).toFixed(2),
      String(p.quantity ?? 0),
      String(p.min_stock ?? 0),
      Number(p.published ?? 1) === 1 ? "yes" : "no",
    ];
  }

  async exportCsv() {
    const products = await this.getAllForExport();
    const rows = products.map((p) => this.productToExportRow(p));
    const csv = rowsToCsv(EXPORT_HEADERS, rows);

    await this.logOperation({
      operation: "export",
      fileName: "products.csv",
      totalRows: products.length,
      details: { format: "csv" },
    });

    return { content: csv, filename: `products-export-${this.timestamp()}.csv`, count: products.length };
  }

  async exportExcel() {
    const products = await this.getAllForExport();
    const rows = products.map((p) => this.productToExportRow(p));
    const workbook = buildExcelWorkbook(EXPORT_HEADERS, rows);
    const buffer = workbookToArrayBuffer(workbook);

    await this.logOperation({
      operation: "export",
      fileName: "products.xlsx",
      totalRows: products.length,
      details: { format: "xlsx" },
    });

    return {
      buffer,
      filename: `products-export-${this.timestamp()}.xlsx`,
      count: products.length,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  templateCsv() {
    return {
      content: rowsToCsv(templateHeaders(), templateSampleRows()),
      filename: "product-import-template.csv",
    };
  }

  templateExcel() {
    const workbook = buildTemplateWorkbook();
    return {
      buffer: workbookToArrayBuffer(workbook),
      filename: "product-import-template.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
}

export const productImportService = new ProductImportService();
