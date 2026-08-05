import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { companyMetaLines } from "./companyProfile.js";
import { mapRowsForExport, buildSummary } from "./formatRows.js";

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportDirectoryPdf({ definition, rows, company, currency }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.name, margin, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(definition.title, margin, 19);

  doc.setFontSize(9);
  doc.text(`Generated ${company.generatedDate}`, pageWidth - margin, 12, { align: "right" });
  doc.text(`${rows.length} record(s)`, pageWidth - margin, 18, { align: "right" });

  y = 36;
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
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(definition.subtitle, margin, y);
  y += 6;

  const headers = [definition.columns.map((column) => column.label)];
  const body = mapRowsForExport(rows, definition, currency);
  const summary = buildSummary(definition.id, rows, currency);

  autoTable(doc, {
    startY: y,
    head: headers,
    body,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: margin, right: margin },
  });

  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Summary", margin, finalY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  summary.lines.forEach((line, index) => {
    doc.text(line, margin, finalY + 6 + index * 5);
  });

  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Prepared for sharing · DukkanPOS", margin, footerY);
  doc.text(`Confidential business document · ${company.generatedAt}`, pageWidth - margin, footerY, {
    align: "right",
  });

  const filename = `${definition.filePrefix}-${timestampSlug()}.pdf`;
  const buffer = doc.output("arraybuffer");

  return {
    buffer,
    filename,
    count: rows.length,
    mimeType: "application/pdf",
  };
}
