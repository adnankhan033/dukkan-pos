import { Navigate } from "react-router-dom";
import { useSettingsStore } from "../contexts/store";
import { isSystemActivated } from "../utils/activationConfig";

export default function DefaultRedirect() {
  const settings = useSettingsStore((s) => s.settings);

  if (!isSystemActivated(settings)) {
    return <Navigate to="/activate" replace />;
  }

  return <Navigate to="/" replace />;
}
