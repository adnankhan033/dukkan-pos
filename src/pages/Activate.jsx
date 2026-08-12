import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { activationService } from "../services/ActivationService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import {
  isSystemActivated,
  normalizeActivationKey,
  ACTIVATION_RECIPIENT_EMAIL,
  ACTIVATION_SETTING_KEYS,
} from "../utils/activationConfig";
import { Input } from "../components/common/Input";
import Button from "../components/common/Button";
import { Alert } from "../components/common/Loading";
import "./Activate.css";

export default function Activate() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const [name, setName] = useState(settings[ACTIVATION_SETTING_KEYS.CUSTOMER_NAME] || "");
  const [phone, setPhone] = useState(settings[ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE] || "");
  const [storeName, setStoreName] = useState(settings[ACTIVATION_SETTING_KEYS.CUSTOMER_STORE] || "");
  const [address, setAddress] = useState(settings[ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS] || "");
  const [activationKey, setActivationKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendError, setResendError] = useState("");
  const { submitting, guard } = useSubmitGuard();
  const { submitting: registering, guard: registerGuard } = useSubmitGuard();
  const { submitting: resending, guard: resendGuard } = useSubmitGuard();
  const navigate = useNavigate();

  if (isSystemActivated(settings)) {
    return <Navigate to="/login" replace />;
  }

  const registrationSubmitted = Boolean(
    settings[ACTIVATION_SETTING_KEYS.CUSTOMER_NAME]?.trim()
  );
  const emailSent = settings[ACTIVATION_SETTING_KEYS.EMAIL_SENT] === "1";
  const emailError = settings[ACTIVATION_SETTING_KEYS.EMAIL_ERROR] || "";
  const deviceId = settings[ACTIVATION_SETTING_KEYS.DEVICE_ID] || "";

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await registerGuard(async () => {
        const { settings: updated, emailSent: sent, emailError: sendError } =
          await activationService.submitRegistration({
            name,
            phone,
            storeName,
            address,
          });
        setSettings(updated);
        if (sent) {
          setNotice(
            "Registration sent successfully. Enter the activation key once you receive it from the developer."
          );
        } else {
          setError(sendError || "Registration saved but email could not be sent. Use Resend on the next screen.");
        }
      });
    } catch (err) {
      setError(err.message || "Registration failed");
    }
  }

  async function handleActivate(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await guard(async () => {
        const updated = await activationService.activate(activationKey);
        setSettings(updated);
        navigate("/login", {
          replace: true,
          state: { message: "System activated. Sign in to continue." },
        });
      });
    } catch (err) {
      setError(err.message || "Activation failed");
    }
  }

  async function handleResendEmail() {
    setResendError("");
    setNotice("");
    try {
      await resendGuard(async () => {
        const result = await activationService.sendActivationEmail({
          deviceId,
          activationKey: settings[ACTIVATION_SETTING_KEYS.KEY],
          hostname: settings.system_hostname,
          customerName: settings[ACTIVATION_SETTING_KEYS.CUSTOMER_NAME],
          customerPhone: settings[ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE],
          storeName: settings[ACTIVATION_SETTING_KEYS.CUSTOMER_STORE],
          storeAddress: settings[ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS],
        });
        const { settingsService: settingsApi } = await import("../services/SettingsService.js");
        setSettings(await settingsApi.getAll());
        if (result.success) {
          setNotice("Registration email sent again.");
        } else {
          setResendError(result.error || "Could not send registration email.");
        }
      });
    } catch (err) {
      setResendError(err.message || "Could not resend registration email.");
    }
  }

  return (
    <div className="auth-card activate-card">
      <div className="auth-brand">
        <h1>{registrationSubmitted ? "Activate DukkanPOS" : "Register DukkanPOS"}</h1>
        <p>
          {registrationSubmitted
            ? "Enter the activation key you received after registration"
            : "Fill in your details to request activation for this computer"}
        </p>
      </div>

      {notice && <Alert type="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {!registrationSubmitted ? (
        <form onSubmit={handleRegister}>
          <Input
            label="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoFocus
          />
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0501234567"
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Store Name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Your shop or business name"
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Input
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Store address"
            />
          </div>
          <Button
            type="submit"
            className="btn-lg"
            disabled={registering}
            style={{ width: "100%", marginTop: "1.5rem" }}
          >
            {registering ? "Sending..." : "Submit & Send Request"}
          </Button>
          {emailError && (
            <p style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--color-danger)" }}>
              {emailError}
            </p>
          )}
        </form>
      ) : (
        <>
          <div style={{ marginBottom: "1.25rem", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            <p>
              Your registration was sent to <strong>{ACTIVATION_RECIPIENT_EMAIL}</strong>
              {emailSent ? " with your details and activation key." : "."}
              {!emailSent && emailError ? ` Email could not be sent: ${emailError}` : ""}
            </p>
            {deviceId && (
              <p style={{ marginTop: "0.75rem" }}>
                Device ID: <code>{deviceId}</code>
              </p>
            )}
          </div>

          <form onSubmit={handleActivate}>
            <Input
              label="Activation Key"
              value={activationKey}
              onChange={(e) => setActivationKey(normalizeActivationKey(e.target.value))}
              placeholder="DKP-XXXX-XXXX-XXXX"
              autoFocus
            />
            <Button
              type="submit"
              className="btn-lg"
              disabled={submitting}
              style={{ width: "100%", marginTop: "1.5rem" }}
            >
              {submitting ? "Activating..." : "Activate System"}
            </Button>
          </form>

          <div style={{ marginTop: "1rem" }}>
            {resendError && <Alert>{resendError}</Alert>}
            <Button
              type="button"
              variant="secondary"
              disabled={resending}
              style={{ width: "100%" }}
              onClick={handleResendEmail}
            >
              {resending ? "Sending..." : "Resend Registration Email"}
            </Button>
          </div>
        </>
      )}

      <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--color-text-muted)", textAlign: "center" }}>
        After activation, sign in with your username and password.
      </p>
    </div>
  );
}
