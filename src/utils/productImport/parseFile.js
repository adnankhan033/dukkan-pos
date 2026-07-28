import { parseCsvText } from "./csv.js";
import { parseExcelArrayBuffer } from "./excel.js";
import { mapHeaders, rowToProduct } from "./columns.js";

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];
export const ACCEPTED_MIME =
  "text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function getFileExtension(name) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export function isAcceptedImportFile(file) {
  const ext = getFileExtension(file.name);
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export async function readImportFile(file) {
  const ext = getFileExtension(file.name);

  if (ext === ".csv") {
    const text = await file.text();
    return parseCsvText(text);
  }

  if (ext === ".xlsx") {
    const buffer = await file.arrayBuffer();
    return parseExcelArrayBuffer(buffer);
  }

  throw new Error("Unsupported file format. Use CSV (.csv) or Excel (.xlsx).");
}

export function sheetToProducts(rawRows) {
  if (!rawRows?.length) {
    return { headers: [], rows: [], headerMap: {}, error: "File is empty." };
  }

  const headers = rawRows[0].map((h) => String(h ?? "").trim());
  const headerMap = mapHeaders(headers);

  if (headerMap.name == null) {
    return {
      headers,
      rows: [],
      headerMap,
      error: 'Missing required column "name". Download the template for correct headers.',
    };
  }

  if (headerMap.selling_price == null) {
    return {
      headers,
      rows: [],
      headerMap,
      error: 'Missing required column "selling_price". Download the template for correct headers.',
    };
  }

  const rows = rawRows.slice(1).map((raw, index) => ({
    rowNumber: index + 2,
    raw,
    data: rowToProduct(raw, headerMap),
  }));

  return { headers, rows, headerMap, error: null };
}

export function previewRows(rows, limit = 5) {
  return rows.slice(0, limit);
}
