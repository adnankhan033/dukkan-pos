import { useEffect, useState } from "react";
import { reportService } from "../services/ReportService";
import { useSettingsStore } from "../contexts/store";
import PageHeader from "../components/common/PageHeader";
import { Card, StatCard } from "../components/common/Card";
import Table from "../components/common/Table";
import { LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatDateTime, todayISO } from "../utils/format";
import { DollarSign, ShoppingBag, Receipt, TrendingUp } from "lucide-react";

export default function Reports() {
  const currency = useSettingsStore((s) => s.settings.currency) || "SAR";
  const [loading, setLoading] = useState(true);
  const [profit, setProfit] = useState(null);
  const [dailySales, setDailySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    async function load() {
      const [profitData, daily, monthly, purchaseData, expenseData, invData] = await Promise.all([
        reportService.getProfitSummary(),
        reportService.getDailySales(todayISO()),
        reportService.getMonthlySales(),
        reportService.getMonthlyPurchases(),
        reportService.getMonthlyExpenses(),
        reportService.getInventoryReport(),
      ]);
      setProfit(profitData);
      setDailySales(daily);
      setMonthlySales(monthly);
      setPurchases(purchaseData);
      setExpenses(expenseData);
      setInventory(invData.items);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading reports..." />;

  const salesColumns = [
    { key: "sale_number", label: "Sale #" },
    { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "Walk-in" },
    { key: "total", label: "Total", render: (r) => formatCurrency(r.total, currency) },
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
      <PageHeader title="Reports" subtitle="Sales, purchases, expenses, profit, and inventory overview." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatCard label="Monthly Revenue" value={formatCurrency(profit.monthlyRevenue, currency)} icon={DollarSign} variant="primary" />
        <StatCard label="Monthly Purchases" value={formatCurrency(profit.monthlyPurchases, currency)} icon={ShoppingBag} variant="info" />
        <StatCard label="Monthly Expenses" value={formatCurrency(profit.monthlyExpenses, currency)} icon={Receipt} variant="warning" />
        <StatCard label="Net Profit" value={formatCurrency(profit.netProfit, currency)} icon={TrendingUp} variant={profit.netProfit >= 0 ? "success" : "danger"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Today's Sales</h3>
          <Table columns={salesColumns} data={dailySales} emptyMessage="No sales today" />
        </Card>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Monthly Sales</h3>
          <Table columns={salesColumns} data={monthlySales.slice(0, 10)} emptyMessage="No sales this month" />
        </Card>
        <Card>
          <h3 className="card-title" style={{ marginBottom: "1rem" }}>Monthly Purchases</h3>
          <Table columns={[
            { key: "purchase_number", label: "PO #" },
            { key: "supplier_name", label: "Supplier", render: (r) => r.supplier_name || "-" },
            { key: "total", label: "Total", render: (r) => formatCurrency(r.total, currency) },
          ]} data={purchases.slice(0, 10)} emptyMessage="No purchases this month" />
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
