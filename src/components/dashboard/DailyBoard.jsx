import { useNavigate } from "react-router-dom";
import { formatSignedCurrency } from "../../utils/format";
import "./DailyBoard.css";

function amountClass(direction, value) {
  if (direction === "in") return "in";
  if (direction === "out") return "out";
  const n = Number(value) || 0;
  if (n > 0.005) return "in";
  if (n < -0.005) return "out";
  return "zero";
}

function Money({ value, currency, direction }) {
  return (
    <strong className={`daily-board-amount ${amountClass(direction, value)}`}>
      {formatSignedCurrency(value, currency, direction)}
    </strong>
  );
}

function Line({ label, value, currency, direction, mute }) {
  return (
    <div className={`daily-board-line ${mute ? "mute" : ""}`}>
      <span>{label}</span>
      <Money value={value} currency={currency} direction={direction} />
    </div>
  );
}

export default function DailyBoard({ board, currency = "SAR" }) {
  const navigate = useNavigate();
  if (!board) return null;

  const boxes = [
    {
      id: "revenue",
      title: "Today sales",
      tone: "green",
      total: board.netSales,
      direction: "in",
      path: "/orders",
      rows: [
        ["Cash sale", board.sales.cash, "in"],
        ["Card / bank", board.sales.card, "in"],
        ["Credit (pay later)", board.sales.credit, "in"],
        ["Returns", board.returns.cash + board.returns.card + board.returns.credit + board.returns.other, "out"],
      ],
    },
    {
      id: "purchases",
      title: "Today purchases",
      tone: "red",
      total: board.purchases.total,
      direction: "out",
      path: "/purchases",
      rows: [
        ["Paid now", board.purchases.cash, "out"],
        ["On supplier credit", board.purchases.credit, "out"],
      ],
    },
    {
      id: "cash",
      title: "Cash today",
      tone: "blue",
      total: board.cash.net,
      direction: "auto",
      path: "/accounting/receive",
      rows: [
        ["Money in (cash + card sales)", board.cash.receiving, "in"],
        ["Money out (paid purchases + expenses)", board.cash.payments, "out"],
        ["Expenses", board.cash.expenses, "out"],
      ],
    },
    {
      id: "customers",
      title: "Customers owing",
      tone: "orange",
      total: board.customers.pending,
      direction: "in",
      path: "/customers",
      extra: `${board.customers.count} customer${board.customers.count === 1 ? "" : "s"} · you will receive`,
      rows: [
        ["0–15 days", board.customers.d0_15, "in"],
        ["15–30 days", board.customers.d15_30, "in"],
        ["30–60 days", board.customers.d30_60, "in"],
        ["Over 90 days", board.customers.over90, "in"],
      ],
    },
    {
      id: "vendors",
      title: "Suppliers to pay",
      tone: "olive",
      total: board.vendors.pending,
      direction: "out",
      path: "/suppliers",
      extra: `${board.vendors.count} supplier${board.vendors.count === 1 ? "" : "s"} · you will pay`,
      rows: [
        ["Extra paid", board.vendors.extraPaid || 0, "in"],
        ["0–15 days", board.vendors.d0_15, "out"],
        ["15–30 days", board.vendors.d15_30, "out"],
        ["30–60 days", board.vendors.d30_60, "out"],
        ["Over 90 days", board.vendors.over90, "out"],
      ],
    },
    {
      id: "stock",
      title: "Stock",
      tone: "purple",
      totalLabel: `${board.inventory.products} products`,
      path: "/inventory",
      rows: [
        ["Out of stock", board.inventory.outOfStock, null, true],
        ["Low stock", board.inventory.lowStock, null, true],
      ],
    },
  ];

  return (
    <section className="daily-board" aria-label="Today's store board">
      {boxes.map((box) => (
        <button
          key={box.id}
          type="button"
          className={`daily-board-box tone-${box.tone}`}
          onClick={() => navigate(box.path)}
        >
          <header>
            <h3>{box.title}</h3>
            {box.totalLabel ? (
              <span>{box.totalLabel}</span>
            ) : (
              <span className={`daily-board-amount ${amountClass(box.direction, box.total)}`}>
                {formatSignedCurrency(box.total, currency, box.direction)}
              </span>
            )}
          </header>
          {box.extra ? <p className="daily-board-extra">{box.extra}</p> : null}
          {box.rows.map(([label, value, direction, count]) =>
            count ? (
              <div key={label} className="daily-board-line">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ) : (
              <Line key={label} label={label} value={value} currency={currency} direction={direction} />
            )
          )}
        </button>
      ))}
      <p className="daily-board-legend">
        <span className="daily-board-amount in">+ money coming in</span>
        <span className="daily-board-amount out">− money going out</span>
      </p>
    </section>
  );
}
