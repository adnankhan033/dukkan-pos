import { useEffect, useState } from "react";
import { dashboardService } from "../services/DashboardService";
import { getDashboardCacheEntry } from "../services/DashboardCache";
import { usePermissions } from "../hooks/usePermissions";
import { LoadingSpinner } from "../components/common/Loading";
import AdminDashboard from "../components/dashboard/AdminDashboard";
import CashierDashboard from "../components/dashboard/CashierDashboard";

export default function Dashboard() {
  const { isAdmin } = usePermissions();
  const [stats, setStats] = useState(() => getDashboardCacheEntry());
  const [loading, setLoading] = useState(() => !getDashboardCacheEntry());

  useEffect(() => {
    let cancelled = false;
    const cached = getDashboardCacheEntry();
    if (cached) {
      setStats(cached);
      setLoading(false);
    }

    (async () => {
      try {
        const data = await dashboardService.refreshStatsCache();
        if (!cancelled && data) setStats(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  return isAdmin ? (
    <AdminDashboard stats={stats} />
  ) : (
    <CashierDashboard stats={stats} />
  );
}
