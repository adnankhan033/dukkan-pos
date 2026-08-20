import { customerService } from "./CustomerService";
import { workbookToArrayBuffer } from "../utils/productImport/excel";
import {
  CUSTOMER_IMPORT_MODES,
  buildCustomerExcelWorkbook,
  buildCustomerTemplateCsv,
  customerLookupKey,
} from "../utils/customerImport/parse";

function matchesExisting(row, existing) {
  const incomingKey = customerLookupKey(row.name, row.phone, row.address);
  return existing.find(
    (customer) => customerLookupKey(customer.name, customer.phone, customer.address) === incomingKey
  );
}

class CustomerImportService {
  timestamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  getTemplateCsv() {
    return {
      content: buildCustomerTemplateCsv(),
      filename: "customer-import-template.csv",
    };
  }

  getTemplateExcel() {
    return {
      buffer: workbookToArrayBuffer(buildCustomerExcelWorkbook()),
      filename: "customer-import-template.xlsx",
    };
  }

  async runImport(validatedRows, { mode = CUSTOMER_IMPORT_MODES.NEW_ONLY, onProgress } = {}) {
    const summary = {
      totalRows: validatedRows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const validRows = validatedRows.filter((row) => row.valid);
    const existing = await customerService.getAllForExport();
    const total = validRows.length;

    for (let index = 0; index < validRows.length; index += 1) {
      const row = validRows[index];
      onProgress?.({
        phase: "importing",
        processed: index,
        total,
        percent: total ? Math.round((index / total) * 100) : 100,
        imported: summary.imported,
        updated: summary.updated,
        skipped: summary.skipped,
        failed: summary.failed,
      });

      try {
        const match = matchesExisting(row.parsed, existing);
        if (match) {
          if (mode === CUSTOMER_IMPORT_MODES.UPDATE) {
            await customerService.update(match.id, {
              name: row.parsed.name,
              phone: row.parsed.phone,
              email: row.parsed.email ?? match.email,
              address: row.parsed.address ?? match.address,
              notes: row.parsed.notes ?? match.notes,
            });
            Object.assign(match, row.parsed);
            summary.updated += 1;
          } else {
            summary.skipped += 1;
          }
          continue;
        }

        const created = await customerService.create(row.parsed);
        existing.push(created);
        summary.imported += 1;
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({
          rowNumber: row.rowNumber,
          data: row.data,
          messages: [err.message || "Import failed"],
        });
      }
    }

    onProgress?.({
      phase: "done",
      processed: total,
      total,
      percent: 100,
      imported: summary.imported,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed,
    });

    return summary;
  }
}

export const customerImportService = new CustomerImportService();
