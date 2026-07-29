import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";
import { getDefaultRouteForUser } from "../utils/roles";
import { ROUTE_MODULE_MAP } from "../utils/modules";
import { Alert } from "../components/common/Loading";

export default function RoleRoute({ children, module: moduleProp }) {
  const location = useLocation();
  const { user, canAccessPath, canAccessModule } = usePermissions();

  const moduleId = moduleProp || ROUTE_MODULE_MAP[location.pathname];
  const allowed = moduleId
    ? canAccessModule(moduleId)
    : canAccessPath(location.pathname);

  if (!allowed) {
    const fallback = getDefaultRouteForUser(user);
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
