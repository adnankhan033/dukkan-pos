import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import DrupalStatusBar from "../components/layout/DrupalStatusBar";
import ZatcaSyncIndicator from "../components/zatca/ZatcaSyncIndicator";
import SubscriptionBlocked from "../components/subscriptions/SubscriptionBlocked";
import WelcomeModal from "../components/auth/WelcomeModal";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { useSubscription } from "../hooks/useSubscription";
import { LoadingSpinner } from "../components/common/Loading";
import { settingsService } from "../services/SettingsService";
import { ACTIVATION_SETTING_KEYS } from "../utils/activationConfig";
import { verifyDrupalSession } from "../api/drupalBootstrap";
import { startCatalogSyncPolling, stopCatalogSyncPolling } from "../services/CatalogSync";
import "./MainLayout.css";

export default function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const drupalConnected = useAuthStore((s) => s.drupalConnected);
  const logout = useAuthStore((s) => s.logout);
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const { subscription, loading, allowsAccess, isAdmin, refresh } = useSubscription();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const initialCheck = !isAdmin && loading && subscription === null;

  useEffect(() => {
    if (!drupalConnected) {
      stopCatalogSyncPolling();
      return undefined;
    }

    startCatalogSyncPolling();
    return () => {
      stopCatalogSyncPolling();
    };
  }, [drupalConnected]);

  useEffect(() => {
    if (!drupalConnected) return;

    let cancelled = false;
    verifyDrupalSession().catch(() => {
      if (cancelled) return;
      logout();
      navigate("/login", {
        replace: true,
        state: { message: "Drupal session expired. Please sign in again." },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [drupalConnected, logout, navigate]);

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

      <div className="main-layout">
        <Sidebar />
        <main className="main-content">
          <DrupalStatusBar />
          <ZatcaSyncIndicator />
          <Outlet />
        </main>
      </div>
    </>
  );
}
