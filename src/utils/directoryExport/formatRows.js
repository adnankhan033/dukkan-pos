import { formatCurrency } from "../format";

export function formatCellValue(value, column, currency) {
  if (value == null || value === "") return "—";
  if (column.format === "currency") {
    return formatCurrency(Number(value) || 0, currency);
  }
  return String(value);
}

export function mapRowsForExport(rows, definition, currency) {
  return rows.map((row) =>
    definition.columns.map((column) => formatCellValue(row[column.key], column, currency))
  );
}

export function buildSummary(type, rows, currency) {
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

  return {
    totalRecords: rows.length,
    lines: [`Total customers: ${rows.length}`],
  };
}
