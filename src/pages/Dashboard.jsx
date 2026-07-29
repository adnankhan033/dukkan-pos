import { useEffect, useState } from "react";
import { dashboardService } from "../services/DashboardService";
import { usePermissions } from "../hooks/usePermissions";
import { LoadingSpinner } from "../components/common/Loading";
import AdminDashboard from "../components/dashboard/AdminDashboard";
import CashierDashboard from "../components/dashboard/CashierDashboard";

export default function Dashboard() {
  const { isAdmin } = usePermissions();
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

  return isAdmin ? (
    <AdminDashboard stats={stats} />
  ) : (
    <CashierDashboard stats={stats} />
  );
}
