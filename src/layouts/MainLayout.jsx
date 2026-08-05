import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import ZatcaSyncIndicator from "../components/zatca/ZatcaSyncIndicator";
import SubscriptionBlocked from "../components/subscriptions/SubscriptionBlocked";
import { useAuthStore } from "../contexts/store";
import { useSubscription } from "../hooks/useSubscription";
import { LoadingSpinner } from "../components/common/Loading";
import "./MainLayout.css";

export default function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const { subscription, loading, allowsAccess, isAdmin, refresh } = useSubscription();
  const initialCheck = !isAdmin && loading && subscription === null;

  if (initialCheck) {
    return <LoadingSpinner message="Checking subscription..." />;
  }

  if (!isAdmin && !allowsAccess) {
    return (
      <SubscriptionBlocked
        subscription={subscription}
        user={user}
        onRefresh={refresh}
        checking={loading}
      />
    );
  }

  return (
    <div className="main-layout">
      <Sidebar />
      <main className="main-content">
        <ZatcaSyncIndicator />
        <Outlet />
      </main>
    </div>
  );
}
