import { BrowserRouter } from "react-router-dom";
import { useDatabaseInit } from "./hooks/useDatabaseInit";
import { useTheme } from "./hooks/useTheme";
import { isDesktopApp } from "./utils/environment";
import AppRoutes from "./routes/AppRoutes";
import BrowserNotice from "./components/common/BrowserNotice";
import { LoadingSpinner, Alert } from "./components/common/Loading";
import { ToastProvider } from "./contexts/ToastContext";

function DesktopApp() {
  const { dbReady, dbError } = useDatabaseInit();
  useTheme();

  if (dbError) {
    return (
      <div style={{ padding: "2rem" }}>
        <Alert>Database error: {dbError}</Alert>
      </div>
    );
  }

  if (!dbReady) {
    return <LoadingSpinner message="Initializing DukkanPOS..." />;
  }

  return <AppRoutes />;
}

export default function App() {
  if (!isDesktopApp()) {
    return <BrowserNotice />;
  }

  return (
    <BrowserRouter>
      <ToastProvider>
        <DesktopApp />
      </ToastProvider>
    </BrowserRouter>
  );
}
