import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildReportCompanyProfile,
  companyInitial,
  formatCompanyAddress,
} from "../directoryExport/companyProfile.js";
import { formatCellValue } from "../directoryExport/formatRows.js";
import { formatCurrency } from "../format.js";
import { buildCustomersReportCoverHtml } from "./buildCustomersReportCoverHtml.js";
import {
  addCoverPageToPdf,
  renderReportCoverToCanvas,
} from "../pdf/renderReportCoverToCanvas.js";

const TABLE_FONT = "helvetica";
const FOOTER_HEIGHT_MM = 10;
const PAGE_MARGIN = 12;

const C = {
  navy: [15, 23, 42],
  navyLight: [30, 41, 59],
  emerald: [5, 150, 105],
  emeraldLight: [236, 253, 245],
  muted: [100, 116, 139],
  border: [226, 232, 240],
  surface: [248, 250, 252],
  white: [255, 255, 255],
  danger: [220, 38, 38],
  dangerLight: [254, 242, 242],
  amber: [217, 119, 6],
  amberLight: [255, 251, 235],
};

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function truncateText(text, max = 70) {
  const value = String(text || "").trim();
  if (!value) return "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function computeCustomerExportTotals(rows = [], includesBalances = false) {
  const customerCount = rows.length;
  if (!includesBalances) {
    return { customerCount, includesBalances: false };
  }

  let totalInvoiced = 0;
  let totalPaid = 0;
  let balanceDue = 0;
  let unpaidInvoices = 0;
  let withBalance = 0;

  for (const row of rows) {
    totalInvoiced += Number(row.total_invoiced) || 0;
    totalPaid += Number(row.total_paid) || 0;
    balanceDue += Number(row.balance_pending) || 0;
    unpaidInvoices += Number(row.pending_count) || 0;
    if (Number(row.balance_pending) > 0) withBalance += 1;
  }

  return {
    customerCount,
    withBalance,
    totalInvoiced,
    totalPaid,
    balanceDue,
    unpaidInvoices,
    includesBalances: true,
  };
}

function drawTableSectionHeader(doc, { y, pageWidth, margin, customerCount, scopeLabel }) {
  const barHeight = 12;
  doc.setFillColor(...C.navy);
  doc.roundedRect(margin, y, pageWidth - margin * 2, barHeight, 1.5, 1.5, "F");

  doc.setTextColor(...C.white);
  doc.setFont(TABLE_FONT, "bold");
  doc.setFontSize(10);
  doc.text("Customer Details", margin + 4, y + 7.5, { align: "left" });

  doc.setFont(TABLE_FONT, "normal");
  doc.setFontSize(8);
  doc.text(`${customerCount} customer(s)  |  ${scopeLabel}`, pageWidth - margin - 4, y + 7.5, {
    align: "right",
  });

  return y + barHeight + 4;
}

