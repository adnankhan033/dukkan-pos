import { useNavigate } from "react-router-dom";
import { ShoppingCart, ClipboardList, DollarSign } from "lucide-react";
import { useSettingsStore } from "../../contexts/store";
import PageHeader from "../common/PageHeader";
import Button from "../common/Button";
import { StatCard, Card } from "../common/Card";
import { formatCurrency, formatDateTime } from "../../utils/format";
import DashboardInsights from "./DashboardInsights";
import "../../pages/Dashboard.css";

export default function CashierDashboard({ stats }) {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const showRecent = settings.dashboard_cashier_show_recent !== "0";
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Cashier Dashboard"
        subtitle={`Welcome — ready to serve customers at ${settings.store_name || "your store"}.`}
      />

      <div className="dashboard-stats">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(stats.todaySales, currency)}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          label="Held Orders"
          value={stats.heldCount ?? 0}
          icon={ClipboardList}
          variant="warning"
        />
      </div>

      <div className="cashier-quick-actions">
        <Button onClick={() => navigate("/sales")}>
          <ShoppingCart size={16} /> Open POS
        </Button>
        <Button variant="secondary" onClick={() => navigate("/orders")}>
          <ClipboardList size={16} /> View Orders
        </Button>
      </div>

      <DashboardInsights
        insights={(stats.smartInsights || []).slice(0, 3)}
        topProducts={(stats.topProducts || []).slice(0, 3)}
        currency={currency}
      />

      {showRecent && (
        <Card style={{ marginTop: "1.5rem" }}>
          <div className="card-header">
            <h3 className="card-title">Recent Sales</h3>
          </div>
          {stats.recentSales.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              No sales yet today
            </p>
          ) : (
            <div className="recent-sales-list">
              {stats.recentSales.map((sale) => (
                <div key={sale.id} className="recent-sale-item">
                  <div>
                    <strong>{sale.sale_number}</strong>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
                      {sale.customer_name || "Walk-in"} · {formatDateTime(sale.created_at)}
                    </div>
                  </div>
                  <strong>{formatCurrency(sale.total, currency)}</strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
