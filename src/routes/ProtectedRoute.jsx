import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { isInstallationRegistered } from "../utils/activationConfig";

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const settings = useSettingsStore((s) => s.settings);
  const location = useLocation();

  if (!isAuthenticated) {
    if (isInstallationRegistered(settings)) {
      return <Navigate to="/setup" replace />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
