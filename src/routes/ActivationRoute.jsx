import { Navigate } from "react-router-dom";
import { useSettingsStore } from "../contexts/store";
import { isSystemActivated } from "../utils/activationConfig";

export default function ActivationRoute({ children }) {
  const settings = useSettingsStore((s) => s.settings);

  if (!isSystemActivated(settings)) {
    return <Navigate to="/activate" replace />;
  }

  return children;
}
