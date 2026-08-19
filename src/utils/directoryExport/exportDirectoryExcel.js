import * as XLSX from "xlsx";
import { companyMetaLines } from "./companyProfile.js";
import { mapRowsForExport, buildSummary } from "./formatRows.js";

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function spacerRow(colCount) {
  return Array.from({ length: colCount }, () => "");
}

export function exportDirectoryExcel({ definition, rows, company, currency }) {
  const headers = definition.columns.map((column) => column.label);
  const body = mapRowsForExport(rows, definition, currency);
  const summary = buildSummary(definition.id, rows, currency, definition);
  const metaLines = companyMetaLines(company);
  const colCount = Math.max(headers.length, 4);

  const sheetRows = [
    [company.name, ...spacerRow(colCount - 1).slice(1)],
    ...(company.nameAr ? [[company.nameAr, ...spacerRow(colCount - 1).slice(1)]] : []),
    ...(metaLines[0] ? [[metaLines[0], ...spacerRow(colCount - 1).slice(1)]] : []),
    ...(metaLines[1] ? [[metaLines[1], ...spacerRow(colCount - 1).slice(1)]] : []),
    spacerRow(colCount),
    [definition.title, ...spacerRow(colCount - 1).slice(1)],
    [definition.subtitle, ...spacerRow(colCount - 1).slice(1)],
    [`Generated: ${company.generatedAt}`, `Total records: ${summary.totalRecords}`, ...spacerRow(colCount - 2)],
    spacerRow(colCount),
    headers,
    ...body,
    spacerRow(colCount),
    ["Summary", ...spacerRow(colCount - 1).slice(1)],
    ...summary.lines.map((line) => [line, ...spacerRow(colCount - 1).slice(1)]),
    spacerRow(colCount),
    ["Prepared for sharing · Nexttel POS", ...spacerRow(colCount - 1).slice(1)],
  ];

  const titleRowIndex = sheetRows.findIndex((row) => row[0] === definition.title);

  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  sheet["!cols"] = definition.columns.map((column) => ({ wch: column.width || 18 }));
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    ...(company.nameAr ? [{ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }] : []),
    ...(titleRowIndex >= 0
      ? [
          { s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: colCount - 1 } },
          { s: { r: titleRowIndex + 1, c: 0 }, e: { r: titleRowIndex + 1, c: colCount - 1 } },
        ]
      : []),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, definition.sheetName);

  const coverRows = [
    ["Company Report", ""],
    ["Company", company.name],
    ...(company.nameAr ? [["Company (Arabic)", company.nameAr]] : []),
    ...(company.address ? [["Address", company.address]] : []),
    ...(company.crNumber ? [["CR Number", company.crNumber]] : []),
    ...(company.vatNumber ? [["VAT Number", company.vatNumber]] : []),
    ["Report", definition.title],
    ["Date", company.generatedAt],
    ["Records", String(summary.totalRecords)],
    ["", ""],
    ["Notes", "Formatted for WhatsApp, email, or printing."],
  ];

  const coverSheet = XLSX.utils.aoa_to_sheet(coverRows);
  coverSheet["!cols"] = [{ wch: 22 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(workbook, coverSheet, "Cover");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const filename = `${definition.filePrefix}-${timestampSlug()}.xlsx`;

  return {
    buffer,
    filename,
    count: rows.length,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
