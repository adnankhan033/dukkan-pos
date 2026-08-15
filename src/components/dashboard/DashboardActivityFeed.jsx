import { useNavigate } from "react-router-dom";
import { DollarSign, RotateCcw } from "lucide-react";
import { formatCurrency, formatDateTime } from "../../utils/format";

export default function DashboardActivityFeed({
  items = [],
  currency = "SAR",
  type = "sale",
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyHint,
  emptyAction,
}) {
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="dashboard-empty-state">
        {EmptyIcon ? <EmptyIcon size={36} /> : null}
        <p>{emptyTitle}</p>
        <span>{emptyHint}</span>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="dashboard-activity-list">
      {items.map((item, index) => {
        const isReturn = type === "return";
        const title = isReturn ? item.return_number : item.sale_number;
        const amount = isReturn ? item.total_refund : item.total;
        const subtitle = isReturn
          ? `${item.sale_number} · ${item.customer_name || "Walk-in"} · ${formatDateTime(item.created_at)}`
          : `${item.customer_name || "Walk-in"} · ${formatDateTime(item.created_at)}`;

        return (
          <button
            key={item.id}
            type="button"
            className="dashboard-activity-item dashboard-activity-clickable"
            style={{ "--item-delay": `${index * 45}ms` }}
            onClick={() => navigate("/orders")}
          >
            <div
              className={`dashboard-activity-rail ${isReturn ? "return" : ""}`}
              aria-hidden="true"
            />
            <div className={`dashboard-activity-icon ${isReturn ? "return" : "sale"}`}>
              {isReturn ? <RotateCcw size={16} /> : <DollarSign size={16} />}
            </div>
            <div className="dashboard-activity-body">
              <strong>{title}</strong>
              <span>{subtitle}</span>
            </div>
            <strong className={`dashboard-activity-amount ${isReturn ? "negative" : ""}`}>
              {isReturn ? "−" : ""}
              {formatCurrency(amount, currency)}
            </strong>
          </button>
        );
      })}
    </div>
  );
}
