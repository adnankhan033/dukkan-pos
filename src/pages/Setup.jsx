import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { activationService } from "../services/ActivationService";
import { userService } from "../services/UserService";
import { settingsService } from "../services/SettingsService";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { getDefaultRouteForUser } from "../utils/modules";
import {
  ACTIVATION_KEY_PREFIX,
  ACTIVATION_RECIPIENT_EMAIL,
  ACTIVATION_SETTING_KEYS,
  activationKeyDigits,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  isInstallationRegistered,
  normalizeActivationKey,
  REGISTRATION_STATUS,
  resolveActivationSenderEmail,
  resolveActivationSmtpFromEnv,
} from "../utils/activationConfig";
import { Input } from "../components/common/Input";
import Button from "../components/common/Button";
import { Alert } from "../components/common/Loading";
import AuthShell from "../components/auth/AuthShell";
import "./Setup.css";

export default function Setup() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const { submitting, guard } = useSubmitGuard();

  const registrationStatus =
    settings[ACTIVATION_SETTING_KEYS.REGISTRATION_STATUS] || REGISTRATION_STATUS.PENDING;
  const emailSent = settings[ACTIVATION_SETTING_KEYS.EMAIL_SENT] === "1";
  const [phase, setPhase] = useState("details");
  const [storeName, setStoreName] = useState(settings[ACTIVATION_SETTING_KEYS.CUSTOMER_STORE] || "");
  const [phone, setPhone] = useState(settings[ACTIVATION_SETTING_KEYS.CUSTOMER_PHONE] || "");
  const [address, setAddress] = useState(settings[ACTIVATION_SETTING_KEYS.CUSTOMER_ADDRESS] || "");
  const [activationKey, setActivationKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (isInstallationRegistered(settings)) {
      setPhase("login");
      return;
    }
    if (registrationStatus === REGISTRATION_STATUS.EMAIL_SENT || emailSent) {
      setPhase("key");
    } else {
      setPhase("details");
    }
  }, [settings, registrationStatus, emailSent]);

  if (isInstallationRegistered(settings) && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleStartOver() {
    setError("");
    try {
      logout();
      const updated = await activationService.resetInstallationSetup();
      setSettings(updated);
      setPhase("details");
      setStoreName("");
      setPhone("");
      setAddress("");
      setActivationKey("");
      setInfo("");
    } catch (err) {
      setError(err.message || "Could not reset setup");
    }
  }

  async function handleSubmitDetails(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      await guard(async () => {
        const smtp = resolveActivationSmtpFromEnv();
        const result = await activationService.submitRegistration({
          storeName,
          phone,
          address,
          gmail: smtp?.gmail || resolveActivationSenderEmail(),
          appPassword: smtp?.appPassword,
        });
        setSettings(result.settings);
        if (result.emailSent) {
          setInfo(
            `Email sent to ${ACTIVATION_RECIPIENT_EMAIL} with your store details and activation key.`
          );
          setPhase("key");
        } else {
          setError(result.emailError || "Could not send the activation email. Please try again.");
        }
      });
    } catch (err) {
      setError(err.message || "Registration failed");
    }
  }

  async function handleSubmitKey(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      await guard(async () => {
        const result = await activationService.activateLocalKey(
          normalizeActivationKey(activationKey)
        );
        setSettings(result.settings);
        await settingsService.set(ACTIVATION_SETTING_KEYS.WELCOME_SHOWN, "0");
        setInfo("Activation successful! Sign in with your admin account below.");
        setPhase("login");
      });
    } catch (err) {
      setError(err.message || "Activation failed");
    }
  }

  async function handleSubmitLogin(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      await guard(async () => {
        const result = await userService.authenticate(username, password);
        if (!result?.user) {
          setError("Invalid username or password");
          return;
        }
        login(result.user);
        navigate(getDefaultRouteForUser(result.user, settings), {
          replace: true,
          state: { showWelcome: true },
        });
      });
    } catch (err) {
      setError(err.message || "Login failed");
    }
  }

  const stepNumber = phase === "details" ? 1 : phase === "key" ? 2 : 3;

  return (
    <AuthShell
      wide
      step={stepNumber}
      formTitle={
        phase === "details"
          ? "Set Up Your Store"
          : phase === "key"
            ? "Enter Activation Key"
            : "Sign In"
      }
      formSubtitle={
        phase === "details"
          ? "Enter store details. An activation key will be emailed after you submit."
          : phase === "key"
            ? `Enter the 6-digit activation key sent to ${ACTIVATION_RECIPIENT_EMAIL}.`
            : "Use your super admin account to access your store."
      }
      footer={
        phase === "details"
          ? null
          : phase === "key"
            ? "Enter the key you received by email to continue."
            : phase === "login"
              ? `Default admin: ${DEFAULT_ADMIN_USERNAME} / ${DEFAULT_ADMIN_PASSWORD}`
              : "After sign-in you will see your dashboard."
      }
    >
      {error && <Alert>{error}</Alert>}
      {info && <Alert type="success">{info}</Alert>}

      {phase === "details" && (
        <form onSubmit={handleSubmitDetails} className="setup-form">
          <Input
            label="Store Name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Your business name"
            autoFocus
            required
          />
          <div className="setup-form-gap">
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966 5X XXX XXXX"
              required
            />
          </div>
          <div className="setup-form-gap">
            <Input
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Store address"
              required
            />
          </div>

          <Button type="submit" className="btn-lg setup-submit" disabled={submitting}>
            {submitting ? "Sending email…" : "Submit & Send Activation Email"}
          </Button>
          <button type="button" className="setup-back-link" onClick={handleStartOver}>
            Clear and start from step 1
          </button>
        </form>
      )}

      {phase === "key" && (
        <form onSubmit={handleSubmitKey} className="setup-form">
          <div className="form-group setup-key-input">
            <label className="form-label" htmlFor="setup-activation-key">
              Activation Key
            </label>
            <div className="setup-key-field">
              <span className="setup-key-prefix">{ACTIVATION_KEY_PREFIX}</span>
              <input
                id="setup-activation-key"
                className="form-input"
                value={activationKeyDigits(activationKey)}
                onChange={(e) => setActivationKey(activationKeyDigits(e.target.value))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                required
              />
            </div>
          </div>
          <p className="setup-field-hint">
            Enter the 6-digit key from your email at {ACTIVATION_RECIPIENT_EMAIL}.
          </p>
          <Button type="submit" className="btn-lg setup-submit" disabled={submitting}>
            {submitting ? "Verifying…" : "Continue to Sign In"}
          </Button>
          <button
            type="button"
            className="setup-back-link"
            onClick={() => setPhase("details")}
          >
            Edit store details
          </button>
        </form>
      )}

      {phase === "login" && (
        <form onSubmit={handleSubmitLogin} className="setup-form">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoFocus
            required
          />
          <div className="setup-form-gap">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <Button type="submit" className="btn-lg setup-submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In & Open Store"}
          </Button>
          <button type="button" className="setup-back-link" onClick={handleStartOver}>
            Start setup from step 1
          </button>
        </form>
      )}
    </AuthShell>
  );
}
