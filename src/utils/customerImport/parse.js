import { parseCsvText, rowsToCsv } from "../productImport/csv.js";
import * as XLSX from "xlsx";
import { email as validateEmail } from "../validation.js";
import { mapHeaders, rowToCustomer, templateHeaders, templateSampleRows } from "./columns.js";

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];
export const ACCEPTED_MIME =
  "text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const CUSTOMER_IMPORT_MODES = {
  NEW_ONLY: "new_only",
  UPDATE: "update",
};

export const CUSTOMER_IMPORT_MODE_LABELS = {
  [CUSTOMER_IMPORT_MODES.NEW_ONLY]: "Add new customers only (skip exact matches already in the list)",
  [CUSTOMER_IMPORT_MODES.UPDATE]: "Add new customers and update exact matches (same name, phone, and address)",
};

export function customerLookupKey(name, phone = "", address = "") {
  const normalizedName = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const digits = String(phone || "").replace(/\D/g, "");
  const normalizedAddress = String(address || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `${normalizedName}|${digits}|${normalizedAddress}`;
}

export function isWalkInCustomerName(name) {
  return /^walk[\s-]*in/i.test(String(name || "").trim());
}

export function getFileExtension(name) {
  const idx = String(name || "").lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export function isAcceptedCustomerImportFile(file) {
  return ACCEPTED_EXTENSIONS.includes(getFileExtension(file?.name));
}

function parseExcelArrayBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "array", codepage: 65001 });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === "customers") ||
    workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

export async function readCustomerImportFile(file) {
  const ext = getFileExtension(file.name);
  if (ext === ".csv") return parseCsvText(await file.text());
  if (ext === ".xlsx") return parseExcelArrayBuffer(await file.arrayBuffer());
  throw new Error("Unsupported file format. Use CSV (.csv) or Excel (.xlsx).");
}

export function sheetToCustomers(rawRows) {
  if (!rawRows?.length) {
    return { headers: [], rows: [], headerMap: {}, error: "File is empty." };
  }

  const headers = rawRows[0].map((header) => String(header ?? "").trim());
  const headerMap = mapHeaders(headers);

  if (headerMap.name == null) {
    return {
      headers,
      rows: [],
      headerMap,
      error: 'Missing required column "name". Download the template for correct headers.',
    };
  }

  const rows = rawRows.slice(1).map((raw, index) => ({
    rowNumber: index + 2,
    raw,
    data: rowToCustomer(raw, headerMap),
  }));

  return { headers, rows, headerMap, error: null };
}

export function validateCustomerImportRows(rows = []) {
  const seenInFile = new Set();
  const validated = [];
  const errors = [];

  for (const row of rows) {
    const messages = [];
    const name = String(row.data.name || "").trim();
    const phone = String(row.data.phone || "").trim();
    const emailValue = String(row.data.email || "").trim();
    const address = String(row.data.address || "").trim();
    const notes = String(row.data.notes || "").trim();

    if (!name) messages.push("Name is required");
    if (isWalkInCustomerName(name)) {
      messages.push("Walk-in customer is built into POS — skip this row");
    }
    const emailError = validateEmail(emailValue);
    if (emailError) messages.push(emailError);

    const fileKey = customerLookupKey(name, phone, address);
    if (name && seenInFile.has(fileKey)) {
      messages.push("Duplicate name + phone in this file");
    } else if (name) {
      seenInFile.add(fileKey);
    }

    const parsed = {
      name,
      phone: phone || null,
      email: emailValue || null,
      address: address || null,
      notes: notes || null,
    };

    const valid = messages.length === 0;
    if (!valid) {
      errors.push({ rowNumber: row.rowNumber, data: row.data, messages });
    }
    validated.push({ ...row, parsed, valid, messages });
  }

  return { validated, errors };
}

export function buildCustomerTemplateCsv() {
  return rowsToCsv(templateHeaders(), templateSampleRows());
}

export function buildCustomerExcelWorkbook() {
  const headers = templateHeaders();
  const data = [headers, ...templateSampleRows()];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Nexttel POS customer import"],
      ["Required column: name"],
      ["Optional columns: phone, email, address, notes"],
      ["Import via Customers → Import"],
    ]),
    "Instructions"
  );
  return workbook;
}

export function previewRows(rows, limit = 6) {
  return rows.slice(0, limit);
}
