import { useNavigate } from "react-router-dom";
import { Banknote, Briefcase, UserCheck, Users, Wallet } from "lucide-react";
import { Card, StatCard } from "../common/Card";
import { formatCurrency } from "../../utils/format";
import "../../pages/Dashboard.css";

export default function EmployeesDashboardWidget({ employees, currency }) {
  const navigate = useNavigate();

  if (!employees) return null;

  const netMonthly = employees.monthlySalary - employees.monthlyAdvance;

  return (
    <section className="dashboard-employees-section">
      <div className="dashboard-section-header">
        <div>
          <h2 className="dashboard-section-title">Employees &amp; Payroll</h2>
          <p className="dashboard-section-subtitle">
            Team size and salary payments for this month.
          </p>
        </div>
        <button
          type="button"
          className="dashboard-link-btn"
          onClick={() => navigate("/employees")}
        >
          Manage employees →
        </button>
      </div>

      <div className="dashboard-stats dashboard-employees-stats">
        <StatCard
          label="Total Employees"
          value={employees.total}
          icon={Users}
          variant="primary"
        />
        <StatCard
          label="Currently Working"
          value={employees.current}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          label="Finished"
          value={employees.finished}
          icon={Briefcase}
          variant="info"
        />
        <StatCard
          label="Salaries (This Month)"
          value={formatCurrency(employees.monthlySalary, currency)}
          icon={Banknote}
        />
        <StatCard
          label="Advances (This Month)"
          value={formatCurrency(employees.monthlyAdvance, currency)}
          icon={Wallet}
          variant="warning"
        />
      </div>

      <Card className="dashboard-employees-summary-card">
        <div className="dashboard-employees-summary-grid">
          <div>
            <span>Payments this month</span>
            <strong>{employees.monthlyPayments}</strong>
          </div>
          <div>
            <span>Net payroll this month</span>
            <strong>{formatCurrency(netMonthly, currency)}</strong>
          </div>
          <div>
            <span>Total salaries paid</span>
            <strong>{formatCurrency(employees.totalSalaryPaid, currency)}</strong>
          </div>
          <div>
            <span>Total advances paid</span>
            <strong>{formatCurrency(employees.totalAdvancePaid, currency)}</strong>
          </div>
        </div>
      </Card>
    </section>
  );
}
