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
  ShoppingCart,
  BarChart3,
  Boxes,
} from "lucide-react";
import { useSettingsStore } from "../../contexts/store";
import Button from "../common/Button";
import { StatCard, Card } from "../common/Card";
import Badge from "../common/Badge";
import DashboardHero from "./DashboardHero";
import DashboardQuickNav from "./DashboardQuickNav";
import DashboardSalesChart from "./DashboardSalesChart";
import DashboardHealthScore from "./DashboardHealthScore";
import DashboardMetricTiles from "./DashboardMetricTiles";
import DashboardSectionTitle from "./DashboardSectionTitle";
import DashboardActivityFeed from "./DashboardActivityFeed";
import ZatcaSyncWidget from "./ZatcaSyncWidget";
import EmployeesDashboardWidget from "./EmployeesDashboardWidget";
import DashboardInsights from "./DashboardInsights";
import { formatCurrency } from "../../utils/format";
import "../../pages/Dashboard.css";
import "./DashboardQuickNav.css";

export default function AdminDashboard({ stats }) {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const showProfit = settings.dashboard_admin_show_profit !== "0";
  const showPurchases = settings.dashboard_admin_show_purchases !== "0";
  const navigate = useNavigate();

  const sideMetrics = [
    {
      label: "Today's returns",
      value: stats.todayReturns,
      currency,
      icon: RotateCcw,
      tone: "warn",
      path: "/orders",
      hint: "Tap to view",
    },
    ...(showPurchases
      ? [
          {
            label: "Today's purchases",
            value: stats.todayPurchases,
            currency,
            icon: ShoppingBag,
            tone: "info",
            path: "/purchases",
          },
        ]
      : []),
    {
      label: "Low stock items",
      value: stats.lowStockCount,
      icon: AlertTriangle,
      tone: stats.lowStockCount > 0 ? "danger" : "success",
      path: "/inventory",
      hint: stats.lowStockCount > 0 ? "Needs attention" : "All good",
    },
    {
      label: "Monthly returns",
      value: stats.monthlyReturns,
      currency,
      icon: RotateCcw,
      tone: "muted",
    },
  ];

  return (
    <div className="dashboard-page dashboard-page-premium">
      <DashboardHero
        variant="admin"
        chips={[
          { label: "Products", value: stats.totalProducts, tone: "primary" },
          { label: "Customers", value: stats.totalCustomers, tone: "info" },
          {
            label: "Low stock",
            value: stats.lowStockCount,
            tone: stats.lowStockCount > 0 ? "warn" : "success",
          },
        ]}
        actions={
          <>
            <Button onClick={() => navigate("/sales")}>
              <ShoppingCart size={16} /> Open POS
            </Button>
            <Button variant="secondary" onClick={() => navigate("/reports")}>
              <BarChart3 size={16} /> Reports
            </Button>
          </>
        }
      />

      <DashboardQuickNav variant="admin" />

      <DashboardSectionTitle
        title="Today's pulse"
        subtitle="Your most important numbers — updated live"
      />

      <section className="dashboard-kpi-row">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(stats.todaySales, currency)}
          numericValue={stats.todaySales}
          currency={currency}
          icon={DollarSign}
          variant="primary"
          featured
          trend={stats.todayTrendPct}
          trendLabel="vs last 6 days"
          delay={0}
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue, currency)}
          numericValue={stats.monthlyRevenue}
          currency={currency}
          icon={TrendingUp}
          variant="success"
          featured
          delay={80}
        />
        {showProfit ? (
          <StatCard
            label="Monthly Profit"
            value={formatCurrency(stats.monthlyProfit, currency)}
            numericValue={stats.monthlyProfit}
            currency={currency}
            icon={Wallet}
            variant={stats.monthlyProfit >= 0 ? "success" : "danger"}
            featured
            delay={160}
          />
        ) : (
          <StatCard
            label="Total Customers"
            value={stats.totalCustomers}
            numericValue={stats.totalCustomers}
            icon={Users}
            variant="info"
            featured
            animate={false}
            delay={160}
          />
        )}
      </section>

      <div className="dashboard-bento">
        <div className="dashboard-bento-main">
          <DashboardSalesChart data={stats.weeklyTrend || []} currency={currency} compact />
        </div>
        <aside className="dashboard-bento-side">
          <DashboardHealthScore stats={stats} />
          <DashboardMetricTiles tiles={sideMetrics} />
        </aside>
      </div>

      <section className="dashboard-stats-scroll-wrap">
        <div className="dashboard-stats-scroll">
          <StatCard
            label="Products"
            value={stats.totalProducts}
            numericValue={stats.totalProducts}
            icon={Package}
            variant="primary"
            animate={false}
          />
          <StatCard
            label="Customers"
            value={stats.totalCustomers}
            numericValue={stats.totalCustomers}
            icon={Users}
            variant="info"
            animate={false}
          />
          <StatCard
            label="Today's Returns"
            value={formatCurrency(stats.todayReturns, currency)}
            numericValue={stats.todayReturns}
            currency={currency}
            icon={RotateCcw}
            variant="warning"
          />
          {showPurchases && (
            <StatCard
              label="Today's Purchases"
              value={formatCurrency(stats.todayPurchases, currency)}
              numericValue={stats.todayPurchases}
              currency={currency}
              icon={ShoppingBag}
              variant="info"
            />
          )}
          <StatCard
            label="Low Stock"
            value={stats.lowStockCount}
            numericValue={stats.lowStockCount}
            icon={AlertTriangle}
            variant="warning"
            animate={false}
          />
        </div>
      </section>

      <EmployeesDashboardWidget employees={stats.employees} currency={currency} />

      <DashboardInsights
        insights={stats.smartInsights}
        topProducts={stats.topProducts}
        currency={currency}
      />

      <DashboardSectionTitle
        title="What's happening now"
        subtitle="Tap any row to open orders"
        action={
          <button type="button" className="dashboard-link-btn" onClick={() => navigate("/orders")}>
            View all →
          </button>
        }
      />

      <div className="dashboard-bento dashboard-bento-activity">
        <Card className="dashboard-panel dashboard-glass dashboard-panel-animated" style={{ "--panel-delay": "0ms" }}>
          <div className="dashboard-panel-header">
            <div className="dashboard-panel-icon primary">
              <ShoppingCart size={18} />
            </div>
            <div>
              <h3 className="card-title">Recent Sales</h3>
              <p className="dashboard-panel-desc">Latest completed transactions</p>
            </div>
          </div>
          <DashboardActivityFeed
            items={stats.recentSales}
            currency={currency}
            type="sale"
            emptyIcon={ShoppingCart}
            emptyTitle="No sales yet"
            emptyHint="Your first sale will show up here instantly."
            emptyAction={
              <Button style={{ marginTop: "0.75rem" }} onClick={() => navigate("/sales")}>
                Open POS
              </Button>
            }
          />
        </Card>

        <div className="dashboard-bento-stack">
          <Card className="dashboard-panel dashboard-glass dashboard-panel-animated" style={{ "--panel-delay": "80ms" }}>
            <div className="dashboard-panel-header">
              <div className="dashboard-panel-icon warning">
                <RotateCcw size={18} />
              </div>
              <div>
                <h3 className="card-title">Recent Returns</h3>
                <p className="dashboard-panel-desc">Refunds & partial returns</p>
              </div>
            </div>
            <DashboardActivityFeed
              items={stats.recentReturns ?? []}
              currency={currency}
              type="return"
              emptyIcon={RotateCcw}
              emptyTitle="No returns"
              emptyHint="That's usually a good sign."
            />
          </Card>

          <Card className="dashboard-panel dashboard-glass dashboard-panel-animated" style={{ "--panel-delay": "160ms" }}>
            <div className="dashboard-panel-header">
              <div className="dashboard-panel-icon danger">
                <Boxes size={18} />
              </div>
              <div>
                <h3 className="card-title">Low Stock</h3>
                <p className="dashboard-panel-desc">Items at minimum level</p>
              </div>
            </div>
            {stats.lowStock.length === 0 ? (
              <div className="dashboard-empty-state success">
                <Boxes size={32} />
                <p>All stocked up</p>
                <span>Every product is above minimum.</span>
              </div>
            ) : (
              <div className="dashboard-stock-list">
                {stats.lowStock.slice(0, 5).map((product) => (
                  <div key={product.id} className="dashboard-stock-item">
                    <span>{product.name}</span>
                    <Badge variant={product.quantity <= 0 ? "danger" : "warning"}>
                      {product.quantity} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {stats.lowStock.length > 0 && (
              <button type="button" className="dashboard-link-btn" onClick={() => navigate("/inventory")}>
                Manage stock →
              </button>
            )}
          </Card>
        </div>
      </div>

      <div className="dashboard-bento-zatca dashboard-panel-animated" style={{ "--panel-delay": "240ms" }}>
        <ZatcaSyncWidget />
      </div>
    </div>
  );
}
