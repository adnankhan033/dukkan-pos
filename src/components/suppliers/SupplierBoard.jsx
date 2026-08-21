import { formatCurrency, formatSignedCurrency } from "../../utils/format";
import "../dashboard/DailyBoard.css";

function amountClass(direction) {
  if (direction === "in") return "in";
  if (direction === "out") return "out";
  return "zero";
}

function Line({ label, value, currency, direction, plain }) {
  return (
    <div className="daily-board-line">
      <span>{label}</span>
      {plain ? (
        <strong>{formatCurrency(value, currency)}</strong>
      ) : (
        <strong className={`daily-board-amount ${amountClass(direction)}`}>
          {formatSignedCurrency(value, currency, direction)}
        </strong>
      )}
    </div>
  );
}

export default function SupplierBoard({ summary, currency = "SAR" }) {
  const aging = summary.aging || {};
  const boxes = [
    {
      id: "due",
      title: "Still to pay",
      tone: "olive",
      total: summary.total_pending || 0,
      direction: "out",
      extra: `${summary.suppliers_with_balance || 0} supplier${summary.suppliers_with_balance === 1 ? "" : "s"} · you will pay`,
      rows: [
        ["0–15 days", aging.d0_15 || 0, "out"],
        ["15–30 days", aging.d15_30 || 0, "out"],
        ["30–60 days", aging.d30_60 || 0, "out"],
        ["Over 90 days", aging.over90 || 0, "out"],
      ],
    },
    {
      id: "extra",
      title: "Extra paid",
      tone: "green",
      total: summary.total_advance || 0,
      direction: "in",
      extra: `${summary.suppliers_with_advance || 0} supplier${summary.suppliers_with_advance === 1 ? "" : "s"} · used on next delivery`,
      rows: [
        ["Cash already given", summary.total_advance || 0, "in"],
        ["Still to pay", summary.total_pending || 0, "out"],
      ],
    },
    {
      id: "volume",
      title: "All suppliers",
      tone: "blue",
      totalLabel: formatCurrency(summary.total_delivered || 0, currency),
      extra: "Delivered vs cash paid",
      rows: [
        ["Delivered", summary.total_delivered || 0, null, true],
        ["Paid", summary.total_paid || 0, null, true],
      ],
    },
  ];

  return (
    <section className="daily-board" aria-label="Supplier totals">
      {boxes.map((box) => (
        <div key={box.id} className={`daily-board-box static tone-${box.tone}`}>
          <header>
            <h3>{box.title}</h3>
            {box.totalLabel ? (
              <span>{box.totalLabel}</span>
            ) : (
              <span className={`daily-board-amount ${amountClass(box.direction)}`}>
                {formatSignedCurrency(box.total, currency, box.direction)}
              </span>
            )}
          </header>
          {box.extra ? <p className="daily-board-extra">{box.extra}</p> : null}
          {box.rows.map(([label, value, direction, plain]) => (
            <Line key={label} label={label} value={value} currency={currency} direction={direction} plain={plain} />
          ))}
        </div>
      ))}
      <p className="daily-board-legend">
        <span className="daily-board-amount out">− still to pay</span>
        <span className="daily-board-amount in">+ extra paid</span>
      </p>
    </section>
  );
}
