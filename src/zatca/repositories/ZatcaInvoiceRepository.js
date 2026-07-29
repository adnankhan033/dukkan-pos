import { insert, query } from "../../database/connection";
import { ZATCA_SETTING_KEYS } from "../core/constants";
import { settingsService } from "../../services/SettingsService";

class ZatcaInvoiceRepository {
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
        status,
        invoiceUuid,
        invoiceHash,
        JSON.stringify(response || {}),
      ]
    );

    const counter = await settingsService.get(ZATCA_SETTING_KEYS.INVOICE_COUNTER, "0");
    await settingsService.set(ZATCA_SETTING_KEYS.INVOICE_COUNTER, String(Number(counter) + 1));
    await settingsService.set(ZATCA_SETTING_KEYS.PREVIOUS_INVOICE_HASH, invoiceHash);
  }

  async getRecent(limit = 20) {
    return query(
      `SELECT * FROM zatca_invoices ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
  }

  async getBySaleId(saleId) {
    return query(
      `SELECT * FROM zatca_invoices WHERE sale_id = $1 ORDER BY created_at DESC`,
      [saleId]
    );
  }
}

export const zatcaInvoiceRepository = new ZatcaInvoiceRepository();
