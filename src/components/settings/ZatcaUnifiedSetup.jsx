import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  Save,
  Zap,
} from "lucide-react";
import { Card } from "../common/Card";
import { Input, Select, Textarea } from "../common/Input";
import Button from "../common/Button";
import { Alert } from "../common/Loading";
import {
  ZATCA_PHASES,
  ZATCA_PHASE_LABELS,
  ZATCA_ENVIRONMENTS,
  ZATCA_ENVIRONMENT_LABELS,
  ZATCA_SETTING_KEYS as K,
  ZATCA_SYNC_SETTINGS,
} from "../../zatca/core/constants";
import { zatcaService } from "../../services/ZatcaService";
import { settingsService } from "../../services/SettingsService";
import { useSettingsStore } from "../../contexts/store";
import {
  getSetupProgress,
  runAutoSetup,
  syncStoreToZatcaFields,
} from "../../zatca/onboarding/autoSetup";
import { csrPemToBase64 } from "../../zatca/onboarding/csrGenerator";
import { zatcaOnboardingService } from "../../zatca/onboarding/ZatcaOnboardingService";
import {
  formatSetupError,
  getUnifiedSetupSteps,
} from "../../zatca/onboarding/setupSteps";
import { parseZatcaConfig } from "../../zatca/core/config";
import {
  getVatCertificateMismatch,
  resolveCertificateVatForStorage,
} from "../../zatca/core/vatResolver";

function StepDot({ done, active }) {
  if (done) return <CheckCircle2 size={20} className="zatca-easy-step-done" />;
  if (active) return <Circle size={20} className="zatca-easy-step-active" />;
  return <Circle size={20} className="zatca-easy-step-pending" />;
}

