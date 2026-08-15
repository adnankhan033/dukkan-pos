import { useNavigate } from "react-router-dom";
import { ShoppingCart, ClipboardList, DollarSign, ArrowRight, Sparkles, Zap } from "lucide-react";
import { useSettingsStore } from "../../contexts/store";
import Button from "../common/Button";
import { StatCard, Card } from "../common/Card";
import { formatCurrency } from "../../utils/format";
import DashboardHero from "./DashboardHero";
import DashboardQuickNav from "./DashboardQuickNav";
import DashboardSalesChart from "./DashboardSalesChart";
import DashboardSectionTitle from "./DashboardSectionTitle";
import DashboardActivityFeed from "./DashboardActivityFeed";
import DashboardInsights from "./DashboardInsights";
import "../../pages/Dashboard.css";
import "./DashboardQuickNav.css";

export default function CashierDashboard({ stats }) {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const showRecent = settings.dashboard_cashier_show_recent !== "0";
  const navigate = useNavigate();
  const heldCount = stats.heldCount ?? 0;

  return (
    <div className="dashboard-page dashboard-page-premium dashboard-page-cashier">
      <DashboardHero
        variant="cashier"
        chips={[
          {
            label: "Held orders",
            value: heldCount,
            tone: heldCount > 0 ? "warn" : "success",
          },
          { label: "Today", value: formatCurrency(stats.todaySales, currency), tone: "primary" },
        ]}
      />

      <button type="button" className="dashboard-mega-cta" onClick={() => navigate("/sales")}>
        <span className="dashboard-mega-cta-glow" aria-hidden="true" />
        <span className="dashboard-mega-cta-icon">
          <Zap size={32} />
        </span>
        <span className="dashboard-mega-cta-body">
          <strong>Start a new sale</strong>
          <span>Tap here — scan items or search products</span>
        </span>
        <ArrowRight size={28} className="dashboard-mega-cta-arrow" />
      </button>

      <DashboardQuickNav variant="cashier" />

      <section className="dashboard-kpi-row dashboard-kpi-row-cashier">
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
        />
        <StatCard
          label="Held Orders"
          value={heldCount}
          numericValue={heldCount}
          icon={ClipboardList}
          variant={heldCount > 0 ? "warning" : "success"}
          featured
          animate={false}
        />
      </section>

      <div className="dashboard-quick-grid">
        <button type="button" className="dashboard-quick-card primary" onClick={() => navigate("/sales")}>
          <div className="dashboard-quick-glow" aria-hidden="true" />
          <div className="dashboard-quick-icon">
            <ShoppingCart size={28} />
          </div>
          <div className="dashboard-quick-body">
            <strong>Open POS</strong>
            <span>Scan barcodes & checkout fast</span>
          </div>
          <ArrowRight size={20} className="dashboard-quick-arrow" />
        </button>
        <button
          type="button"
          className="dashboard-quick-card secondary"
          onClick={() => navigate("/orders")}
        >
          <div className="dashboard-quick-glow" aria-hidden="true" />
          <div className="dashboard-quick-icon">
            <ClipboardList size={28} />
          </div>
          <div className="dashboard-quick-body">
            <strong>Today's Orders</strong>
            <span>Review sales & returns</span>
          </div>
          <ArrowRight size={20} className="dashboard-quick-arrow" />
        </button>
      </div>

      {(stats.weeklyTrend?.length ?? 0) > 0 && (
        <DashboardSalesChart data={stats.weeklyTrend} currency={currency} />
      )}

      <DashboardInsights
        insights={(stats.smartInsights || []).slice(0, 3)}
        topProducts={(stats.topProducts || []).slice(0, 3)}
        currency={currency}
      />

      {showRecent && (
        <>
          <DashboardSectionTitle
            title="Your latest sales"
            subtitle="Tap a row to open orders"
          />
          <Card className="dashboard-panel dashboard-glass">
            <DashboardActivityFeed
              items={stats.recentSales}
              currency={currency}
              type="sale"
              emptyIcon={Sparkles}
              emptyTitle="No sales yet today"
              emptyHint="Your first sale of the day will appear here."
              emptyAction={
                <Button style={{ marginTop: "0.75rem" }} onClick={() => navigate("/sales")}>
                  Open POS
                </Button>
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}
