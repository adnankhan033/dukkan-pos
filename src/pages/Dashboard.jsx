import { useEffect, useState } from "react";
import {
  DollarSign,
  ShoppingBag,
  Package,
  Users,
  AlertTriangle,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { dashboardService } from "../services/DashboardService";
import { useSettingsStore } from "../contexts/store";
import PageHeader from "../components/common/PageHeader";
import { StatCard, Card } from "../components/common/Card";
import { LoadingSpinner } from "../components/common/Loading";
import Badge from "../components/common/Badge";
import { formatCurrency, formatDateTime } from "../utils/format";
import "./Dashboard.css";

export default function Dashboard() {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await dashboardService.getStats();
        setStats(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back — here's what's happening at ${settings.store_name || "your store"} today.`}
      />

      <div className="dashboard-stats">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(stats.todaySales, currency)}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          label="Today's Purchases"
          value={formatCurrency(stats.todayPurchases, currency)}
          icon={ShoppingBag}
          variant="info"
        />
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
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue, currency)}
          icon={TrendingUp}
          variant="primary"
        />
        <StatCard
          label="Monthly Profit"
          value={formatCurrency(stats.monthlyProfit, currency)}
          icon={Wallet}
          variant={stats.monthlyProfit >= 0 ? "success" : "danger"}
        />
      </div>

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
            <h3 className="card-title">Low Stock Alert</h3>
          </div>
          {stats.lowStock.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>All products are well stocked</p>
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
        </Card>
      </div>
    </div>
  );
}
