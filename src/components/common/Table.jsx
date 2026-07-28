import "./Table.css";

export default function Table({
  columns,
  data,
  emptyMessage = "No data found",
  onRowClick,
  rowClassName = "",
}) {
  if (!data?.length) {
    return (
      <div className="table-wrapper">
        <div className="empty-state">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id ?? idx}
              className={`${onRowClick ? "data-table-row-clickable" : ""} ${rowClassName}`.trim()}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} onClick={col.stopPropagation ? (e) => e.stopPropagation() : undefined}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
