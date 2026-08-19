import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activationService } from "../services/ActivationService";
import { userService } from "../services/UserService";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { getDefaultRouteForUser } from "../utils/modules";
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
  const { submitting, guard } = useSubmitGuard();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message;

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
    try {
      await guard(async () => {
        const result = await userService.authenticate(username, password);
        if (!result?.user) {
          setError("Invalid username or password");
          return;
        }
        login(result.user);

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
      formTitle="Sign In"
      formSubtitle="Enter your credentials to access your store"
      footer="Nexttel POS · Secure store sign-in"
    >
      {notice && <Alert type="warning">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
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
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <button type="button" className="setup-back-link" onClick={handleStartOver}>
        Start setup from step 1
      </button>
    </AuthShell>
  );
}
