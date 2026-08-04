import { insert, query, queryOne, execute } from "../../database/connection";
import {
  ZATCA_QUEUE_STATUS,
  ZATCA_SETTING_KEYS,
  ZATCA_PHASES,
  ZATCA_MAX_RETRY_COUNT,
} from "../core/constants";
import { settingsService } from "../../services/SettingsService";
import { computeNextRetryAt } from "../sync/retryBackoff";

function normalizeStatus(status) {
  if (!status) return ZATCA_QUEUE_STATUS.PENDING;
  if (status === "error") return ZATCA_QUEUE_STATUS.FAILED;
  if (status === "accepted_placeholder") return ZATCA_QUEUE_STATUS.SYNCED;
  if (status === "pending_credentials") return ZATCA_QUEUE_STATUS.PENDING;
  if (Object.values(ZATCA_QUEUE_STATUS).includes(status)) return status;
  return ZATCA_QUEUE_STATUS.FAILED;
}

function mapRow(row) {
  if (!row) return row;
  return {
    ...row,
    status: normalizeStatus(row.status),
    retry_count: Number(row.retry_count || 0),
  };
}

class ZatcaInvoiceRepository {
  async enqueuePending({
    saleId,
    saleNumber,
    phase,
    environment,
    invoiceUuid,
    invoiceHash,
    payload,
  }) {
    const id = await insert(
      `INSERT INTO zatca_invoices (
         sale_id, sale_number, phase, environment, status,
         invoice_uuid, invoice_hash, payload_json, retry_count
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
      [
        saleId,
        saleNumber,
        phase,
        environment,
        ZATCA_QUEUE_STATUS.PENDING,
        invoiceUuid,
        invoiceHash,
        JSON.stringify(payload || {}),
      ]
    );
    return id;
  }

  async hasActiveQueueEntry(saleId) {
    const row = await queryOne(
      `SELECT id FROM zatca_invoices
       WHERE sale_id = $1
         AND status IN ($2, $3, $4)
       LIMIT 1`,
      [
        saleId,
        ZATCA_QUEUE_STATUS.PENDING,
        ZATCA_QUEUE_STATUS.SENDING,
        ZATCA_QUEUE_STATUS.SYNCED,
      ]
    );
    return Boolean(row);
  }

  async markSending(id) {
    await execute(
      `UPDATE zatca_invoices
       SET status = $1, last_attempt_at = datetime('now'), updated_at = datetime('now')
       WHERE id = $2`,
      [ZATCA_QUEUE_STATUS.SENDING, id]
    );
  }

  async markSynced(id, { invoiceHash, invoiceUuid, signedXml, qrTlv, response }) {
    await execute(
      `UPDATE zatca_invoices
       SET status = $1,
           invoice_hash = COALESCE($2, invoice_hash),
           invoice_uuid = COALESCE($3, invoice_uuid),
           signed_xml = COALESCE($4, signed_xml),
           qr_tlv = COALESCE($5, qr_tlv),
           response_json = $6,
           synced_at = datetime('now'),
           next_retry_at = NULL,
           error_message = NULL,
           updated_at = datetime('now')
       WHERE id = $7`,
      [
        ZATCA_QUEUE_STATUS.SYNCED,
        invoiceHash || null,
        invoiceUuid || null,
        signedXml || null,
        qrTlv || null,
        JSON.stringify(response || {}),
        id,
      ]
    );

    if (invoiceHash) {
      const counter = await settingsService.get(ZATCA_SETTING_KEYS.INVOICE_COUNTER, "0");
      await settingsService.set(
        ZATCA_SETTING_KEYS.INVOICE_COUNTER,
        String(Number(counter) + 1)
      );
      await settingsService.set(ZATCA_SETTING_KEYS.PREVIOUS_INVOICE_HASH, invoiceHash);
    }
  }

  async markFailed(id, errorMessage, response) {
    const row = await queryOne(`SELECT retry_count FROM zatca_invoices WHERE id = $1`, [id]);
    const nextRetry = computeNextRetryAt(Number(row?.retry_count || 0) + 1);

    await execute(
      `UPDATE zatca_invoices
       SET status = $1,
           retry_count = retry_count + 1,
           error_message = $2,
           response_json = $3,
           next_retry_at = $4,
           updated_at = datetime('now')
       WHERE id = $5`,
      [
        ZATCA_QUEUE_STATUS.FAILED,
        errorMessage || "Unknown error",
        JSON.stringify(response || {}),
        nextRetry,
        id,
      ]
    );
  }

  async prepareForManualSync(id) {
    await execute(
      `UPDATE zatca_invoices
       SET status = $1,
           next_retry_at = NULL,
           error_message = NULL,
           retry_count = 0,
           updated_at = datetime('now')
       WHERE id = $2`,
      [ZATCA_QUEUE_STATUS.PENDING, id]
    );
  }

  async resetFailedToPending(ids = []) {
    if (!ids.length) {
      await execute(
        `UPDATE zatca_invoices
         SET status = $1, error_message = NULL, retry_count = 0, next_retry_at = NULL, updated_at = datetime('now')
         WHERE status = $2 AND phase = $3`,
        [ZATCA_QUEUE_STATUS.PENDING, ZATCA_QUEUE_STATUS.FAILED, ZATCA_PHASES.PHASE2]
      );
      return;
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
    await execute(
      `UPDATE zatca_invoices
       SET status = $1, error_message = NULL, retry_count = 0, next_retry_at = NULL, updated_at = datetime('now')
       WHERE status = $2 AND id IN (${placeholders})`,
      [ZATCA_QUEUE_STATUS.PENDING, ZATCA_QUEUE_STATUS.FAILED, ...ids]
    );
  }

  async getQueueItems({ status = null, limit = 200 } = {}) {
    let sql = `
      SELECT zi.*,
             c.name AS customer_name,
             s.created_at AS sale_date,
             s.total AS sale_total
      FROM zatca_invoices zi
      JOIN sales s ON s.id = zi.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE zi.phase = $1
    `;
    const params = [ZATCA_PHASES.PHASE2];

    if (status) {
      params.push(status);
      sql += ` AND zi.status = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY zi.created_at DESC LIMIT $${params.length}`;

    const rows = await query(sql, params);
    return rows.map(mapRow);
  }

  async getById(id) {
    const row = await queryOne(
      `SELECT zi.*,
              c.name AS customer_name,
              s.created_at AS sale_date,
              s.total AS sale_total
       FROM zatca_invoices zi
       JOIN sales s ON s.id = zi.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE zi.id = $1`,
      [id]
    );
    return mapRow(row);
  }

  async getPendingForSync(limit = 100) {
    const rows = await query(
      `SELECT * FROM zatca_invoices
       WHERE phase = $1
         AND status IN ($2, $3, $4)
         AND (
           status != $5
           OR retry_count < $6
         )
         AND (
           next_retry_at IS NULL
           OR next_retry_at <= datetime('now')
         )
       ORDER BY created_at ASC
       LIMIT $7`,
      [
        ZATCA_PHASES.PHASE2,
        ZATCA_QUEUE_STATUS.PENDING,
        ZATCA_QUEUE_STATUS.FAILED,
        ZATCA_QUEUE_STATUS.SENDING,
        ZATCA_QUEUE_STATUS.FAILED,
        ZATCA_MAX_RETRY_COUNT,
        limit,
      ]
    );
    return rows.map(mapRow);
  }

  async getQueueStats() {
    const row = await queryOne(
      `SELECT
         SUM(CASE WHEN status IN ('pending', 'sending') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'synced' OR status = 'accepted_placeholder' THEN 1 ELSE 0 END) AS synced,
         SUM(CASE WHEN status = 'failed' OR status = 'error' THEN 1 ELSE 0 END) AS failed,
         COUNT(*) AS total
       FROM zatca_invoices
       WHERE phase = $1`,
      [ZATCA_PHASES.PHASE2]
    );

    return {
      pending: Number(row?.pending ?? 0),
      synced: Number(row?.synced ?? 0),
      failed: Number(row?.failed ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  async clearCompleted() {
    const before = await this.getQueueStats();
    await execute(
      `DELETE FROM zatca_invoices WHERE status IN ($1, $2)`,
      [ZATCA_QUEUE_STATUS.SYNCED, "accepted_placeholder"]
    );
    const after = await this.getQueueStats();
    return Math.max(0, before.total - after.total);
  }

  async recoverStuckSending() {
    await execute(
      `UPDATE zatca_invoices
       SET status = $1, updated_at = datetime('now')
       WHERE status = $2`,
      [ZATCA_QUEUE_STATUS.PENDING, ZATCA_QUEUE_STATUS.SENDING]
    );
  }

  async getRecent(limit = 20) {
    const rows = await query(
      `SELECT * FROM zatca_invoices ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map(mapRow);
  }

  async getBySaleId(saleId) {
    const rows = await query(
      `SELECT * FROM zatca_invoices WHERE sale_id = $1 ORDER BY created_at DESC`,
      [saleId]
    );
    return rows.map(mapRow);
  }

  async getSignedXmlForSale(saleId) {
    const row = await queryOne(
      `SELECT zi.signed_xml, zi.status, zi.environment, s.sale_number
       FROM zatca_invoices zi
       JOIN sales s ON s.id = zi.sale_id
       WHERE zi.sale_id = $1
       ORDER BY zi.created_at DESC
       LIMIT 1`,
      [saleId]
    );
    if (!row) return null;
    return {
      ...mapRow(row),
      sale_number: row.sale_number,
      signed_xml: row.signed_xml?.trim() || "",
    };
  }

  async getStatusBySaleIds(saleIds = []) {
    if (!saleIds.length) return {};

    const placeholders = saleIds.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await query(
      `SELECT sale_id, status, error_message, synced_at, environment, next_retry_at, last_attempt_at,
              CASE WHEN signed_xml IS NOT NULL AND length(trim(signed_xml)) > 0 THEN 1 ELSE 0 END AS has_signed_xml
       FROM zatca_invoices
       WHERE sale_id IN (${placeholders})
       ORDER BY created_at DESC`,
      saleIds
    );

    const map = {};
    for (const row of rows) {
      if (!map[row.sale_id]) {
        map[row.sale_id] = mapRow(row);
      }
    }
    return map;
  }

  async getDailySyncItems(businessDate = null) {
    let sql = `
      SELECT zi.*,
             s.id AS sale_id,
             s.sale_number,
             s.total AS sale_total,
             s.created_at AS sale_date,
             s.status AS sale_status,
             s.payment_method,
             c.name AS customer_name,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
      FROM zatca_invoices zi
      JOIN sales s ON s.id = zi.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE zi.phase = $1
    `;
    const params = [ZATCA_PHASES.PHASE2];

    if (businessDate) {
      params.push(businessDate);
      sql += ` AND date(s.created_at) = date($${params.length})`;
    } else {
      sql += ` AND date(s.created_at) = date('now')`;
    }

    sql += ` ORDER BY s.created_at DESC`;
    const rows = await query(sql, params);
    return rows.map(mapRow);
  }

  async getLineItemsBySaleIds(saleIds = []) {
    if (!saleIds.length) return {};

    const placeholders = saleIds.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await query(
      `SELECT si.sale_id, si.quantity, si.unit_price, si.total,
              p.name AS product_name, p.name_ar AS name_ar
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.product_id
       WHERE si.sale_id IN (${placeholders})
       ORDER BY si.id ASC`,
      saleIds
    );

    const map = {};
    for (const row of rows) {
      if (!map[row.sale_id]) map[row.sale_id] = [];
      map[row.sale_id].push(row);
    }
    return map;
  }

  async getDailySyncStats(businessDate = null) {
    const items = await this.getDailySyncItems(businessDate);
    let pending = 0;
    let synced = 0;
    let failed = 0;
    let sending = 0;

    for (const item of items) {
      if (item.status === ZATCA_QUEUE_STATUS.SYNCED) synced += 1;
      else if (item.status === ZATCA_QUEUE_STATUS.FAILED) failed += 1;
      else if (item.status === ZATCA_QUEUE_STATUS.SENDING) sending += 1;
      else pending += 1;
    }

    return {
      total: items.length,
      pending,
      synced,
      failed,
      sending,
      needsAction: pending + failed + sending,
    };
  }

  async getOutstandingSyncItems() {
    const rows = await query(
      `SELECT zi.*,
              s.id AS sale_id,
              s.sale_number,
              s.total AS sale_total,
              s.created_at AS sale_date,
              s.status AS sale_status,
              s.payment_method,
              c.name AS customer_name,
              (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
       FROM zatca_invoices zi
       JOIN sales s ON s.id = zi.sale_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE zi.phase = $1
         AND zi.status IN ($2, $3, $4)
       ORDER BY s.created_at ASC`,
      [
        ZATCA_PHASES.PHASE2,
        ZATCA_QUEUE_STATUS.PENDING,
        ZATCA_QUEUE_STATUS.FAILED,
        ZATCA_QUEUE_STATUS.SENDING,
      ]
    );
    return rows.map(mapRow);
  }

  async getSyncPageDashboard(businessDate = null) {
    const [todayItems, outstandingItems, todayStats, globalStats, allItems] =
      await Promise.all([
        this.getDailySyncItems(businessDate),
        this.getOutstandingSyncItems(),
        this.getDailySyncStats(businessDate),
        this.getQueueStats(),
        this.getQueueItems({ limit: 500 }),
      ]);

    const saleIds = [
      ...new Set(
        [...todayItems, ...outstandingItems, ...allItems].map((item) => item.sale_id)
      ),
    ];
    const lineItemsBySaleId = await this.getLineItemsBySaleIds(saleIds);

    return {
      businessDate,
      global: {
        ...globalStats,
        needsAction:
          globalStats.pending + globalStats.failed,
      },
      today: { items: todayItems, stats: todayStats },
      outstanding: {
        items: outstandingItems,
        count: outstandingItems.length,
      },
      allItems,
      lineItemsBySaleId,
    };
  }

  async getDailySyncDashboard(businessDate = null) {
    const items = await this.getDailySyncItems(businessDate);
    const saleIds = items.map((item) => item.sale_id);
    const lineItemsBySaleId = await this.getLineItemsBySaleIds(saleIds);
    const stats = await this.getDailySyncStats(businessDate);
    return { items, lineItemsBySaleId, stats, businessDate };
  }

  /** @deprecated Use enqueuePending + sync service instead. */
  async recordSubmission({
    saleId,
    saleNumber,
    phase,
    environment,
    status,
    invoiceUuid,
    invoiceHash,
    response,
  }) {
    await insert(
      `INSERT INTO zatca_invoices (
         sale_id, sale_number, phase, environment, status,
         invoice_uuid, invoice_hash, response_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        saleId,
        saleNumber,
        phase,
        environment,
        normalizeStatus(status),
        invoiceUuid,
        invoiceHash,
        JSON.stringify(response || {}),
      ]
    );
  }
}

export const zatcaInvoiceRepository = new ZatcaInvoiceRepository();
