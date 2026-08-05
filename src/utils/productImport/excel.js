import * as XLSX from "xlsx";
import { templateHeaders, templateSampleRows, templateInstructionsRows } from "./columns.js";

export function parseExcelArrayBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "array", codepage: 65001 });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === "products") ||
    workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
}

export function buildExcelWorkbook(headers, rows, sheetName = "Products") {
  const data = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return workbook;
}

export function workbookToArrayBuffer(workbook) {
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

export function buildTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();

  const productsSheet = XLSX.utils.aoa_to_sheet([
    templateHeaders(),
    ...templateSampleRows(),
  ]);
  XLSX.utils.book_append_sheet(workbook, productsSheet, "Products");

  const instructionsSheet = XLSX.utils.aoa_to_sheet(templateInstructionsRows());
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return workbook;
}
