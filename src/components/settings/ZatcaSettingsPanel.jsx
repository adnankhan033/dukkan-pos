import { useEffect, useMemo, useState } from "react";
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
} from "../../zatca/core/constants";
import { ZATCA_ENVIRONMENT_CONFIG } from "../../zatca/core/environments";
import { zatcaService } from "../../services/ZatcaService";
import { zatcaInvoiceRepository } from "../../zatca/repositories/ZatcaInvoiceRepository";
import { settingsService } from "../../services/SettingsService";
import { useSettingsStore } from "../../contexts/store";
import { ensurePrivateKey } from "../../zatca/onboarding/ensurePrivateKey";
import { isValidPrivateKeyPem } from "../../zatca/onboarding/keyGenerator";
import { generateZatcaCsr, csrPemToBase64 } from "../../zatca/onboarding/csrGenerator";

function SensitiveField({ label, value, onChange, rows = 4, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
        <label className="form-label">{label}</label>
        <button
          type="button"
          className="zatca-toggle-secret"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <Textarea
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        style={visible ? undefined : { WebkitTextSecurity: "disc" }}
      />
    </div>
  );
}

function settingsFromForm(form, baseSettings) {
  return { ...baseSettings, ...form };
}

export default function ZatcaSettingsPanel({ form, updateField, baseSettings }) {
  const setSettings = useSettingsStore((s) => s.setSettings);
  const [testResult, setTestResult] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [privateKeyNotice, setPrivateKeyNotice] = useState("");
  const [ensuringPrivateKey, setEnsuringPrivateKey] = useState(false);
  const [csrNotice, setCsrNotice] = useState("");
  const [csrBase64, setCsrBase64] = useState("");
  const [generatingCsr, setGeneratingCsr] = useState(false);
  const [copyLabel, setCopyLabel] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function ensureLocalPrivateKey() {
      const formKey = form[K.PRIVATE_KEY]?.trim() || "";
      const storedKey = baseSettings[K.PRIVATE_KEY]?.trim() || "";

      if (isValidPrivateKeyPem(formKey) || isValidPrivateKeyPem(storedKey)) {
        if (!formKey && storedKey) {
          updateField(K.PRIVATE_KEY, storedKey);
        }
        return;
      }

      setEnsuringPrivateKey(true);
      try {
        const result = await ensurePrivateKey({ settings: baseSettings, persist: true });
        if (cancelled || !result.generated) return;

        const updated = await settingsService.getAll();
        setSettings(updated);
        updateField(K.PRIVATE_KEY, result.privateKey);
        setPrivateKeyNotice(
          "Generated a new secp256k1 private key on this device and saved it locally. Keep it secret."
        );
      } catch (err) {
        if (!cancelled) {
          setPrivateKeyNotice(`Could not generate private key: ${err.message}`);
        }
      } finally {
        if (!cancelled) setEnsuringPrivateKey(false);
      }
    }

    ensureLocalPrivateKey();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedSettings = useMemo(
    () => settingsFromForm(form, baseSettings),
    [form, baseSettings]
  );

  const status = useMemo(() => zatcaService.getStatus(mergedSettings), [mergedSettings]);
  const validation = useMemo(
    () => zatcaService.validateConfiguration(mergedSettings),
    [mergedSettings]
  );

  const envConfig =
    ZATCA_ENVIRONMENT_CONFIG[form[K.ENVIRONMENT]] ||
    ZATCA_ENVIRONMENT_CONFIG[ZATCA_ENVIRONMENTS.SANDBOX];

  function handlePhaseChange(phase) {
    updateField(K.ACTIVE_PHASE, phase);
    updateField(K.ENABLED, phase !== ZATCA_PHASES.DISABLED ? "1" : "0");
  }

  async function runValidationTest() {
    setTestResult(null);
    const result = zatcaService.validateConfiguration(mergedSettings);
    setTestResult(result);
  }

  async function loadRecentInvoices() {
    setLoadingInvoices(true);
    try {
      const rows = await zatcaInvoiceRepository.getRecent(10);
      setRecentInvoices(rows);
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function handleGenerateCsr() {
    setCsrNotice("");
    setCopyLabel("");
    setGeneratingCsr(true);
    try {
      const result = await generateZatcaCsr(mergedSettings);
      updateField(K.CERTIFICATE_REQUEST, result.pem);
      setCsrBase64(result.base64);
      await settingsService.set(K.CERTIFICATE_REQUEST, result.pem);

      const updated = await settingsService.getAll();
      setSettings(updated);

      let message =
        "CSR generated. Copy the base64 value below into ZATCA Swagger → Compliance CSID → csr field.";
      if (result.params.usedSandboxVatPlaceholder) {
        message +=
          " Used sandbox test VAT 300000000000003 — set your real VAT on the Store tab for production.";
      }
      setCsrNotice(message);
    } catch (err) {
      setCsrNotice(err.message || "Could not generate CSR.");
    } finally {
      setGeneratingCsr(false);
    }
  }

  async function copyText(label, text) {
    if (!text?.trim()) return;
    await navigator.clipboard.writeText(text.trim());
    setCopyLabel(`${label} copied`);
    setTimeout(() => setCopyLabel(""), 2000);
  }

  return (
    <>
      <Card className="settings-card">
        <h3 className="settings-section-title">ZATCA Integration</h3>
        <p className="settings-section-desc">
          Modular e-invoicing for Saudi Arabia. Phase 1 generates simplified tax invoice QR codes.
          Phase 2 submits signed e-invoices to ZATCA Fatoora (sandbox configured by default).
        </p>

        <Select
          label="Active integration"
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
          style={{ marginTop: "1rem" }}
        >
          {Object.entries(ZATCA_ENVIRONMENT_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>

        <div className="zatca-status-box">
          <div className="zatca-status-row">
            <span>Status</span>
            <strong>{status.label}</strong>
          </div>
          <div className="zatca-status-row">
            <span>Environment</span>
            <strong>{status.environment || envConfig.label}</strong>
          </div>
          <div className="zatca-status-row">
            <span>Ready</span>
            <strong>{status.ready ? "Yes" : "No"}</strong>
          </div>
          {status.messages?.map((msg) => (
            <p key={msg} className="zatca-status-message">
              {msg}
            </p>
          ))}
        </div>

        {validation.warnings?.length > 0 && (
          <Alert type="warning">{validation.warnings.join(" ")}</Alert>
        )}
        {validation.errors?.length > 0 && <Alert>{validation.errors.join(" ")}</Alert>}

        <Button type="button" variant="secondary" onClick={runValidationTest} style={{ marginTop: "1rem" }}>
          Validate configuration
        </Button>
        {testResult && (
          <p className="settings-section-desc" style={{ marginTop: "0.75rem" }}>
            Validation: {testResult.valid ? "Passed" : "Failed"}
            {testResult.errors?.length ? ` — ${testResult.errors.join("; ")}` : ""}
          </p>
        )}
      </Card>

      <Card className="settings-card">
        <h3 className="settings-section-title">Device (EGS) Information</h3>
        <p className="settings-section-desc">Device details used when you click Generate CSR.</p>
        <div className="form-row">
          <Input label="Device ID" value={form[K.DEVICE_ID]} onChange={(e) => updateField(K.DEVICE_ID, e.target.value)} />
          <Input label="Device serial" value={form[K.DEVICE_SERIAL]} onChange={(e) => updateField(K.DEVICE_SERIAL, e.target.value)} />
          <Input label="EGS unit name" value={form[K.EGS_UNIT_NAME]} onChange={(e) => updateField(K.EGS_UNIT_NAME, e.target.value)} />
          <Input label="EGS model" value={form[K.EGS_MODEL]} onChange={(e) => updateField(K.EGS_MODEL, e.target.value)} />
          <Input label="EGS version" value={form[K.EGS_VERSION]} onChange={(e) => updateField(K.EGS_VERSION, e.target.value)} />
        </div>
      </Card>

      <Card className="settings-card">
        <h3 className="settings-section-title">Company Information</h3>
        <p className="settings-section-desc">
          Leave blank to use values from Store settings (store name, CR, VAT, address).
        </p>
        <Input label="Company name (EN)" value={form[K.COMPANY_NAME]} onChange={(e) => updateField(K.COMPANY_NAME, e.target.value)} />
        <div style={{ marginTop: "1rem" }}>
          <Input label="Company name (AR)" value={form[K.COMPANY_NAME_AR]} onChange={(e) => updateField(K.COMPANY_NAME_AR, e.target.value)} dir="rtl" />
        </div>
        <div className="form-row" style={{ marginTop: "1rem" }}>
          <Input label="CR number" value={form[K.CR_NUMBER]} onChange={(e) => updateField(K.CR_NUMBER, e.target.value)} />
          <Input label="VAT registration" value={form[K.VAT_NUMBER]} onChange={(e) => updateField(K.VAT_NUMBER, e.target.value)} />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <Textarea label="Address" value={form[K.COMPANY_ADDRESS]} onChange={(e) => updateField(K.COMPANY_ADDRESS, e.target.value)} />
        </div>
      </Card>

      <Card className="settings-card">
        <h3 className="settings-section-title">API Endpoints</h3>
        <p className="settings-section-desc">
          Auto-filled from environment. Override only if ZATCA changes gateway URLs.
        </p>
        <Input label="API base URL (optional override)" value={form[K.API_BASE_URL]} onChange={(e) => updateField(K.API_BASE_URL, e.target.value)} placeholder={envConfig.apiBaseUrl} />
        <div className="zatca-endpoint-list">
          <div><span>Compliance</span><code>{envConfig.complianceUrl}</code></div>
          <div><span>Reporting</span><code>{envConfig.reportingUrl}</code></div>
          <div><span>Clearance</span><code>{envConfig.clearanceUrl}</code></div>
        </div>
      </Card>

      <Card className="settings-card">
        <h3 className="settings-section-title">Certificates & Authentication</h3>
        <p className="settings-section-desc">
          Sensitive values are stored locally in the app database. A ZATCA-compatible secp256k1
          private key is generated automatically on this device when none exists yet.
        </p>
        {ensuringPrivateKey && (
          <p className="settings-section-desc">Checking for a local private key...</p>
        )}
        {privateKeyNotice && (
          <Alert type={privateKeyNotice.startsWith("Could not") ? "error" : "success"}>
            {privateKeyNotice}
          </Alert>
        )}
        <SensitiveField
          label="Certificate (PEM)"
          value={form[K.CERTIFICATE]}
          onChange={(e) => updateField(K.CERTIFICATE, e.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----..."
        />
        <SensitiveField
          label="Private key (PEM)"
          value={form[K.PRIVATE_KEY]}
          onChange={(e) => updateField(K.PRIVATE_KEY, e.target.value)}
          placeholder="-----BEGIN EC PRIVATE KEY-----..."
        />
        <SensitiveField
          label="Certificate signing request (CSR)"
          value={form[K.CERTIFICATE_REQUEST]}
          onChange={(e) => updateField(K.CERTIFICATE_REQUEST, e.target.value)}
          placeholder="-----BEGIN CERTIFICATE REQUEST-----..."
        />
        <div className="settings-backup-actions" style={{ marginTop: "0.75rem" }}>
          <Button type="button" variant="secondary" onClick={handleGenerateCsr} disabled={generatingCsr}>
            {generatingCsr ? "Generating CSR..." : "Generate CSR"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => copyText("CSR (PEM)", form[K.CERTIFICATE_REQUEST])}
            disabled={!form[K.CERTIFICATE_REQUEST]?.trim()}
          >
            Copy CSR (PEM)
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              copyText(
                "CSR (base64 for API)",
                csrBase64 || csrPemToBase64(form[K.CERTIFICATE_REQUEST])
              )
            }
            disabled={!form[K.CERTIFICATE_REQUEST]?.trim()}
          >
            Copy CSR (base64 for API)
          </Button>
        </div>
        {csrNotice && (
          <Alert type={csrNotice.startsWith("Fill") || csrNotice.includes("Could not") ? "error" : "success"}>
            {csrNotice}
          </Alert>
        )}
        {copyLabel && <p className="settings-section-desc">{copyLabel}</p>}
        {(csrBase64 || form[K.CERTIFICATE_REQUEST]) && (
          <div style={{ marginTop: "0.75rem" }}>
            <Textarea
              label="CSR base64 (paste into ZATCA Swagger “csr” field)"
              value={csrBase64 || csrPemToBase64(form[K.CERTIFICATE_REQUEST])}
              readOnly
              rows={3}
            />
          </div>
        )}
        <div className="form-row" style={{ marginTop: "1rem" }}>
          <Input label="Client ID" value={form[K.CLIENT_ID]} onChange={(e) => updateField(K.CLIENT_ID, e.target.value)} />
          <Input label="OTP (onboarding)" value={form[K.OTP]} onChange={(e) => updateField(K.OTP, e.target.value)} type="password" />
        </div>
        <SensitiveField
          label="Client secret"
          value={form[K.CLIENT_SECRET]}
          onChange={(e) => updateField(K.CLIENT_SECRET, e.target.value)}
          rows={2}
        />
        <SensitiveField
          label="Compliance CSID"
          value={form[K.COMPLIANCE_CSID]}
          onChange={(e) => updateField(K.COMPLIANCE_CSID, e.target.value)}
          rows={3}
        />
        <SensitiveField
          label="Production CSID"
          value={form[K.PRODUCTION_CSID]}
          onChange={(e) => updateField(K.PRODUCTION_CSID, e.target.value)}
          rows={3}
        />
        <SensitiveField
          label="Secret / security token"
          value={form[K.SECRET]}
          onChange={(e) => updateField(K.SECRET, e.target.value)}
          rows={2}
        />
      </Card>

      {form[K.ACTIVE_PHASE] === ZATCA_PHASES.PHASE2 && (
        <Card className="settings-card">
          <h3 className="settings-section-title">Phase 2 — Invoice chain</h3>
          <div className="form-row">
            <Input label="Invoice counter (ICV)" value={form[K.INVOICE_COUNTER]} readOnly />
            <Input label="Previous invoice hash" value={form[K.PREVIOUS_INVOICE_HASH]} readOnly />
          </div>
          <Button type="button" variant="secondary" onClick={loadRecentInvoices} disabled={loadingInvoices} style={{ marginTop: "1rem" }}>
            {loadingInvoices ? "Loading..." : "Load recent submissions"}
          </Button>
          {recentInvoices.length > 0 && (
            <div className="zatca-invoice-list">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="zatca-invoice-item">
                  <strong>{inv.sale_number}</strong>
                  <span>{inv.status}</span>
                  <span>{inv.environment}</span>
                  <small>{inv.created_at}</small>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
