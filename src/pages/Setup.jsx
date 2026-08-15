import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { activationService } from "../services/ActivationService";
import { userService } from "../services/UserService";
import { settingsService } from "../services/SettingsService";
import { useAuthStore, useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { getDefaultRouteForUser } from "../utils/modules";
import {
  ACTIVATION_RECIPIENT_EMAIL,
  ACTIVATION_SETTING_KEYS,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  isInstallationRegistered,
  normalizeActivationKey,
  REGISTRATION_STATUS,
  resolveActivationSmtpFromEnv,
} from "../utils/activationConfig";
import { decodeBackupSecret } from "../utils/backupSettings";
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
  const [senderGmail, setSenderGmail] = useState(
    () =>
      settings[ACTIVATION_SETTING_KEYS.GMAIL]?.trim() ||
      resolveActivationSmtpFromEnv()?.gmail ||
      ACTIVATION_RECIPIENT_EMAIL
  );
  const [senderAppPassword, setSenderAppPassword] = useState(
    () => resolveActivationSmtpFromEnv()?.appPassword || ""
  );
  const [activationKey, setActivationKey] = useState("");
  const [username, setUsername] = useState(DEFAULT_ADMIN_USERNAME);
  const [password, setPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    const savedGmail = settings[ACTIVATION_SETTING_KEYS.GMAIL]?.trim();
    const savedPassword = decodeBackupSecret(
      settings[ACTIVATION_SETTING_KEYS.GMAIL_APP_PASSWORD]
    );
    if (savedGmail) setSenderGmail(savedGmail);
    if (savedPassword) setSenderAppPassword(savedPassword);

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
        const result = await activationService.submitRegistration({
          storeName,
          phone,
          address,
          gmail: senderGmail,
          appPassword: senderAppPassword,
        });
        setSettings(result.settings);
        if (result.emailSent) {
          setInfo(
            `Email sent to ${ACTIVATION_RECIPIENT_EMAIL} with your store details and activation key.`
          );
          setPhase("key");
        } else {
          setError(
            result.emailError ||
              "Could not send email. Check your Gmail App Password and try again."
          );
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
        const result = await activationService.activateLocalKey(activationKey);
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
        login(result.user, result.session ?? {});
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
          ? "Enter store details and your Gmail App Password to send the activation email."
          : phase === "key"
            ? `Enter the activation key sent to ${ACTIVATION_RECIPIENT_EMAIL}.`
            : "Use your super admin account to access your store."
      }
      footer={
        phase === "details"
          ? `An activation key will be emailed to ${ACTIVATION_RECIPIENT_EMAIL}.`
          : phase === "key"
            ? "Enter the key you received by email to continue."
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

          <div className="setup-email-section">
            <p className="setup-email-title">Email settings (to send activation key)</p>
            <p className="setup-field-hint">
              Email will be sent to <strong>{ACTIVATION_RECIPIENT_EMAIL}</strong>. Use a Google
              App Password from your Google Account → Security → App passwords.
            </p>
            <div className="setup-form-gap">
              <Input
                label="Sender Gmail"
                type="email"
                value={senderGmail}
                onChange={(e) => setSenderGmail(e.target.value)}
                placeholder="dev.adnankhan@gmail.com"
                required
              />
            </div>
            <div className="setup-form-gap">
              <Input
                label="Gmail App Password"
                type="password"
                value={senderAppPassword}
                onChange={(e) => setSenderAppPassword(e.target.value.replace(/\s+/g, ""))}
                placeholder="16-character app password"
                required
              />
            </div>
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
          <Input
            label="Activation Key"
            value={activationKey}
            onChange={(e) => setActivationKey(normalizeActivationKey(e.target.value))}
            placeholder="DKP-XXXX-XXXX-XXXX"
            autoFocus
            className="setup-key-input"
          />
          <p className="setup-field-hint">
            Paste the key from your email at {ACTIVATION_RECIPIENT_EMAIL}.
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
          <div className="setup-admin-hint">
            <p>Your super admin account:</p>
            <ul>
              <li><strong>Username:</strong> {DEFAULT_ADMIN_USERNAME}</li>
              <li><strong>Password:</strong> {DEFAULT_ADMIN_PASSWORD}</li>
            </ul>
          </div>
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
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
