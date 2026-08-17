import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCompanyAddress, companyInitial } from "../directoryExport/companyProfile.js";
import { formatCurrency, formatDateTime } from "../format.js";
import { ORDER_RETURN_FILTERS, SALE_STATUS } from "../constants.js";
import { buildOrdersReportCoverHtml } from "./buildOrdersReportCoverHtml.js";
import {
  addCoverPageToPdf,
  renderReportCoverToCanvas,
} from "../pdf/renderReportCoverToCanvas.js";

const EXPORT_MAX_ROWS = 10000;
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
  blueLight: [239, 246, 255],
};

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function statusLabel(status) {
  switch (status) {
    case SALE_STATUS.RETURNED:
      return "Returned";
    case SALE_STATUS.PARTIAL_RETURN:
      return "Partial Return";
    case SALE_STATUS.HELD:
      return "Held";
    case SALE_STATUS.COMPLETED:
    default:
      return "Completed";
  }
}

function paymentLabel(method) {
  const key = String(method || "cash").toLowerCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function returnFilterLabel(filter) {
  switch (filter) {
    case ORDER_RETURN_FILTERS.NO_RETURN:
      return "No returns";
    case ORDER_RETURN_FILTERS.WITH_RETURN:
      return "With returns";
    case ORDER_RETURN_FILTERS.PARTIAL:
      return "Partial return";
    case ORDER_RETURN_FILTERS.RETURNED:
      return "Full return";
    default:
      return "All orders";
  }
}

function truncateText(text, max = 70) {
  const value = String(text || "").trim();
  if (!value) return "-";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function truncateLabel(text, max = 52) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export function computeOrdersExportTotals(orders = []) {
  let subtotal = 0;
  let discount = 0;
  let vat = 0;
  let total = 0;
  let completedCount = 0;

  for (const order of orders) {
    if (order.status === SALE_STATUS.HELD) continue;
    completedCount += 1;
    subtotal += Number(order.subtotal) || 0;
    discount += Number(order.discount) || 0;
    vat += Number(order.vat) || 0;
    total += Number(order.total) || 0;
  }

  return {
    orderCount: completedCount,
    subtotal,
    discount,
    vat,
    total,
    avg: completedCount ? total / completedCount : 0,
  };
}

function computePaymentBreakdown(orders = [], currency) {
  let cash = 0;
  let card = 0;
  let cashCount = 0;
  let cardCount = 0;

  for (const order of orders) {
    if (order.status === SALE_STATUS.HELD) continue;
    const amount = Number(order.total) || 0;
    if (String(order.payment_method || "").toLowerCase() === "card") {
      card += amount;
      cardCount += 1;
    } else {
      cash += amount;
      cashCount += 1;
    }
  }

  return {
    cash,
    card,
    cashCount,
    cardCount,
    cashFormatted: formatCurrency(cash, currency),
    cardFormatted: formatCurrency(card, currency),
  };
}

async function renderCoverToCanvas(coverHtml) {
  return renderReportCoverToCanvas(coverHtml, ".orders-report-cover");
}

function addCoverPage(doc, coverCanvas, pageWidth, pageHeight) {
  addCoverPageToPdf(doc, coverCanvas, pageWidth, pageHeight, FOOTER_HEIGHT_MM);
}

function statusStyle(label) {
  switch (label) {
    case "Returned":
      return { text: C.danger, fill: C.dangerLight };
    case "Partial Return":
      return { text: C.amber, fill: C.amberLight };
    case "Held":
      return { text: C.muted, fill: C.surface };
    default:
      return { text: C.emerald, fill: C.emeraldLight };
  }
}

function drawTableSectionHeader(doc, { y, pageWidth, margin, invoiceCount, periodLabel }) {
  const barHeight = 12;
  doc.setFillColor(...C.navy);
  doc.roundedRect(margin, y, pageWidth - margin * 2, barHeight, 1.5, 1.5, "F");

  doc.setTextColor(...C.white);
  doc.setFont(TABLE_FONT, "bold");
  doc.setFontSize(10);
  doc.text("Invoice Details", margin + 4, y + 7.5, { align: "left" });

  doc.setFont(TABLE_FONT, "normal");
  doc.setFontSize(8);
  const meta = `${invoiceCount} invoice(s)  |  ${truncateLabel(periodLabel, 48)}`;
  doc.text(meta, pageWidth - margin - 4, y + 7.5, { align: "right" });

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
  doc.text(`${company.name}  |  Sales Invoices Report`, margin, footerY, { align: "left" });
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

export async function exportOrdersPdf({
  orders = [],
  company,
  currency,
  periodLabel,
  returnFilter = ORDER_RETURN_FILTERS.ALL,
  search = "",
  stats = null,
  totalMatched = orders.length,
  truncated = false,
}) {
  const preparedCompany = prepareCompany(company);
  const lineTotals = computeOrdersExportTotals(orders);
  const paymentBreakdown = computePaymentBreakdown(orders, currency);

  const coverHtml = buildOrdersReportCoverHtml({
    company: preparedCompany,
    currency,
    periodLabel,
    returnFilterLabel: returnFilterLabel(returnFilter),
    search,
    lineTotals: {
      ...lineTotals,
      subtotalFormatted: formatCurrency(lineTotals.subtotal, currency),
      discountFormatted: formatCurrency(lineTotals.discount, currency),
      vatFormatted: formatCurrency(lineTotals.vat, currency),
      totalFormatted: formatCurrency(lineTotals.total, currency),
      avgFormatted: formatCurrency(lineTotals.avg, currency),
    },
    stats: stats
      ? {
          returnsRaw: stats.returnsTotal ?? 0,
          returnsFormatted: formatCurrency(stats.returnsTotal ?? 0, currency),
          netFormatted: formatCurrency(stats.netTotal ?? 0, currency),
        }
      : null,
    paymentBreakdown,
    invoiceCount: orders.length,
    totalMatched,
    truncated,
  });

  const coverCanvas = await renderCoverToCanvas(coverHtml);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - PAGE_MARGIN * 2;

  addCoverPage(doc, coverCanvas, pageWidth, pageHeight);

  doc.addPage();
  let tableStartY = drawTableSectionHeader(doc, {
    y: PAGE_MARGIN,
    pageWidth,
    margin: PAGE_MARGIN,
    invoiceCount: orders.length,
    periodLabel,
  });

  const tableBody = orders.map((order, index) => [
    String(index + 1),
    order.sale_number || "-",
    formatDateTime(order.created_at),
    order.customer_name || "Walk-in",
    truncateText(order.items_summary, 65),
    String(order.item_count ?? 0),
    paymentLabel(order.payment_method),
    statusLabel(order.status),
    formatCurrency(order.subtotal, currency),
    formatCurrency(order.discount, currency),
    formatCurrency(order.vat, currency),
    formatCurrency(order.total, currency),
  ]);

  const footRow = lineTotals.orderCount
    ? [
        { content: "", colSpan: 1 },
        { content: "TOTALS", colSpan: 1, styles: { halign: "left" } },
        { content: "", colSpan: 3 },
        { content: String(lineTotals.orderCount), colSpan: 1, styles: { halign: "center" } },
        { content: "", colSpan: 2 },
        { content: formatCurrency(lineTotals.subtotal, currency), colSpan: 1, styles: { halign: "right" } },
        { content: formatCurrency(lineTotals.discount, currency), colSpan: 1, styles: { halign: "right" } },
        { content: formatCurrency(lineTotals.vat, currency), colSpan: 1, styles: { halign: "right" } },
        { content: formatCurrency(lineTotals.total, currency), colSpan: 1, styles: { halign: "right" } },
      ]
    : null;

  autoTable(doc, {
    startY: tableStartY,
    tableWidth,
    head: [
      [
        "#",
        "Invoice No.",
        "Date & Time",
        "Customer",
        "Products Sold",
        "Qty",
        "Payment",
        "Status",
        "Subtotal",
        "Discount",
        "VAT",
        "Total",
      ],
    ],
    body: tableBody.length
      ? tableBody
      : [["-", "-", "No invoices for selected period / filters", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
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
    columnStyles: {
      0: { cellWidth: 8, halign: "center", textColor: C.muted, fontSize: 7.5 },
      1: { cellWidth: 24, fontStyle: "bold" },
      2: { cellWidth: 30 },
      3: { cellWidth: 28 },
      4: { cellWidth: 52 },
      5: { cellWidth: 10, halign: "center" },
      6: { cellWidth: 14, halign: "center" },
      7: { cellWidth: 20, halign: "center" },
      8: { cellWidth: 21, halign: "right" },
      9: { cellWidth: 19, halign: "right" },
      10: { cellWidth: 19, halign: "right" },
      11: { cellWidth: 28, halign: "right", fontStyle: "bold", textColor: C.navy },
    },
    margin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      top: PAGE_MARGIN,
      bottom: FOOTER_HEIGHT_MM + 2,
    },
    showHead: "everyPage",
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.column.index === 7) {
          const style = statusStyle(data.cell.raw);
          data.cell.styles.textColor = style.text;
          data.cell.styles.fillColor = style.fill;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "center";
        }
        if (data.column.index === 11) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = C.navy;
          data.cell.styles.halign = "right";
        }
        if (data.column.index >= 8 && data.column.index <= 10) {
          data.cell.styles.halign = "right";
        }
        if (data.column.index === 6) {
          data.cell.styles.fillColor =
            String(data.cell.raw).toLowerCase() === "card" ? C.blueLight : C.emeraldLight;
          data.cell.styles.halign = "center";
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

  const filename = `orders-invoices-report-${timestampSlug()}.pdf`;

  return {
    buffer: doc.output("arraybuffer"),
    filename,
    mimeType: "application/pdf",
    exportedCount: orders.length,
    totalMatched,
    truncated,
  };
}

export { EXPORT_MAX_ROWS };