function HelpLinks({ links }) {
  if (!links?.length) return null;
  return (
    <ul className="zatca-easy-links">
      {links.map((link) => (
        <li key={link.url}>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            {link.label}
          </a>
          {link.hint && <span>{link.hint}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function ZatcaUnifiedSetup({ form, updateField, baseSettings, saveForm }) {
  const setSettings = useSettingsStore((s) => s.setSettings);
  const autoRanRef = useRef(false);

  const mergedSettings = useMemo(
    () => ({ ...baseSettings, ...form }),
    [baseSettings, form]
  );

  const activePhase = form[K.ACTIVE_PHASE];
  const isPhase2 = activePhase === ZATCA_PHASES.PHASE2;
  const stepDefs = useMemo(() => getUnifiedSetupSteps(activePhase), [activePhase]);

  const progress = useMemo(
    () => getSetupProgress(mergedSettings),
    [mergedSettings]
  );

  const status = useMemo(
    () => zatcaService.getStatus(mergedSettings),
    [mergedSettings]
  );

  const zatcaConfig = useMemo(() => parseZatcaConfig(mergedSettings), [mergedSettings]);
  const vatMismatch = useMemo(() => {
    const hasProduction = Boolean(zatcaConfig.credentials?.productionCsid?.trim());
    return getVatCertificateMismatch(zatcaConfig, { production: hasProduction });
  }, [zatcaConfig]);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [otp, setOtp] = useState(form[K.OTP] || "");
  const [copyLabel, setCopyLabel] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const csrBase64 = csrPemToBase64(form[K.CERTIFICATE_REQUEST]) || "";
  const activeStepDef = stepDefs.find((s) => s.id === progress.activeStepId);

  useEffect(() => {
    const synced = syncStoreToZatcaFields(mergedSettings);
    for (const [key, value] of Object.entries(synced)) {
      if (value && !form[key]?.trim()) {
        updateField(key, value);
      }
    }
  }, []);

  useEffect(() => {
    const config = parseZatcaConfig({ ...baseSettings, ...form });
    const complianceVat = resolveCertificateVatForStorage(config, { production: false });
    const productionVat = resolveCertificateVatForStorage(config, { production: true });
    const activeVat = productionVat || complianceVat;

    if (complianceVat && complianceVat !== form[K.COMPLIANCE_CERTIFICATE_VAT]) {
      updateField(K.COMPLIANCE_CERTIFICATE_VAT, complianceVat);
      settingsService.set(K.COMPLIANCE_CERTIFICATE_VAT, complianceVat).catch(() => {});
    }
    if (productionVat && productionVat !== form[K.PRODUCTION_CERTIFICATE_VAT]) {
      updateField(K.PRODUCTION_CERTIFICATE_VAT, productionVat);
      settingsService.set(K.PRODUCTION_CERTIFICATE_VAT, productionVat).catch(() => {});
    }
    if (activeVat && activeVat !== form[K.CERTIFICATE_VAT]) {
      updateField(K.CERTIFICATE_VAT, activeVat);
      settingsService.set(K.CERTIFICATE_VAT, activeVat).catch(() => {});
    }
  }, [form[K.CERTIFICATE], form[K.COMPLIANCE_CSID], form[K.PRODUCTION_CSID]]);

  useEffect(() => {
    setOtp(form[K.OTP] || "");
  }, [form[K.OTP]]);

  async function applySavedFields(savedFields) {
    if (!savedFields) return;
    for (const [key, value] of Object.entries(savedFields)) {
      updateField(key, value);
    }
    const updated = await settingsService.getAll();
    setSettings(updated);
    return updated;
  }

  async function saveSettings(extra = {}) {
    for (const [key, value] of Object.entries(extra)) {
      updateField(key, value);
    }
    const merged = { ...form, ...extra };
    merged[K.ENABLED] =
      merged[K.ACTIVE_PHASE] !== ZATCA_PHASES.DISABLED ? "1" : "0";
    merged.store_name = merged[K.COMPANY_NAME] || merged.store_name || "";
    merged.store_name_ar = merged[K.COMPANY_NAME_AR] || merged.store_name_ar || "";
    merged.cr_number = merged[K.CR_NUMBER] || merged.cr_number || "";
    merged.vat_registration = merged[K.VAT_NUMBER] || merged.vat_registration || "";
    merged.store_address = merged[K.COMPANY_ADDRESS] || merged.store_address || "";

    if (saveForm) {
      return saveForm(merged);
    }

    const updated = await settingsService.updateMany(merged);
    setSettings(updated);
    return updated;
  }

  async function runKeysStep(settings, forceCsr = false) {
    const result = await runAutoSetup(settings, { forceCsr });
    await applySavedFields(result.savedFields);

    if (!result.success) {
      const formatted = formatSetupError(result.message, "keys");
      setNotice({
        type: "error",
        message: formatted.message,
        hint: formatted.hint,
        links: formatted.links,
      });
      return false;
    }

    setNotice({ type: "success", message: result.message });
    return true;
  }

  async function handleSaveAndContinue() {
    setBusy(true);
    setNotice(null);
    autoRanRef.current = true;

    try {
      const saved = await saveSettings();
      zatcaService.restartBackgroundSync();

      if (activePhase === ZATCA_PHASES.DISABLED) {
        setNotice({ type: "success", message: "ZATCA disabled. Select Phase 1 or Phase 2 to begin setup." });
        return;
      }

      if (activePhase === ZATCA_PHASES.PHASE1) {
        const company = getSetupProgress(saved).company;
        if (company.ready) {
          setNotice({
            type: "success",
            message: "Phase 1 is ready! QR codes will appear on receipts after each sale.",
          });
        } else {
          setNotice({
            type: "error",
            message: `Complete these fields:\n• ${company.missing.join("\n• ")}`,
          });
        }
        return;
      }

      const current = getSetupProgress(saved);
      if (!current.company.ready) {
        setNotice({
          type: "error",
          message: `Complete company details first:\n• ${current.company.missing.join("\n• ")}`,
        });
        return;
      }

      if (!current.hasKey || !current.hasCsr) {
        await runKeysStep(saved);
        return;
      }

      if (!current.hasCompliance) {
        setNotice({
          type: "success",
          message: "Keys and CSR are ready. Enter your OTP from the Fatoora portal below (Step 3).",
        });
        return;
      }

      setNotice({
        type: "success",
        message: "Settings saved. Continue with the next step below.",
      });
    } catch (err) {
      const formatted = formatSetupError(err, progress.activeStepId);
      setNotice({
        type: "error",
        message: formatted.message,
        hint: formatted.hint,
        links: formatted.links,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleComplianceCsid() {
    if (!otp.trim()) {
      setNotice({
        type: "error",
        message: "Enter the OTP from the Fatoora Developer Portal.",
        links: getUnifiedSetupSteps(ZATCA_PHASES.PHASE2)[2]?.links,
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    updateField(K.OTP, otp);

    try {
      await saveSettings({ [K.OTP]: otp });
      const result = await zatcaOnboardingService.runStep("compliance_csid", {
        settings: { ...mergedSettings, [K.OTP]: otp },
        formOverrides: { otp },
      });

      if (result.savedFields) await applySavedFields(result.savedFields);

      setNotice({
        type: result.success ? "success" : "error",
        message: result.message,
        ...(result.success
          ? {}
          : formatSetupError(result.message, "compliance")),
      });
    } catch (err) {
      const formatted = formatSetupError(err, "compliance");
      setNotice({
        type: "error",
        message: formatted.message,
        hint: formatted.hint,
        links: formatted.links,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleProductionCsid() {
    setBusy(true);
    setNotice(null);

    try {
      const result = await zatcaOnboardingService.runStep("production_csid", {
        settings: mergedSettings,
        formOverrides: {},
      });

      if (result.savedFields) await applySavedFields(result.savedFields);

      setNotice({
        type: result.success ? "success" : "error",
        message: result.message,
      });
    } catch (err) {
      const formatted = formatSetupError(err, "production");
      setNotice({
        type: "error",
        message: formatted.message,
        hint: formatted.hint,
        links: formatted.links,
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isPhase2 || autoRanRef.current || busy) return;
    if (progress.activeStepId !== "keys") return;
    if (!progress.company.ready) return;
    if (progress.hasKey && progress.hasCsr) return;

    autoRanRef.current = true;
    setBusy(true);
    runAutoSetup(mergedSettings)
      .then(async (result) => {
        await applySavedFields(result.savedFields);
        if (result.success) {
          setNotice({ type: "success", message: result.message });
        } else {
          const formatted = formatSetupError(result.message, "keys");
          setNotice({
            type: "error",
            message: formatted.message,
            hint: formatted.hint,
            links: formatted.links,
          });
        }
      })
      .catch((err) => {
        const formatted = formatSetupError(err, "keys");
        setNotice({
          type: "error",
          message: formatted.message,
          hint: formatted.hint,
          links: formatted.links,
        });
      })
      .finally(() => setBusy(false));
  }, [isPhase2, progress.activeStepId, progress.company.ready, progress.hasKey, progress.hasCsr]);

  function handlePhaseChange(phase) {
    autoRanRef.current = false;
    updateField(K.ACTIVE_PHASE, phase);
    updateField(K.ENABLED, phase !== ZATCA_PHASES.DISABLED ? "1" : "0");
  }

  async function copyCsr() {
    if (!csrBase64) return;
    await navigator.clipboard.writeText(csrBase64);
    setCopyLabel("CSR copied!");
    setTimeout(() => setCopyLabel(""), 2000);
  }

  return (
    <>
      <Card className="settings-card zatca-easy-setup">
        <div className="zatca-easy-header">
          <Zap size={22} className="zatca-easy-icon" />
          <div>
            <h3 className="settings-section-title" style={{ margin: 0 }}>
              ZATCA Setup — One Easy Form
            </h3>
            <p className="settings-section-desc" style={{ margin: "0.25rem 0 0" }}>
              Phase 1 and Phase 2 in one place. Fill company details, save, and we configure
              keys, CSR, and certificates step by step — like the Fatoora platform.
            </p>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: "1.25rem" }}>
          <Select
            label="Integration phase"
            value={form[K.ACTIVE_PHASE]}
            onChange={(e) => handlePhaseChange(e.target.value)}
          >
            <option value={ZATCA_PHASES.DISABLED}>{ZATCA_PHASE_LABELS.disabled}</option>
            <option value={ZATCA_PHASES.PHASE1}>{ZATCA_PHASE_LABELS.phase1}</option>
            <option value={ZATCA_PHASES.PHASE2}>{ZATCA_PHASE_LABELS.phase2}</option>
          </Select>
          <Select
            label="Environment"
            value={form[K.ENVIRONMENT]}
            onChange={(e) => updateField(K.ENVIRONMENT, e.target.value)}
          >
            {Object.entries(ZATCA_ENVIRONMENT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {activePhase !== ZATCA_PHASES.DISABLED && (
          <>
            <div className="zatca-status-box" style={{ marginTop: "1rem" }}>
              <div className="zatca-status-row">
                <span>Status</span>
                <strong>{status.label}</strong>
              </div>
              <div className="zatca-status-row">
                <span>Ready</span>
                <strong>{status.ready ? "Yes" : "No"}</strong>
              </div>
            </div>

            <h4 className="zatca-easy-section-title">Company Details</h4>
            <p className="settings-section-desc">
              Required for both Phase 1 (QR) and Phase 2 (e-invoicing).
            </p>
            <Input
              label="Company name (English)"
              value={form[K.COMPANY_NAME] || form.store_name || ""}
              onChange={(e) => {
                updateField(K.COMPANY_NAME, e.target.value);
                updateField("store_name", e.target.value);
              }}
            />
            <div style={{ marginTop: "1rem" }}>
              <Input
                label="Company name (Arabic)"
                value={form[K.COMPANY_NAME_AR] || form.store_name_ar || ""}
                onChange={(e) => {
                  updateField(K.COMPANY_NAME_AR, e.target.value);
                  updateField("store_name_ar", e.target.value);
                }}
                dir="rtl"
              />
            </div>
            <div className="form-row" style={{ marginTop: "1rem" }}>
              <Input
                label="CR number"
                value={form[K.CR_NUMBER] || form.cr_number || ""}
                onChange={(e) => {
                  updateField(K.CR_NUMBER, e.target.value);
                  updateField("cr_number", e.target.value);
                }}
              />
              <Input
                label="VAT registration (15 digits)"
                value={form[K.VAT_NUMBER] || form.vat_registration || ""}
                onChange={(e) => {
                  updateField(K.VAT_NUMBER, e.target.value);
                  updateField("vat_registration", e.target.value);
                }}
                placeholder={
                  form[K.ENVIRONMENT] === ZATCA_ENVIRONMENTS.SANDBOX
                    ? "300000000000003 for sandbox"
                    : "3XXXXXXXXXXXXX3"
                }
              />
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Textarea
                label="Address"
                value={form[K.COMPANY_ADDRESS] || form.store_address || ""}
                onChange={(e) => {
                  updateField(K.COMPANY_ADDRESS, e.target.value);
                  updateField("store_address", e.target.value);
                }}
              />
            </div>

            <h4 className="zatca-easy-section-title" style={{ marginTop: "1.5rem" }}>
              Business Information
            </h4>
            <p className="settings-section-desc">
              Structured address fields for ZATCA records. Optional — does not affect current
              invoice or QR generation.
            </p>
            <div className="form-row" style={{ marginTop: "1rem" }}>
              <Input
                label="Building Number"
                value={form[K.BUILDING_NUMBER] || ""}
                onChange={(e) => updateField(K.BUILDING_NUMBER, e.target.value)}
              />
              <Input
                label="Additional Number"
                value={form[K.ADDITIONAL_NUMBER] || ""}
                onChange={(e) => updateField(K.ADDITIONAL_NUMBER, e.target.value)}
              />
            </div>
            <div className="form-row" style={{ marginTop: "1rem" }}>
              <Input
                label="Street Name (English)"
                value={form[K.STREET_NAME_EN] || ""}
                onChange={(e) => updateField(K.STREET_NAME_EN, e.target.value)}
              />
              <Input
                label="Street Name (Arabic)"
                value={form[K.STREET_NAME_AR] || ""}
                onChange={(e) => updateField(K.STREET_NAME_AR, e.target.value)}
                dir="rtl"
              />
            </div>
            <div className="form-row" style={{ marginTop: "1rem" }}>
              <Input
                label="District"
                value={form[K.DISTRICT] || ""}
                onChange={(e) => updateField(K.DISTRICT, e.target.value)}
              />
              <Input
                label="City"
                value={form[K.CITY] || ""}
                onChange={(e) => updateField(K.CITY, e.target.value)}
              />
              <Input
                label="Postal Code"
                value={form[K.POSTAL_CODE] || ""}
                onChange={(e) => updateField(K.POSTAL_CODE, e.target.value)}
              />
            </div>

            <div className="zatca-easy-progress">
              {stepDefs.map((step, index) => {
                const progStep = progress.steps.find((s) => s.id === step.id);
                const done = progStep?.done ?? false;
                const active = progress.activeStepId === step.id;
                return (
                  <div
                    key={step.id}
                    className={`zatca-easy-progress-item ${done ? "done" : ""} ${active ? "active" : ""}`}
                  >
                    <StepDot done={done} active={active && !progress.complete} />
                    <div className="zatca-easy-progress-label">
                      <strong>
                        {index + 1}. {step.label}
                      </strong>
                      <span>{step.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeStepDef && !progress.complete && (
              <div className="zatca-easy-panel">
                <div style={{ flex: 1 }}>
                  <strong>
                    Step {stepDefs.findIndex((s) => s.id === activeStepDef.id) + 1} —{" "}
                    {activeStepDef.label}
                  </strong>
                  <ul className="zatca-easy-help-list">
                    {activeStepDef.help.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <HelpLinks links={activeStepDef.links} />

                  {busy && activeStepDef.id === "keys" && (
                    <p className="zatca-easy-auto-msg">
                      <Loader2 size={14} className="zatca-step-spin" /> Auto-generating
                      private key and CSR...
                    </p>
                  )}

                  {activeStepDef.id === "compliance" && (
                    <>
                      {csrBase64 && (
                        <div className="zatca-easy-csr-box">
                          <code>{csrBase64.slice(0, 40)}…</code>
                          <Button type="button" variant="secondary" onClick={copyCsr}>
                            <Copy size={14} /> Copy CSR
                          </Button>
                          {copyLabel && (
                            <span className="zatca-easy-copy-label">{copyLabel}</span>
                          )}
                        </div>
                      )}
                      <Input
                        label="OTP from Fatoora portal"
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value);
                          updateField(K.OTP, e.target.value);
                        }}
                        placeholder="e.g. 123456"
                        style={{ marginTop: "0.75rem" }}
                      />
                      <Button
                        type="button"
                        onClick={handleComplianceCsid}
                        disabled={busy || !otp.trim()}
                        style={{ marginTop: "0.75rem" }}
                      >
                        {busy ? (
                          <>
                            <Loader2 size={16} className="zatca-step-spin" /> Requesting...
                          </>
                        ) : (
                          "Get Compliance Certificate"
                        )}
                      </Button>
                    </>
                  )}

                  {activeStepDef.id === "production" && (
                    <Button
                      type="button"
                      onClick={handleProductionCsid}
                      disabled={busy}
                      style={{ marginTop: "0.75rem" }}
                    >
                      {busy ? (
                        <>
                          <Loader2 size={16} className="zatca-step-spin" /> Activating...
                        </>
                      ) : (
                        "Activate Production Certificate"
                      )}
                    </Button>
                  )}

                  {activeStepDef.id === "keys" && progress.hasKey && progress.hasCsr && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => runKeysStep(mergedSettings, true)}
                      disabled={busy}
                      style={{ marginTop: "0.75rem" }}
                    >
                      Regenerate CSR
                    </Button>
                  )}
                </div>
              </div>
            )}

            {progress.complete && (
              <Alert type="success">
                ZATCA setup complete!{" "}
                {isPhase2
                  ? "Your device is ready for e-invoicing."
                  : "Phase 1 QR codes are active on receipts."}
              </Alert>
            )}

            {vatMismatch && (
              <Alert type="warning">{vatMismatch.message}</Alert>
            )}

            {notice && (
              <Alert type={notice.type === "success" ? "success" : "error"}>
                <div style={{ whiteSpace: "pre-line" }}>{notice.message}</div>
                {notice.hint && <p className="zatca-easy-hint">{notice.hint}</p>}
                {notice.links?.length > 0 && <HelpLinks links={notice.links} />}
              </Alert>
            )}

            <div className="zatca-easy-save-row">
              <Button type="button" onClick={handleSaveAndContinue} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={16} className="zatca-step-spin" /> Working...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save &amp; Continue
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {activePhase === ZATCA_PHASES.DISABLED && (
          <p className="settings-section-desc" style={{ marginTop: "1rem" }}>
            Select Phase 1 for QR codes on receipts, or Phase 2 for full e-invoicing with
            ZATCA sync.
          </p>
        )}
      </Card>

      {activePhase === ZATCA_PHASES.PHASE2 && (
        <Card className="settings-card">
          <button
            type="button"
            className="zatca-advanced-toggle"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Show"} advanced settings (certificates, sync, device)
          </button>

          {showAdvanced && (
            <div className="zatca-advanced-body">
              <label className="zatca-sync-toggle">
                <input
                  type="checkbox"
                  checked={(form[ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED] ?? "0") === "1"}
                  onChange={(e) =>
                    updateField(
                      ZATCA_SYNC_SETTINGS.AUTO_SYNC_ENABLED,
                      e.target.checked ? "1" : "0"
                    )
                  }
                />
                <span>Enable automatic background sync</span>
              </label>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <Input
                  label="Device ID"
                  value={form[K.DEVICE_ID]}
                  onChange={(e) => updateField(K.DEVICE_ID, e.target.value)}
                />
                <Input
                  label="Device serial"
                  value={form[K.DEVICE_SERIAL]}
                  onChange={(e) => updateField(K.DEVICE_SERIAL, e.target.value)}
                />
              </div>
              <Textarea
                label="Certificate (PEM) — auto-filled after Step 3"
                value={form[K.CERTIFICATE]}
                onChange={(e) => updateField(K.CERTIFICATE, e.target.value)}
                rows={3}
                style={{ marginTop: "1rem" }}
              />
            </div>
          )}
        </Card>
      )}
    </>
  );
}
