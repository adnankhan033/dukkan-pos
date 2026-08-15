import { Navigate } from "react-router-dom";
import { useSettingsStore } from "../contexts/store";
import { isInstallationRegistered } from "../utils/activationConfig";

export default function ActivationRoute({ children }) {
  const settings = useSettingsStore((s) => s.settings);

  if (!isInstallationRegistered(settings)) {
    return <Navigate to="/setup" replace />;
  }

  return children;
}
