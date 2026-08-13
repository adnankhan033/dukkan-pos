import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { isDrupalConfigured } from "../api/apiConfig";

export default function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const settings = useSettingsStore((s) => s.settings);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isDrupalConfigured(settings) && !token) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location,
          message:
            "Your store uses Drupal as the backend. Sign in with your Drupal POS account (e.g. admin / admin123).",
        }}
        replace
      />
    );
  }

  return children;
}
