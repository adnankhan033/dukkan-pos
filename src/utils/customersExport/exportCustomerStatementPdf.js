import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildReportCompanyProfile,
  companyInitial,
  formatCompanyAddress,
} from "../directoryExport/companyProfile.js";
import { formatCurrency, formatDateTime } from "../format.js";
import { SALE_PAYMENT_STATUS_LABELS } from "../constants.js";
import { resolvePaymentMethodLabel } from "../paymentMethods.js";
import { buildCustomerStatementCoverHtml } from "./buildCustomerStatementCoverHtml.js";
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

function slugifyName(name) {
  return String(name || "customer")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function paymentStatusLabel(status) {
  return SALE_PAYMENT_STATUS_LABELS[status] || status || "Paid";
}

function statusStyle(label) {
  if (label === "Pending") return { text: C.danger, fill: C.dangerLight };
  if (label === "Partial") return { text: C.amber, fill: C.amberLight };
  return { text: C.emerald, fill: C.emeraldLight };
}

function tableMargin() {
  return { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_HEIGHT_MM + 2 };
}

function ensureSpace(doc, startY, pageHeight, needed = 24) {
  if (startY + needed <= pageHeight - FOOTER_HEIGHT_MM - 4) {
    return startY;
  }
  doc.addPage();
  return PAGE_MARGIN;
}

function drawSectionHeader(doc, { y, pageWidth, margin, title, meta }) {
  const barHeight = 12;
  doc.setFillColor(...C.navy);
  doc.roundedRect(margin, y, pageWidth - margin * 2, barHeight, 1.5, 1.5, "F");
  doc.setTextColor(...C.white);
  doc.setFont(TABLE_FONT, "bold");
  doc.setFontSize(10);
  doc.text(title, margin + 4, y + 7.5);
  doc.setFont(TABLE_FONT, "normal");
  doc.setFontSize(8);
  doc.text(meta, pageWidth - margin - 4, y + 7.5, { align: "right" });
  return y + barHeight + 4;
}

function drawInvoiceBand(doc, { y, pageWidth, margin, order, currency, paymentMethods }) {
  const bandHeight = 8;
  doc.setFillColor(...C.surface);
  doc.setDrawColor(...C.border);
  doc.roundedRect(margin, y, pageWidth - margin * 2, bandHeight, 1, 1, "FD");
  doc.setFont(TABLE_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.navy);
  const meta = [
    `Invoice ${order.sale_number || "—"}`,
    formatDateTime(order.created_at),
    resolvePaymentMethodLabel(order.payment_method, paymentMethods),
    paymentStatusLabel(order.payment_status),
    `Due ${formatCurrency(order.balance_due || 0, currency)}`,
  ].join("  ·  ");
  doc.text(meta, margin + 3, y + 5.5);
  return y + bandHeight + 2;
}

function drawPageFooter(doc, { pageNumber, pageCount, company, customerName, pageWidth, pageHeight, margin }) {
  const footerY = pageHeight - 6;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont(TABLE_FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(`${company.name}  |  Statement: ${customerName}`, margin, footerY, { align: "left" });
  doc.text(
    `Page ${pageNumber} of ${pageCount}  |  ${company.generatedAt}`,
    pageWidth - margin,
    footerY,
    { align: "right" }
  );
}

function prepareCompany(settings) {
  const company = buildReportCompanyProfile(settings);
  return {
    ...company,
    initial: companyInitial(company.name),
    fullAddress: formatCompanyAddress(company),
  };
}

export async function exportCustomerStatementPdf({
  statement,
  settings = {},
  currency,
  paymentMethods = [],
  includeFullDetail = true,
}) {
  const { customer, summary, orders = [], payments = [] } = statement;
  const preparedCompany = prepareCompany(settings);

  const summaryFormatted = {
    totalInvoicedFormatted: formatCurrency(summary.total_invoiced || 0, currency),
    totalPaidFormatted: formatCurrency(summary.total_paid || 0, currency),
    balanceDueFormatted: formatCurrency(summary.balance_pending || 0, currency),
  };

  const coverHtml = buildCustomerStatementCoverHtml({
    company: preparedCompany,
    customer,
    currency,
    summary: summaryFormatted,
    invoiceCount: orders.length,
    paymentCount: payments.length,
    includeFullDetail,
  });

  const coverCanvas = await renderReportCoverToCanvas(coverHtml, ".customer-statement-cover");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - PAGE_MARGIN * 2;

  addCoverPageToPdf(doc, coverCanvas, pageWidth, pageHeight, FOOTER_HEIGHT_MM);

  doc.addPage();
  let startY = drawSectionHeader(doc, {
    y: PAGE_MARGIN,
    pageWidth,
    margin: PAGE_MARGIN,
    title: "Invoice Summary",
    meta: `${orders.length} invoice(s)`,
  });

  const invoiceBody = orders.map((order, index) => [
    String(index + 1),
    order.sale_number || "—",
    formatDateTime(order.created_at),
    String(order.items?.length ?? 0),
    resolvePaymentMethodLabel(order.payment_method, paymentMethods),
    paymentStatusLabel(order.payment_status),
    formatCurrency(order.subtotal, currency),
    formatCurrency(order.discount, currency),
    formatCurrency(order.vat, currency),
    formatCurrency(order.total, currency),
    formatCurrency(order.amount_paid || 0, currency),
    formatCurrency(order.balance_due || 0, currency),
  ]);

  const invoiceTotals = orders.reduce(
    (acc, order) => {
      acc.subtotal += Number(order.subtotal) || 0;
      acc.discount += Number(order.discount) || 0;
      acc.vat += Number(order.vat) || 0;
      acc.total += Number(order.total) || 0;
      acc.paid += Number(order.amount_paid) || 0;
      acc.due += Number(order.balance_due) || 0;
      return acc;
    },
    { subtotal: 0, discount: 0, vat: 0, total: 0, paid: 0, due: 0 }
  );

  autoTable(doc, {
    startY,
    tableWidth,
    head: [[
      "#", "Invoice", "Date", "Items", "Payment", "Status",
      "Subtotal", "Discount", "VAT", "Total", "Paid", "Balance",
    ]],
    body: invoiceBody.length
      ? invoiceBody
      : [["—", "No invoices yet", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
    foot: invoiceBody.length
      ? [[
          "", "TOTALS", "", String(orders.length), "", "",
          formatCurrency(invoiceTotals.subtotal, currency),
          formatCurrency(invoiceTotals.discount, currency),
          formatCurrency(invoiceTotals.vat, currency),
          formatCurrency(invoiceTotals.total, currency),
          formatCurrency(invoiceTotals.paid, currency),
          formatCurrency(invoiceTotals.due, currency),
        ]]
      : undefined,
    theme: "grid",
    styles: {
      font: TABLE_FONT,
      fontSize: 7.5,
      cellPadding: 2.2,
      lineColor: C.border,
      textColor: C.navyLight,
      valign: "middle",
    },
    headStyles: { fillColor: C.emerald, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: C.surface },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 22, fontStyle: "bold" },
      2: { cellWidth: 28 },
      3: { cellWidth: 10, halign: "center" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { halign: "right", cellWidth: 18 },
      7: { halign: "right", cellWidth: 16 },
      8: { halign: "right", cellWidth: 16 },
      9: { halign: "right", cellWidth: 18, fontStyle: "bold" },
      10: { halign: "right", cellWidth: 16 },
      11: { halign: "right", cellWidth: 18, fontStyle: "bold" },
    },
    margin: tableMargin(),
    showHead: "firstPage",
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const style = statusStyle(String(data.cell.raw));
        data.cell.styles.textColor = style.text;
        data.cell.styles.fillColor = style.fill;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 11) {
        const due = Number(String(data.cell.raw).replace(/[^\d.-]/g, "")) || 0;
        if (due > 0) {
          data.cell.styles.textColor = C.danger;
          data.cell.styles.fillColor = C.dangerLight;
        }
      }
    },
  });

  if (includeFullDetail && orders.length) {
    startY = ensureSpace(doc, doc.lastAutoTable.finalY + 10, pageHeight, 28);
    startY = drawSectionHeader(doc, {
      y: startY,
      pageWidth,
      margin: PAGE_MARGIN,
      title: "Invoice Line Items",
      meta: `${orders.length} invoice(s)`,
    });

    for (const order of orders) {
      const itemCount = order.items?.length || 0;
      const estimatedHeight = 12 + Math.max(itemCount, 1) * 6;
      startY = ensureSpace(doc, startY, pageHeight, estimatedHeight);
      startY = drawInvoiceBand(doc, {
        y: startY,
        pageWidth,
        margin: PAGE_MARGIN,
        order,
        currency,
        paymentMethods,
      });

      const itemRows = (order.items || []).map((item, index) => [
        String(index + 1),
        item.product_name || "Product",
        item.barcode || "—",
        String(item.quantity),
        formatCurrency(item.unit_price, currency),
        formatCurrency(item.discount || 0, currency),
        formatCurrency(item.total, currency),
      ]);

      autoTable(doc, {
        startY,
        tableWidth,
        head: [["#", "Product", "Barcode", "Qty", "Unit Price", "Discount", "Line Total"]],
        body: itemRows.length ? itemRows : [["—", "No line items", "—", "—", "—", "—", "—"]],
        theme: "grid",
        styles: { font: TABLE_FONT, fontSize: 8, cellPadding: 2.2, textColor: C.navyLight },
        headStyles: { fillColor: C.emerald, textColor: C.white, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: C.surface },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 62 },
          2: { cellWidth: 28 },
          3: { cellWidth: 12, halign: "center" },
          4: { cellWidth: 22, halign: "right" },
          5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 24, halign: "right", fontStyle: "bold" },
        },
        margin: tableMargin(),
        showHead: false,
      });

      startY = doc.lastAutoTable.finalY + 4;
    }
  }

  if (payments.length) {
    startY = (doc.lastAutoTable?.finalY ?? PAGE_MARGIN) + 10;
    startY = ensureSpace(doc, startY, pageHeight, 24);
    startY = drawSectionHeader(doc, {
      y: startY,
      pageWidth,
      margin: PAGE_MARGIN,
      title: "Payment History",
      meta: `${payments.length} payment(s)`,
    });

    const paymentBody = payments.map((payment, index) => [
      String(index + 1),
      payment.payment_date || formatDateTime(payment.created_at),
      payment.sale_number || "General",
      resolvePaymentMethodLabel(payment.payment_method, paymentMethods),
      formatCurrency(payment.amount, currency),
      payment.notes || "—",
    ]);

    const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    autoTable(doc, {
      startY,
      tableWidth,
      head: [["#", "Date", "Invoice", "Method", "Amount", "Notes"]],
      body: paymentBody,
      foot: [[
        "", "TOTAL PAYMENTS", "", "",
        formatCurrency(totalPaid, currency),
        "",
      ]],
      theme: "grid",
      styles: { font: TABLE_FONT, fontSize: 8, cellPadding: 2.5, textColor: C.navyLight },
      headStyles: { fillColor: C.emerald, textColor: C.white, fontStyle: "bold" },
      footStyles: { fillColor: C.navy, textColor: C.white, fontStyle: "bold" },
      alternateRowStyles: { fillColor: C.surface },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 28 },
        2: { cellWidth: 28, fontStyle: "bold" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 24, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 52 },
      },
      margin: tableMargin(),
      showHead: "firstPage",
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawPageFooter(doc, {
      pageNumber: page,
      pageCount,
      company: preparedCompany,
      customerName: customer.name,
      pageWidth,
      pageHeight,
      margin: PAGE_MARGIN,
    });
  }

  const filename = `customer-statement-${slugifyName(customer.name)}-${timestampSlug()}.pdf`;

  return {
    buffer: doc.output("arraybuffer"),
    filename,
    mimeType: "application/pdf",
    count: orders.length,
  };
}
