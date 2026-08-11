import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";
import { useSettingsStore } from "../contexts/store";
import { getDefaultRouteForUser } from "../utils/modules";
import { Alert } from "../components/common/Loading";

export default function RoleRoute({ children }) {
  const location = useLocation();
  const settings = useSettingsStore((s) => s.settings);
  const { user, canAccessPath } = usePermissions();

  const allowed = canAccessPath(location.pathname);

  if (!allowed) {
    const fallback = getDefaultRouteForUser(user, settings);
    if (location.pathname !== fallback) {
      return <Navigate to={fallback} replace />;
    }
    return (
      <div style={{ padding: "2rem" }}>
        <Alert>You do not have permission to access this page.</Alert>
      </div>
    );
  }

  return children;
}
