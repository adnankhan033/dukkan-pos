import { query, queryOne, execute, insert } from "../database/connection";
import { invalidateDashboardCache } from "./DashboardCache";
import { invalidateProductCaches, syncCatalogRevision } from "./CatalogSync";
import { apiClient } from "../api/ApiClient";
import { isDrupalMode, normalizeProduct } from "../api/drupalMode";
import { useAuthStore } from "../contexts/store";

const LIST_COLUMNS = `
  p.id, p.name, p.name_ar, p.sku, p.barcode, p.category_id, p.unit_id, p.supplier_id,
  p.cost_price, p.selling_price, p.quantity, p.min_stock, p.published, p.created_by,
  p.created_at, p.updated_at,
  CASE WHEN p.image IS NOT NULL AND p.image != '' THEN 1 ELSE 0 END AS has_image,
  c.name AS category_name,
  u.name AS unit_name,
  u.symbol AS unit_symbol,
  s.company AS supplier_name
`;

const BASE_JOINS = `
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN units u ON p.unit_id = u.id
`;

const SUPPLIER_JOIN = `LEFT JOIN suppliers s ON p.supplier_id = s.id`;

const PRODUCT_JOINS = `${BASE_JOINS} ${SUPPLIER_JOIN}`;

class ProductService {
  async getAll({
    search = "",
    categoryId = null,
    published = null,
    page = 1,
    limit = 10,
  } = {}) {
    if (await isDrupalMode()) {
      const result = await apiClient.getProducts({
        search,
        category_id: categoryId,
        published,
        page,
        limit,
      });
      return {
        items: (result.items || []).map(normalizeProduct),
        total: result.total ?? 0,
        page: result.page ?? page,
        limit: result.limit ?? limit,
      };
    }

    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name LIKE $${params.length} OR p.name_ar LIKE $${params.length} OR p.sku LIKE $${params.length} OR p.barcode LIKE $${params.length})`;
    }

    if (categoryId) {
      params.push(categoryId);
      where += ` AND p.category_id = $${params.length}`;
    }

    if (published !== null && published !== undefined) {
      params.push(published ? 1 : 0);
      where += ` AND COALESCE(p.published, 1) = $${params.length}`;
    }

    const countParams = [...params];
    const [countRow, items] = await Promise.all([
      queryOne(`SELECT COUNT(*) AS total FROM products p ${where}`, countParams),
      query(
        `SELECT ${LIST_COLUMNS}
         FROM products p
         ${PRODUCT_JOINS}
         ${where}
         ORDER BY p.name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, (page - 1) * limit]
      ),
    ]);

    return { items, total: countRow?.total ?? 0, page, limit };
  }

  async getPosCatalog(limit = 500) {
    if (await isDrupalMode()) {
      const result = await apiClient.getProductCatalog(limit);
      return (result.items || result || []).map(normalizeProduct);
    }

    return query(
      `SELECT p.id, p.name, p.name_ar, p.sku, p.barcode, p.selling_price, p.cost_price, p.quantity, p.category_id,
              c.name AS category_name, u.symbol AS unit_symbol
       FROM products p
       ${BASE_JOINS}
       WHERE COALESCE(p.published, 1) = 1
       ORDER BY p.name ASC
       LIMIT $1`,
      [limit]
    );
  }

  /** Top-selling published products for POS quick-pick grid (all-time completed sales). */
  async getTopSellingForPos(limit = 10) {
    if (await isDrupalMode()) {
      const catalog = await this.getPosCatalog(limit);
      return catalog.slice(0, limit).map((p) => ({ ...p, units_sold: 0 }));
    }

    const top = await query(
      `SELECT p.id, p.name, p.name_ar, p.sku, p.barcode, p.selling_price, p.cost_price, p.quantity, p.category_id,
              c.name AS category_name, u.symbol AS unit_symbol,
              COALESCE(SUM(si.quantity), 0) AS units_sold
       FROM products p
       ${BASE_JOINS}
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON s.id = si.sale_id AND s.status IN ('completed', 'partial_return', 'returned')
       WHERE COALESCE(p.published, 1) = 1
       GROUP BY p.id
       ORDER BY units_sold DESC, p.name ASC
       LIMIT $1`,
      [limit]
    );

    if (top.length >= limit) return top;

    const existingIds = new Set(top.map((row) => row.id));
    const filler = await query(
      `SELECT p.id, p.name, p.name_ar, p.sku, p.barcode, p.selling_price, p.cost_price, p.quantity, p.category_id,
              c.name AS category_name, u.symbol AS unit_symbol, 0 AS units_sold
       FROM products p
       ${BASE_JOINS}
       WHERE COALESCE(p.published, 1) = 1
       ORDER BY p.name ASC
       LIMIT $1`,
      [limit * 3]
    );

    for (const product of filler) {
      if (top.length >= limit) break;
      if (!existingIds.has(product.id)) {
        top.push(product);
        existingIds.add(product.id);
      }
    }

    return top.slice(0, limit);
  }

  async getById(id) {
    if (await isDrupalMode()) {
      const row = await apiClient.getProduct(Number(id));
      return normalizeProduct(row);
    }

    return queryOne(
      `SELECT p.*, c.name as category_name, u.symbol AS unit_symbol, s.company AS supplier_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1`,
      [Number(id)]
    );
  }

  async getByBarcode(barcode) {
    if (await isDrupalMode()) {
      const result = await apiClient.getProducts({ search: barcode, limit: 5 });
      const match = (result.items || []).find((p) => p.barcode === barcode);
      return match ? normalizeProduct(match) : null;
    }

    return queryOne(
      "SELECT * FROM products WHERE barcode = $1 AND COALESCE(published, 1) = 1",
      [barcode]
    );
  }

  async findByBarcode(barcode) {
    if (await isDrupalMode()) {
      return this.getByBarcode(barcode);
    }

    return queryOne(
      `SELECT ${LIST_COLUMNS}
       FROM products p
       ${PRODUCT_JOINS}
       WHERE p.barcode = $1`,
      [barcode]
    );
  }

  async resolveUnitId(unitId) {
    if (unitId == null || unitId === "") return null;
    return Number(unitId);
  }

  async resolveSupplierId(supplierId) {
    if (supplierId == null || supplierId === "") return null;
    return Number(supplierId);
  }

  async create(data) {
    if (await isDrupalMode()) {
      const product = await apiClient.createProduct({
        name: data.name,
        name_ar: data.name_ar || null,
        sku: data.sku || null,
        barcode: data.barcode || null,
        category_id: data.category_id || null,
        unit_id: data.unit_id || null,
        cost_price: Number(data.cost_price) || 0,
        selling_price: Number(data.selling_price) || 0,
        quantity: Number(data.quantity) || 0,
        min_stock: Number(data.min_stock) || 0,
        published: data.published === false || data.published === 0 ? 0 : 1,
      });
      invalidateProductCaches();
      syncCatalogRevision().catch(() => {});
      return normalizeProduct(product);
    }

    const published = data.published === false || data.published === 0 ? 0 : 1;
    const unitId = await this.resolveUnitId(data.unit_id);
    const supplierId = await this.resolveSupplierId(data.supplier_id);
    const createdBy = useAuthStore.getState().user?.id ?? null;
    const id = await insert(
      `INSERT INTO products (name, name_ar, sku, barcode, category_id, unit_id, supplier_id, cost_price, selling_price, quantity, min_stock, image, published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        data.name,
        data.name_ar || null,
        data.sku || null,
        data.barcode || null,
        data.category_id || null,
        unitId,
        supplierId,
        Number(data.cost_price) || 0,
        Number(data.selling_price) || 0,
        Number(data.quantity) || 0,
        Number(data.min_stock) || 0,
        data.image || null,
        published,
        createdBy,
      ]
    );
    if (Number(data.quantity) > 0) {
      await execute(
        `INSERT INTO inventory (product_id, quantity_change, quantity_after, reason, reference_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, Number(data.quantity), Number(data.quantity), "Initial stock", "adjustment"]
      );
    }
    invalidateDashboardCache();
    return { id, ...data, published, has_image: data.image ? 1 : 0 };
  }

  async update(id, data) {
    if (await isDrupalMode()) {
      const product = await apiClient.updateProduct(Number(id), {
        name: data.name,
        name_ar: data.name_ar || null,
        sku: data.sku || null,
        barcode: data.barcode || null,
        category_id: data.category_id || null,
        unit_id: data.unit_id || null,
        cost_price: Number(data.cost_price) || 0,
        selling_price: Number(data.selling_price) || 0,
        quantity: Number(data.quantity) || 0,
        min_stock: Number(data.min_stock) || 0,
        published: data.published === false || data.published === 0 ? 0 : 1,
      });
      invalidateProductCaches();
      syncCatalogRevision().catch(() => {});
      return normalizeProduct(product);
    }

    const published = data.published === false || data.published === 0 ? 0 : 1;
    const numId = Number(id);
    const unitId = await this.resolveUnitId(data.unit_id);
    const supplierId = await this.resolveSupplierId(data.supplier_id);

    if (data.image !== undefined) {
      await execute(
        `UPDATE products SET
          name = $1, name_ar = $2, sku = $3, barcode = $4, category_id = $5, unit_id = $6, supplier_id = $7,
          cost_price = $8, selling_price = $9, quantity = $10, min_stock = $11,
          published = $12, image = $13, updated_at = datetime('now')
         WHERE id = $14`,
        [
          data.name,
          data.name_ar || null,
          data.sku || null,
          data.barcode || null,
          data.category_id || null,
          unitId,
          supplierId,
          Number(data.cost_price) || 0,
          Number(data.selling_price) || 0,
          Number(data.quantity) || 0,
          Number(data.min_stock) || 0,
          published,
          data.image || null,
          numId,
        ]
      );
    } else {
      await execute(
        `UPDATE products SET
          name = $1, name_ar = $2, sku = $3, barcode = $4, category_id = $5, unit_id = $6, supplier_id = $7,
          cost_price = $8, selling_price = $9, quantity = $10, min_stock = $11,
          published = $12, updated_at = datetime('now')
         WHERE id = $13`,
        [
          data.name,
          data.name_ar || null,
          data.sku || null,
          data.barcode || null,
          data.category_id || null,
          unitId,
          supplierId,
          Number(data.cost_price) || 0,
          Number(data.selling_price) || 0,
          Number(data.quantity) || 0,
          Number(data.min_stock) || 0,
          published,
          numId,
        ]
      );
    }
    invalidateDashboardCache();
    return { id: numId, ...data, published, has_image: data.image ? 1 : 0 };
  }

  /** Remove product and all dependent rows (inventory, line items). */
  async delete(id) {
    if (await isDrupalMode()) {
      await apiClient.deleteProduct(Number(id));
      invalidateProductCaches();
      syncCatalogRevision().catch(() => {});
      return true;
    }

    const numId = Number(id);
    const product = await queryOne("SELECT id, name FROM products WHERE id = $1", [numId]);
    if (!product) {
      throw new Error("Product not found");
    }

    await execute("DELETE FROM inventory WHERE product_id = $1", [numId]);
    await execute("DELETE FROM sale_items WHERE product_id = $1", [numId]);
    await execute("DELETE FROM purchase_items WHERE product_id = $1", [numId]);
    await execute("DELETE FROM products WHERE id = $1", [numId]);

    const stillExists = await queryOne("SELECT id FROM products WHERE id = $1", [numId]);
    if (stillExists) {
      throw new Error(`Failed to delete "${product.name}". Please restart the app and try again.`);
    }

    invalidateDashboardCache();
    return true;
  }

  async deleteMany(ids) {
    const deleted = [];
    const failed = [];

    for (const id of ids) {
      try {
        await this.delete(id);
        deleted.push(Number(id));
      } catch (err) {
        failed.push({ id: Number(id), message: err.message });
      }
    }

    return { deleted, failed };
  }

  async setPublishedMany(ids, published) {
    if (!ids.length) return { updated: 0 };

    if (await isDrupalMode()) {
      for (const id of ids) {
        await apiClient.updateProduct(Number(id), { published: published ? 1 : 0 });
      }
      invalidateProductCaches();
      syncCatalogRevision().catch(() => {});
      return { updated: ids.length };
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
    await execute(
      `UPDATE products SET published = $1, updated_at = datetime('now') WHERE id IN (${placeholders})`,
      [published ? 1 : 0, ...ids.map(Number)]
    );
    invalidateDashboardCache();
    return { updated: ids.length };
  }

  async count() {
    if (await isDrupalMode()) {
      const result = await apiClient.getProducts({ page: 1, limit: 1 });
      return Number(result.total ?? 0);
    }

    const row = await queryOne("SELECT COUNT(*) as total FROM products");
    return row?.total ?? 0;
  }

  async countLowStock() {
    if (await isDrupalMode()) {
      const summary = await apiClient.getInventorySummary(1);
      return Number(summary.low_stock_count ?? 0);
    }

    const row = await queryOne(
      `SELECT COUNT(*) AS total
       FROM products p
       WHERE p.quantity <= p.min_stock AND COALESCE(p.published, 1) = 1`
    );
    return Number(row?.total ?? 0);
  }

  async getLowStock({ limit } = {}) {
    if (await isDrupalMode()) {
      const summary = await apiClient.getInventorySummary(limit ?? 50);
      const items = (summary.low_stock_items || []).map(normalizeProduct);
      return limit != null ? items.slice(0, limit) : items;
    }

    let sql = `SELECT p.id, p.name, p.quantity, p.min_stock,
              c.name AS category_name, u.symbol AS unit_symbol
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE p.quantity <= p.min_stock AND COALESCE(p.published, 1) = 1
       ORDER BY p.quantity ASC`;

    if (limit != null) {
      return query(`${sql} LIMIT $1`, [limit]);
    }
    return query(sql);
  }

  async getLowStockSummary(limit = 8) {
    if (await isDrupalMode()) {
      const summary = await apiClient.getInventorySummary(limit);
      return {
        count: Number(summary.low_stock_count ?? 0),
        items: (summary.low_stock_items || []).map(normalizeProduct),
      };
    }

    const [countRow, items] = await Promise.all([
      queryOne(
        `SELECT COUNT(*) AS total
         FROM products p
         WHERE p.quantity <= p.min_stock AND COALESCE(p.published, 1) = 1`
      ),
      this.getLowStock({ limit }),
    ]);

    return {
      count: Number(countRow?.total ?? 0),
      items,
    };
  }

  async searchForPos(term) {
    if (await isDrupalMode()) {
      const result = await apiClient.getProducts({
        search: term,
        published: 1,
        limit: 20,
        page: 1,
      });
      return (result.items || []).map(normalizeProduct);
    }

    const like = `%${term}%`;
    return query(
      `SELECT p.*, c.name as category_name, u.symbol AS unit_symbol
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN units u ON p.unit_id = u.id
       WHERE COALESCE(p.published, 1) = 1
       AND (p.name LIKE $1 OR p.name_ar LIKE $1 OR p.sku LIKE $1 OR p.barcode LIKE $1)
       ORDER BY p.name ASC LIMIT 20`,
      [like]
    );
  }
}

export const productService = new ProductService();
