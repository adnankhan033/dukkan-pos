import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { activationService } from "../services/ActivationService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import {
  isSystemActivated,
  normalizeActivationKey,
  ACTIVATION_SETTING_KEYS,
} from "../utils/activationConfig";
import { Input } from "../components/common/Input";
import Button from "../components/common/Button";
import { Alert } from "../components/common/Loading";
import AuthShell from "../components/auth/AuthShell";

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
            "Your request has been sent. Contact our team for your activation key."
          );
        } else {
          setError(sendError || "Your details were saved, but the request could not be sent. Tap Resend Request on the next screen.");
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
          state: { showWelcome: true },
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
          setNotice("Your request has been sent again. Contact our team for your activation key.");
        } else {
          setResendError(result.error || "Could not send your request. Please try again.");
        }
      });
    } catch (err) {
      setResendError(err.message || "Could not resend registration email.");
    }
  }

  return (
    <AuthShell
      wide
      step={registrationSubmitted ? 2 : 1}
      formTitle={registrationSubmitted ? "Activate System" : "Register Your Store"}
      formSubtitle={
        registrationSubmitted
          ? "Your activation key has been sent to our team. Contact them to receive it, then enter it below to start using DukkanPOS."
          : "Enter your store details to request activation for this computer."
      }
      footer="Once activated, sign in with your username and password."
    >
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
            {registering ? "Sending..." : "Submit Request"}
          </Button>
          {emailError && (
            <p style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--color-danger)" }}>
              {emailError}
            </p>
          )}
        </form>
      ) : (
        <>
          {!emailSent && emailError && (
            <p style={{ marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--color-danger)" }}>
              {emailError}
            </p>
          )}

          {deviceId && (
            <div className="auth-device-id">
              <span className="auth-device-id-label">Device ID</span>
              <code className="auth-device-id-value">{deviceId}</code>
              <p className="auth-device-id-hint">Use this ID to find your request in email.</p>
            </div>
          )}

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
              {resending ? "Sending..." : "Resend Request"}
            </Button>
          </div>
        </>
      )}
    </AuthShell>
  );
}
