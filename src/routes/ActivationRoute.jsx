import { Navigate } from "react-router-dom";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { isInstallationRegistered } from "../utils/activationConfig";

export default function ActivationRoute({ children }) {
  const settings = useSettingsStore((s) => s.settings);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isInstallationRegistered(settings) && !isAuthenticated) {
    return <Navigate to="/setup" replace />;
  }

  return children;
}
