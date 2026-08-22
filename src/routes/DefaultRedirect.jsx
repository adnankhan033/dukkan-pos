import { Navigate } from "react-router-dom";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { isInstallationRegistered } from "../utils/activationConfig";

export default function DefaultRedirect() {
  const settings = useSettingsStore((s) => s.settings);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to={isInstallationRegistered(settings) ? "/login" : "/setup"} replace />;
  }

  return <Navigate to="/" replace />;
}
