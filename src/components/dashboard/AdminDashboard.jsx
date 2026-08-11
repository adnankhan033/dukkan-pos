import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  ShoppingBag,
  Package,
  Users,
  AlertTriangle,
  TrendingUp,
  Wallet,
  RotateCcw,
} from "lucide-react";
import { useSettingsStore } from "../../contexts/store";
import PageHeader from "../common/PageHeader";
import { StatCard, Card } from "../common/Card";
import Badge from "../common/Badge";
import { formatCurrency, formatDateTime } from "../../utils/format";
import ZatcaSyncWidget from "./ZatcaSyncWidget";
import EmployeesDashboardWidget from "./EmployeesDashboardWidget";
import DashboardInsights from "./DashboardInsights";
import "../../pages/Dashboard.css";

export default function AdminDashboard({ stats }) {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const showProfit = settings.dashboard_admin_show_profit !== "0";
  const showPurchases = settings.dashboard_admin_show_purchases !== "0";
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Overview for ${settings.store_name || "your store"} — sales, stock, and profit.`}
      />

      <div className="dashboard-stats">
        <StatCard
          label="Today's Sales (Net)"
          value={formatCurrency(stats.todaySales, currency)}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          label="Today's Returns"
          value={formatCurrency(stats.todayReturns, currency)}
          icon={RotateCcw}
          variant="warning"
        />
        {showPurchases && (
          <StatCard
            label="Today's Purchases"
            value={formatCurrency(stats.todayPurchases, currency)}
            icon={ShoppingBag}
            variant="info"
          />
        )}
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          icon={Package}
          variant="success"
        />
        <StatCard
          label="Total Customers"
          value={stats.totalCustomers}
          icon={Users}
          variant="info"
        />
        <StatCard
          label="Low Stock Items"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          label="Monthly Revenue (Net)"
          value={formatCurrency(stats.monthlyRevenue, currency)}
          icon={TrendingUp}
          variant="primary"
        />
        <StatCard
          label="Monthly Returns"
          value={formatCurrency(stats.monthlyReturns, currency)}
          icon={RotateCcw}
          variant="warning"
        />
        {showProfit && (
          <StatCard
            label="Monthly Profit"
            value={formatCurrency(stats.monthlyProfit, currency)}
            icon={Wallet}
            variant={stats.monthlyProfit >= 0 ? "success" : "danger"}
          />
        )}
      </div>

      <EmployeesDashboardWidget employees={stats.employees} currency={currency} />

      <DashboardInsights
        insights={stats.smartInsights}
        topProducts={stats.topProducts}
        currency={currency}
      />

      <div className="dashboard-grid">
        <Card>
          <div className="card-header">
            <h3 className="card-title">Recent Sales</h3>
          </div>
          {stats.recentSales.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No sales yet</p>
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

        <Card>
          <div className="card-header">
            <h3 className="card-title">Recent Returns</h3>
          </div>
          {stats.recentReturns?.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No returns yet</p>
          ) : (
            <div className="recent-sales-list">
              {stats.recentReturns.map((ret) => (
                <div key={ret.id} className="recent-sale-item">
                  <div>
                    <strong>{ret.return_number}</strong>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
                      {ret.sale_number} · {ret.customer_name || "Walk-in"} · {formatDateTime(ret.created_at)}
                    </div>
                  </div>
                  <strong style={{ color: "var(--color-danger)" }}>
                    −{formatCurrency(ret.total_refund, currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
          {(stats.recentReturns?.length ?? 0) > 0 && (
            <button
              type="button"
              className="dashboard-link-btn"
              onClick={() => navigate("/orders")}
            >
              View all orders →
            </button>
          )}
        </Card>

        <ZatcaSyncWidget />

        <Card>
          <div className="card-header">
            <h3 className="card-title">Low Stock Alert</h3>
          </div>
          {stats.lowStock.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              All products are well stocked
            </p>
          ) : (
            <div className="low-stock-list">
              {stats.lowStock.slice(0, 8).map((product) => (
                <div key={product.id} className="low-stock-item">
                  <span>{product.name}</span>
                  <Badge variant={product.quantity <= 0 ? "danger" : "warning"}>
                    {product.quantity} / min {product.min_stock}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {stats.lowStock.length > 0 && (
            <button
              type="button"
              className="dashboard-link-btn"
              onClick={() => navigate("/inventory")}
            >
              View inventory →
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}
