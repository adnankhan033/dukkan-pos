import { useEffect, useState } from "react";
import { reportService } from "../services/ReportService";
import { useSettingsStore } from "../contexts/store";
import PageHeader from "../components/common/PageHeader";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import Badge from "../components/common/Badge";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatDateTime, todayISO } from "../utils/format";
import { DollarSign, ShoppingBag, Receipt, TrendingUp, RotateCcw } from "lucide-react";

export default function Reports() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const [loading, setLoading] = useState(true);
  const [profit, setProfit] = useState(null);
  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [profitData, daily, monthly, returns, purchaseData, expenseData, invData] =
          await Promise.all([
            reportService.getProfitSummary(),
            reportService.getDailySales(todayISO()),
            reportService.getMonthlySales(),
            reportService.getMonthlyReturnsList(),
            reportService.getMonthlyPurchases(),
            reportService.getMonthlyExpenses(),
            reportService.getInventoryReport(),
          ]);
        setProfit(profitData);
        setDailySales(daily);
        setMonthlySales(monthly);
        setMonthlyReturns(returns);
        setPurchases(purchaseData);
        setExpenses(expenseData);
        setInventory(invData.items);
      } catch (err) {
        setLoadError(err.message || "Failed to load reports.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading reports..." />;

  if (loadError) {
    return (
      <div>
        <PageHeader title="Reports" subtitle="Sales, returns, expenses, net profit, and inventory." />
        <Alert>{loadError}</Alert>
      </div>
    );
  }

  const salesColumns = [
    { key: "sale_number", label: "Sale #" },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "Walk-in" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge variant={r.status === "returned" ? "danger" : r.status === "partial_return" ? "warning" : "success"}>
          {r.status === "partial_return" ? "Partial Return" : r.status}
        </Badge>
      ),
    },
    { key: "total", label: "Total", render: (r) => formatCurrency(r.total, currency) },
    { key: "created_at", label: "Date", render: (r) => formatDateTime(r.created_at) },
  ];

  const returnColumns = [
    { key: "return_number", label: "Return #" },
    { key: "sale_number", label: "Sale #" },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "Walk-in" },
    { key: "total_refund", label: "Refund", render: (r) => formatCurrency(r.total_refund, currency) },
    { key: "created_at", label: "Date", render: (r) => formatDateTime(r.created_at) },
  ];

  const invColumns = [
    { key: "name", label: "Product" },
    { key: "quantity", label: "Stock" },
    { key: "min_stock", label: "Min Stock" },
    { key: "selling_price", label: "Price", render: (r) => formatCurrency(r.selling_price, currency) },
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales, returns, expenses, net profit, and inventory." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatCard label="Gross Sales" value={formatCurrency(profit.grossSales, currency)} icon={DollarSign} variant="primary" />
        <StatCard label="Returns" value={formatCurrency(profit.returnsTotal, currency)} icon={RotateCcw} variant="warning" />
        <StatCard label="Net Revenue" value={formatCurrency(profit.monthlyRevenue, currency)} icon={TrendingUp} variant="info" />
        <StatCard label="COGS (Net)" value={formatCurrency(profit.cogs, currency)} icon={ShoppingBag} variant="info" />
        <StatCard label="Expenses" value={formatCurrency(profit.monthlyExpenses, currency)} icon={Receipt} variant="warning" />
        <StatCard label="Net Profit" value={formatCurrency(profit.netProfit, currency)} icon={TrendingUp} variant={profit.netProfit >= 0 ? "success" : "danger"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Today&apos;s Sales</h3>
          <Table columns={salesColumns} data={dailySales} emptyMessage="No sales today" />
        </Card>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Monthly Returns</h3>
          <Table columns={returnColumns} data={monthlyReturns.slice(0, 10)} emptyMessage="No returns this month" />
        </Card>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Monthly Sales</h3>
          <Table columns={salesColumns} data={monthlySales.slice(0, 10)} emptyMessage="No sales this month" />
        </Card>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Monthly Expenses</h3>
          <Table columns={[
            { key: "name", label: "Expense" },
            { key: "amount", label: "Amount", render: (r) => formatCurrency(r.amount, currency) },
            { key: "expense_date", label: "Date" },
          ]} data={expenses.slice(0, 10)} emptyMessage="No expenses this month" />
        </Card>
      </div>

      <Card style={{ marginTop: "1.5rem" }}>
        <h3 className="card-title" style={{ marginBottom: "1rem" }}>Inventory Report</h3>
        <Table columns={invColumns} data={inventory.slice(0, 20)} emptyMessage="No products" />
      </Card>
    </div>
  );
}
