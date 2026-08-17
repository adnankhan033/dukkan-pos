import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import ZatcaSyncIndicator from "../components/zatca/ZatcaSyncIndicator";
import SubscriptionBlocked from "../components/subscriptions/SubscriptionBlocked";
import WelcomeModal from "../components/auth/WelcomeModal";
import { useAuthStore, useSettingsStore, useSidebarStore } from "../contexts/store";
import { useSubscription } from "../hooks/useSubscription";
import { LoadingSpinner } from "../components/common/Loading";
import { settingsService } from "../services/SettingsService";
import { ACTIVATION_SETTING_KEYS } from "../utils/activationConfig";
import "./MainLayout.css";

export default function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const { subscription, loading, allowsAccess, isAdmin, refresh } = useSubscription();
  const mode = useSidebarStore((s) => s.mode);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const initialCheck = !isAdmin && loading && subscription === null;

  useEffect(() => {
    if (settings[ACTIVATION_SETTING_KEYS.WELCOME_SHOWN] === "1") {
      return;
    }

    if (location.state?.showWelcome === true) {
      setWelcomeOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    setWelcomeOpen(true);
  }, [location.pathname, location.state?.showWelcome, navigate, settings]);

  async function handleWelcomeContinue() {
    setWelcomeOpen(false);
    await settingsService.set(ACTIVATION_SETTING_KEYS.WELCOME_SHOWN, "1");
    setSettings(await settingsService.getAll());
  }

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

  const storeName =
    settings.store_name ||
    settings[ACTIVATION_SETTING_KEYS.CUSTOMER_STORE] ||
    "your store";

  return (
    <>
      <WelcomeModal
        open={welcomeOpen}
        userName={user?.full_name || user?.username}
        storeName={storeName}
        onContinue={handleWelcomeContinue}
      />

      <div className={`main-layout sidebar-mode-${mode}`}>
        <Sidebar />
        <main className="main-content">
          <ZatcaSyncIndicator />
          <Outlet />
        </main>
      </div>
    </>
  );
}
