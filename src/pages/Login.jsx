import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { userService } from "../services/UserService";
import { useAuthStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { getDefaultRouteForUser } from "../utils/modules";
import { useSettingsStore } from "../contexts/store";
import { Input } from "../components/common/Input";
import Button from "../components/common/Button";
import { Alert } from "../components/common/Loading";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { submitting, guard } = useSubmitGuard();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await guard(async () => {
        const user = await userService.authenticate(username, password);
        if (!user) {
          setError("Invalid username or password");
          return;
        }
        login(user);
        const settings = useSettingsStore.getState().settings;
        navigate(getDefaultRouteForUser(user, settings));
      });
    } catch (err) {
      setError(err.message || "Login failed");
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <h1>Portal POS</h1>
        <p>Sign in to your point of sale system</p>
      </div>

      {notice && <Alert type="success">{notice}</Alert>}
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
          {submitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)", textAlign: "center" }}>
        Admin: admin / admin123 · Cashier: cashier / cashier123
      </p>
    </div>
  );
}