function drawPageFooter(doc, { pageNumber, pageCount, company, pageWidth, pageHeight, margin }) {
  const footerY = pageHeight - 6;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont(TABLE_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(`${company.name}  |  Customer Accounts Report`, margin, footerY, { align: "left" });
  doc.text(
    `Page ${pageNumber} of ${pageCount}  |  ${company.generatedAt}`,
    pageWidth - margin,
    footerY,
    { align: "right" }
  );
}

function prepareCompany(company) {
  return {
    ...company,
    initial: companyInitial(company.name),
    fullAddress: formatCompanyAddress(company),
  };
}

function buildColumnStyles(columns) {
  const styles = {
    0: { cellWidth: 8, halign: "center", textColor: C.muted, fontSize: 7.5 },
  };

  columns.forEach((column, index) => {
    const tableIndex = index + 1;
    const style = { halign: "left" };
    if (column.format === "currency") {
      style.halign = "right";
      style.cellWidth = 22;
    }
    if (column.format === "integer") {
      style.halign = "center";
      style.cellWidth = 16;
    }
    if (column.key === "name") {
      style.fontStyle = "bold";
      style.cellWidth = 34;
    }
    if (column.key === "balance_pending") {
      style.fontStyle = "bold";
      style.halign = "right";
      style.cellWidth = 24;
    }
    if (column.key === "phone") style.cellWidth = 22;
    if (column.key === "email") style.cellWidth = 34;
    if (column.key === "address") style.cellWidth = 42;
    if (column.key === "notes") style.cellWidth = 36;
    styles[tableIndex] = style;
  });

  return styles;
}

function findCurrencyColumnIndexes(columns) {
  return columns
    .map((column, index) => (column.format === "currency" ? index : -1))
    .filter((index) => index >= 0);
}

export async function exportCustomersPdf({
  rows = [],
  definition,
  settings = {},
  currency,
  search = "",
  filterSummary = "",
  totalMatched = rows.length,
  truncated = false,
}) {
  const preparedCompany = prepareCompany(buildReportCompanyProfile(settings));
  const totalsRaw = computeCustomerExportTotals(rows, definition.includesBalances);
  const totals = {
    ...totalsRaw,
    totalInvoicedFormatted: formatCurrency(totalsRaw.totalInvoiced || 0, currency),
    totalPaidFormatted: formatCurrency(totalsRaw.totalPaid || 0, currency),
    balanceDueFormatted: formatCurrency(totalsRaw.balanceDue || 0, currency),
  };

  const scopeLabel = definition.subtitle || definition.title;

  const coverHtml = buildCustomersReportCoverHtml({
    company: preparedCompany,
    currency,
    reportTitle: definition.title,
    reportSubtitle: definition.subtitle,
    scopeLabel,
    search,
    filterSummary,
    totals,
    customerCount: rows.length,
    totalMatched,
    truncated,
  });

  const coverCanvas = await renderReportCoverToCanvas(coverHtml, ".customers-report-cover");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - PAGE_MARGIN * 2;
  const columns = definition.columns;
  const currencyIndexes = findCurrencyColumnIndexes(columns);
  const balanceColumnIndex = columns.findIndex((column) => column.key === "balance_pending");

  addCoverPageToPdf(doc, coverCanvas, pageWidth, pageHeight, FOOTER_HEIGHT_MM);

  doc.addPage();
  const tableStartY = drawTableSectionHeader(doc, {
    y: PAGE_MARGIN,
    pageWidth,
    margin: PAGE_MARGIN,
    customerCount: rows.length,
    scopeLabel,
  });

  const tableBody = rows.map((row, index) => [
    String(index + 1),
    ...columns.map((column) => {
      const raw = row[column.key];
      if (column.key === "address" || column.key === "notes") {
        return truncateText(raw, 55);
      }
      return formatCellValue(raw, column, currency);
    }),
  ]);

  let footRow = null;
  if (definition.includesBalances && totalsRaw.customerCount > 0) {
    const footCells = new Array(columns.length + 1).fill("");
    footCells[1] = "TOTALS";
    columns.forEach((column, index) => {
      const cellIndex = index + 1;
      if (column.key === "total_invoiced") {
        footCells[cellIndex] = formatCurrency(totalsRaw.totalInvoiced, currency);
      } else if (column.key === "total_paid") {
        footCells[cellIndex] = formatCurrency(totalsRaw.totalPaid, currency);
      } else if (column.key === "balance_pending") {
        footCells[cellIndex] = formatCurrency(totalsRaw.balanceDue, currency);
      } else if (column.key === "pending_count") {
        footCells[cellIndex] = String(totalsRaw.unpaidInvoices);
      }
    });
    footRow = footCells;
  }

  autoTable(doc, {
    startY: tableStartY,
    tableWidth,
    head: [["#", ...columns.map((column) => column.label)]],
    body: tableBody.length ? tableBody : [["—", ...columns.map(() => "—")]],
    foot: footRow ? [footRow] : undefined,
    theme: "grid",
    styles: {
      font: TABLE_FONT,
      fontSize: 8,
      cellPadding: { top: 2.8, right: 2.5, bottom: 2.8, left: 2.5 },
      lineColor: C.border,
      lineWidth: 0.15,
      textColor: C.navyLight,
      valign: "middle",
      overflow: "linebreak",
      halign: "left",
    },
    headStyles: {
      font: TABLE_FONT,
      fillColor: C.emerald,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
    },
    footStyles: {
      font: TABLE_FONT,
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: C.surface },
    columnStyles: buildColumnStyles(columns),
    margin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      bottom: FOOTER_HEIGHT_MM + 2,
    },
    showHead: "everyPage",
    didParseCell: (data) => {
      if (data.section === "body") {
        if (balanceColumnIndex >= 0 && data.column.index === balanceColumnIndex + 1) {
          const numeric = Number(String(data.cell.raw).replace(/[^\d.-]/g, "")) || 0;
          if (numeric > 0) {
            data.cell.styles.textColor = C.danger;
            data.cell.styles.fillColor = C.dangerLight;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "right";
          }
        }
        if (currencyIndexes.includes(data.column.index - 1)) {
          data.cell.styles.halign = "right";
        }
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawPageFooter(doc, {
      pageNumber: page,
      pageCount,
      company: preparedCompany,
      pageWidth,
      pageHeight,
      margin: PAGE_MARGIN,
    });
  }

  const filename = `${definition.filePrefix}-${timestampSlug()}.pdf`;

  return {
    buffer: doc.output("arraybuffer"),
    filename,
    mimeType: "application/pdf",
    count: rows.length,
  };
}
