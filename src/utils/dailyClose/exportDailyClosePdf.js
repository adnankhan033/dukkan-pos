import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { companyMetaLines } from "../directoryExport/companyProfile.js";
import { formatCurrency, formatDate, formatDateTime } from "../format.js";

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function paymentLabel(method) {
  return String(method || "cash").toLowerCase() === "card" ? "Card" : "Cash";
}

export function exportDailyClosePdf({ data, company, currency, closeRecord = null }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.name, margin, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Daily Sales Close Report", margin, 21);

  doc.setFontSize(9);
  doc.text(`Generated ${company.generatedDate}`, pageWidth - margin, 13, { align: "right" });
  doc.text(formatDate(data.date), pageWidth - margin, 19, { align: "right" });
  if (closeRecord?.closed_at) {
    doc.text(`Closed ${formatDateTime(closeRecord.closed_at)}`, pageWidth - margin, 25, { align: "right" });
  }

  y = 40;
  doc.setTextColor(30, 41, 59);

  if (company.nameAr) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(company.nameAr, margin, y);
    y += 6;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const line of companyMetaLines(company)) {
    doc.text(line, margin, y);
    y += 5;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  y += 10;

  const { summary } = data;
  const summaryRows = [
    ["Gross Sales", formatCurrency(summary.grossSales, currency)],
    ["Returns", formatCurrency(summary.returnsTotal, currency)],
    ["Net Sales", formatCurrency(summary.netSales, currency)],
    ["Cash in drawer (Net)", formatCurrency(summary.cashTotal, currency)],
    ["Card / bank (Net)", formatCurrency(summary.cardTotal, currency)],
    ["Pay later (not cash)", formatCurrency(summary.creditTotal || 0, currency)],
    ["Expenses", formatCurrency(summary.expensesTotal, currency)],
    ["Sales Count", String(summary.salesCount)],
    ["Returns Count", String(summary.returnsCount)],
  ];

  if (closeRecord?.cash_counted != null) {
    summaryRows.push(["Cash Counted", formatCurrency(closeRecord.cash_counted, currency)]);
    summaryRows.push(["Cash Variance", formatCurrency(closeRecord.cash_variance ?? 0, currency)]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Summary", "Amount"]],
    body: summaryRows,
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - margin * 2,
  });

  y = doc.lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Payment Breakdown", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Method", "Sales", "Gross", "Returns", "Net"]],
    body: [
      [
        "Cash",
        String(summary.cashCount),
        formatCurrency(summary.cashGross, currency),
        formatCurrency(summary.cashReturns, currency),
        formatCurrency(summary.cashTotal, currency),
      ],
      [
        "Card",
        String(summary.cardCount),
        formatCurrency(summary.cardGross, currency),
        formatCurrency(summary.cardReturns, currency),
        formatCurrency(summary.cardTotal, currency),
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Sales Transactions", margin, y);
  y += 4;

  const salesBody = (data.sales || []).map((sale) => [
    sale.sale_number,
    sale.customer_name || "Walk-in",
    paymentLabel(sale.payment_method),
    formatCurrency(sale.total, currency),
    formatDateTime(sale.created_at),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Sale #", "Customer", "Payment", "Total", "Time"]],
    body: salesBody.length ? salesBody : [["—", "No sales for this date", "—", "—", "—"]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });

  if ((data.returns || []).length > 0) {
    y = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Returns", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Return #", "Sale #", "Customer", "Refund", "Time"]],
      body: data.returns.map((row) => [
        row.return_number,
        row.sale_number,
        row.customer_name || "Walk-in",
        formatCurrency(row.total_refund, currency),
        formatDateTime(row.created_at),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: "bold" },
      margin: { left: margin, right: margin },
    });
  }

  if (closeRecord?.notes) {
    y = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Close Notes", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(closeRecord.notes, margin, y + 6, { maxWidth: pageWidth - margin * 2 });
  }

  if (closeRecord?.closed_by_username) {
    const footerY = doc.internal.pageSize.getHeight() - 14;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Closed by: ${closeRecord.closed_by_username}`, margin, footerY);
  }

  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(8);
  doc.text("Daily Close Report · Nexttel POS", margin, footerY);
  doc.text(`Confidential · ${company.generatedAt}`, pageWidth - margin, footerY, { align: "right" });

  const filename = `daily-close-${data.date}-${timestampSlug()}.pdf`;
  return {
    buffer: doc.output("arraybuffer"),
    filename,
    mimeType: "application/pdf",
  };
}
