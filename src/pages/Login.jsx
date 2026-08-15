import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activationService } from "../services/ActivationService";
import { userService } from "../services/UserService";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { getDefaultRouteForUser } from "../utils/modules";
import { bootstrapDrupalSession } from "../api/drupalBootstrap";
import { isDrupalConfigured, resolveApiBaseUrl } from "../api/apiConfig";
import { Input } from "../components/common/Input";
import Button from "../components/common/Button";
import { Alert } from "../components/common/Loading";
import AuthShell from "../components/auth/AuthShell";
import { ACTIVATION_SETTING_KEYS } from "../utils/activationConfig";
import "./Setup.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [syncNote, setSyncNote] = useState("");
  const { submitting, guard } = useSubmitGuard();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message;

  const drupalBackend = isDrupalConfigured(settings);
  const backendHost = resolveApiBaseUrl(settings);
  const marketName = settings[ACTIVATION_SETTING_KEYS.MARKET_NAME]?.trim();

  useEffect(() => {
    if (drupalBackend && isAuthenticated && !token) {
      logout();
    }
  }, [drupalBackend, isAuthenticated, token, logout]);

  async function handleStartOver() {
    setError("");
    try {
      logout();
      const updated = await activationService.resetInstallationSetup();
      setSettings(updated);
      navigate("/setup", { replace: true });
    } catch (err) {
      setError(err.message || "Could not reset setup");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSyncNote("");
    try {
      await guard(async () => {
        const result = await userService.authenticate(username, password);
        if (!result?.user) {
          setError(
            drupalBackend
              ? "Invalid Drupal POS username or password"
              : "Invalid username or password"
          );
          return;
        }
        login(result.user, result.session ?? {});

        if (result.session?.token) {
          try {
            setSyncNote("Connecting to Drupal and loading store data…");
            await bootstrapDrupalSession();
          } catch (err) {
            console.warn("Could not sync with Drupal:", err);
            setError(err.message || "Connected but could not load data from Drupal");
            logout();
            return;
          }
        }

        const latestSettings = useSettingsStore.getState().settings;
        const showWelcome =
          location.state?.showWelcome === true ||
          latestSettings[ACTIVATION_SETTING_KEYS.WELCOME_SHOWN] !== "1";
        navigate(getDefaultRouteForUser(result.user, latestSettings), {
          state: showWelcome ? { showWelcome: true } : undefined,
        });
      });
    } catch (err) {
      setError(err.message || "Login failed");
    }
  }

  return (
    <AuthShell
      formTitle={drupalBackend ? (marketName ? `Sign in to ${marketName}` : "Sign in to your market") : "Sign In"}
      formSubtitle={
        drupalBackend
          ? "Products, orders, and users are loaded live from your Drupal backend"
          : "Enter your credentials to access your store"
      }
      footer={
        drupalBackend
          ? `Drupal POS · Terminal ${settings.terminal_code || "REG1"}`
          : "DukkanPOS · Secure store sign-in"
      }
    >
      {notice && <Alert type="warning">{notice}</Alert>}
      {drupalBackend && (
        <Alert type="success">
          Backend: <strong>{backendHost}</strong>
          <br />
          Create products here or in Drupal admin — both use the same database.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {syncNote && !error && <Alert type="success">{syncNote}</Alert>}

      <form onSubmit={handleSubmit}>
        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={drupalBackend ? "Drupal POS username" : "Enter username"}
          autoFocus
        />
        <div style={{ marginTop: "1rem" }}>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>
        <Button type="submit" className="btn-lg" disabled={submitting} style={{ width: "100%", marginTop: "1.5rem" }}>
          {submitting ? (drupalBackend ? "Connecting to Drupal…" : "Signing in…") : "Sign In"}
        </Button>
      </form>

      <button type="button" className="setup-back-link" onClick={handleStartOver}>
        Start setup from step 1
      </button>
    </AuthShell>
  );
}
