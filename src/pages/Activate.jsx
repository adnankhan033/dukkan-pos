import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { activationService } from "../services/ActivationService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import {
  isSystemActivated,
  normalizeActivationKey,
} from "../utils/activationConfig";
import {
  DEFAULT_DRUPAL_API_URL,
  normalizeApiBaseUrl,
} from "../api/apiConfig";
import { Input } from "../components/common/Input";
import Button from "../components/common/Button";
import { Alert } from "../components/common/Loading";
import AuthShell from "../components/auth/AuthShell";
import "./Activate.css";

function resolveDefaultServerUrl() {
  const fromEnv = normalizeApiBaseUrl(import.meta.env.VITE_DRUPAL_API_URL);
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return normalizeApiBaseUrl(DEFAULT_DRUPAL_API_URL);
  return "";
}

export default function Activate() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const defaultServerUrl = useMemo(() => resolveDefaultServerUrl(), []);
  const hideServerField = Boolean(defaultServerUrl) && !import.meta.env.DEV;

  const [serverUrl, setServerUrl] = useState(
    normalizeApiBaseUrl(settings.api_base_url) || defaultServerUrl
  );
  const [activationKey, setActivationKey] = useState("");
  const [previewMarket, setPreviewMarket] = useState("");
  const [error, setError] = useState("");
  const { submitting, guard } = useSubmitGuard();
  const navigate = useNavigate();

  if (isSystemActivated(settings)) {
    return <Navigate to="/login" replace />;
  }

  async function handleActivate(e) {
    e.preventDefault();
    setError("");
    setPreviewMarket("");
    try {
      await guard(async () => {
        const result = await activationService.activateWithDrupal(serverUrl, activationKey);
        setSettings(result.settings);
        setPreviewMarket(result.marketName || "");
        navigate("/login", {
          replace: true,
          state: {
            showWelcome: true,
            message: result.marketName
              ? `Connected to ${result.marketName}. Sign in with your POS username.`
              : "Connected to your market. Sign in with your POS username.",
          },
        });
      });
    } catch (err) {
      setError(err.message || "Activation failed");
    }
  }

  return (
    <AuthShell
      wide
      step={1}
      formTitle="Connect Your Market"
      formSubtitle="Enter the server URL and activation key from your market admin panel. After connecting, sign in with your POS user."
      footer="Need help? Ask your market admin for the key from Drupal → Dukkan POS → Market setup."
    >
      <div className="activate-onboarding">
        <div className="activate-onboarding-step">
          <span className="activate-onboarding-num">1</span>
          <div>
            <strong>Server URL</strong>
            <p>Your Drupal market site address</p>
          </div>
        </div>
        <div className="activate-onboarding-step">
          <span className="activate-onboarding-num">2</span>
          <div>
            <strong>Activation key</strong>
            <p>One-time key from Market setup</p>
          </div>
        </div>
        <div className="activate-onboarding-step">
          <span className="activate-onboarding-num">3</span>
          <div>
            <strong>Sign in</strong>
            <p>Use your POS username and password</p>
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {previewMarket && (
        <Alert type="success">
          Connected to <strong>{previewMarket}</strong>
        </Alert>
      )}

      <form onSubmit={handleActivate} className="activate-form">
        {!hideServerField && (
          <>
            <Input
              label="Server URL"
              value={serverUrl}
              onChange={(e) => setServerUrl(normalizeApiBaseUrl(e.target.value))}
              placeholder="https://your-market.example.com"
              autoFocus
            />
            <p className="activate-field-hint">
              Same URL shown on the Market setup page in Drupal admin.
            </p>
          </>
        )}

        <div className={hideServerField ? "" : "activate-form-gap"}>
          <Input
            label="Activation Key"
            value={activationKey}
            onChange={(e) => setActivationKey(normalizeActivationKey(e.target.value))}
            placeholder="DKP-XXXX-XXXX-XXXX"
            autoFocus={hideServerField}
            className="activate-key-input"
          />
        </div>

        {hideServerField && (
          <p className="activate-server-note">
            Server: <code>{serverUrl}</code>
          </p>
        )}

        <Button
          type="submit"
          className="btn-lg activate-submit"
          disabled={submitting}
        >
          {submitting ? "Connecting to your market…" : "Connect & Continue to Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}
