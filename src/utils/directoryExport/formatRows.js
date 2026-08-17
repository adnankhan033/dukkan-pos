import { formatCurrency } from "../format";

export function formatCellValue(value, column, currency) {
  if (value == null || value === "") return "—";
  if (column.format === "currency") {
    return formatCurrency(Number(value) || 0, currency);
  }
  if (column.format === "integer") {
    return String(Number(value) || 0);
  }
  return String(value);
}

export function mapRowsForExport(rows, definition, currency) {
  return rows.map((row) =>
    definition.columns.map((column) => formatCellValue(row[column.key], column, currency))
  );
}

export function buildSummary(type, rows, currency, definition = null) {
  if (type === "suppliers") {
    const pending = rows.reduce((sum, row) => sum + Number(row.balance_pending || 0), 0);
    const delivered = rows.reduce((sum, row) => sum + Number(row.total_delivered || 0), 0);
    const paid = rows.reduce((sum, row) => sum + Number(row.total_paid || 0), 0);
    return {
      totalRecords: rows.length,
      lines: [
        `Total suppliers: ${rows.length}`,
        `Total delivered: ${formatCurrency(delivered, currency)}`,
        `Total paid: ${formatCurrency(paid, currency)}`,
        `Total pending balance: ${formatCurrency(pending, currency)}`,
      ],
    };
  }

  if (definition?.includesBalances) {
    const invoiced = rows.reduce((sum, row) => sum + Number(row.total_invoiced || 0), 0);
    const paid = rows.reduce((sum, row) => sum + Number(row.total_paid || 0), 0);
    const pending = rows.reduce((sum, row) => sum + Number(row.balance_pending || 0), 0);
    const withBalance = rows.filter((row) => Number(row.balance_pending || 0) > 0).length;
    const unpaidInvoices = rows.reduce((sum, row) => sum + Number(row.pending_count || 0), 0);

    const lines = [
      `Total customers in report: ${rows.length}`,
      `Customers with balance due: ${withBalance}`,
      `Total invoiced: ${formatCurrency(invoiced, currency)}`,
      `Total collected: ${formatCurrency(paid, currency)}`,
      `Total balance due: ${formatCurrency(pending, currency)}`,
    ];

    if (definition.scope === "balance_due") {
      lines.unshift("Report scope: customers with outstanding balance only");
    }

    if (unpaidInvoices > 0) {
      lines.push(`Unpaid / partial invoices: ${unpaidInvoices}`);
    }

    return { totalRecords: rows.length, lines };
  }

  return {
    totalRecords: rows.length,
    lines: [`Total customers: ${rows.length}`],
  };
}
