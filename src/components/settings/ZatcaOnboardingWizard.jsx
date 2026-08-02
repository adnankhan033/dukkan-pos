import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card } from "../common/Card";
import { Input } from "../common/Input";
import Button from "../common/Button";
import { Alert } from "../common/Loading";
import { ZATCA_PHASES, ZATCA_SETTING_KEYS as K } from "../../zatca/core/constants";
import { ZATCA_ENVIRONMENT_CONFIG } from "../../zatca/core/environments";
import { getOnboardingStepsForPhase } from "../../zatca/onboarding/onboardingSteps";
import { zatcaOnboardingService } from "../../zatca/onboarding/ZatcaOnboardingService";
import { resolveOperationUrl, getZatcaApiOperation } from "../../zatca/api/registry";
import { settingsService } from "../../services/SettingsService";
import { useSettingsStore } from "../../contexts/store";
import { parseZatcaConfig } from "../../zatca/core/config";

function StepIcon({ status }) {
  if (status === "running") return <Loader2 size={18} className="zatca-step-spin" />;
  if (status === "success") return <CheckCircle2 size={18} className="zatca-step-success" />;
  if (status === "failed") return <XCircle size={18} className="zatca-step-failed" />;
  return <Circle size={18} className="zatca-step-pending" />;
}

export default function ZatcaOnboardingWizard({ form, updateField, baseSettings }) {
  const setSettings = useSettingsStore((s) => s.setSettings);
  const activePhase = form[K.ACTIVE_PHASE];

  const [expandedStep, setExpandedStep] = useState(null);
  const [stepStates, setStepStates] = useState({});
  const [stepInputs, setStepInputs] = useState({
    otp: form[K.OTP] || "",
    compliance_request_id: form[K.COMPLIANCE_REQUEST_ID] || "",
  });

  const mergedSettings = useMemo(
    () => ({ ...baseSettings, ...form }),
    [baseSettings, form]
  );

  const config = useMemo(() => parseZatcaConfig(mergedSettings), [mergedSettings]);
  const envConfig =
    ZATCA_ENVIRONMENT_CONFIG[form[K.ENVIRONMENT]] ||
    ZATCA_ENVIRONMENT_CONFIG.sandbox;

  const steps = useMemo(() => {
    if (activePhase === ZATCA_PHASES.DISABLED) return [];
    return getOnboardingStepsForPhase(activePhase);
  }, [activePhase]);

  if (activePhase === ZATCA_PHASES.DISABLED) {
    return (
      <Card className="settings-card">
        <h3 className="settings-section-title">Integration Steps</h3>
        <p className="settings-section-desc">
          Select Phase 1 or Phase 2 above to see step-by-step API testing.
        </p>
      </Card>
    );
  }

  async function runStep(step) {
    setStepStates((prev) => ({
      ...prev,
      [step.id]: { status: "running", message: "Running..." },
    }));
    setExpandedStep(step.id);

    try {
      const result = await zatcaOnboardingService.runStep(step.id, {
        settings: mergedSettings,
        formOverrides: stepInputs,
      });

      if (result.savedFields) {
        for (const [key, value] of Object.entries(result.savedFields)) {
          updateField(key, value);
          await settingsService.set(key, value);
        }
        const updated = await settingsService.getAll();
        setSettings(updated);
      }

      setStepStates((prev) => ({
        ...prev,
        [step.id]: {
          status: result.success ? "success" : "failed",
          message: result.message,
          httpStatus: result.httpStatus,
          response: result.response,
          qrDataUrl: result.qrDataUrl,
          endpoint: step.endpoint
            ? `${config.api.baseUrl}${step.endpoint}`
            : result.endpoint,
        },
      }));
    } catch (err) {
      setStepStates((prev) => ({
        ...prev,
        [step.id]: {
          status: "failed",
          message: err.message || "Step failed.",
        },
      }));
    }
  }

  function resolveEndpoint(step) {
    if (step.apiId) {
      const op = getZatcaApiOperation(step.apiId);
      if (op) return resolveOperationUrl(config, op);
    }
    if (!step.endpoint) return null;
    return `${config.api.baseUrl}${step.endpoint}`;
  }

  return (
    <Card className="settings-card zatca-onboarding-wizard">
      <h3 className="settings-section-title">Integration Steps — Test Each API</h3>
      <p className="settings-section-desc">
        Run each step in order. Phase 1 steps are local (no API). Phase 2 steps call the ZATCA
        Sandbox at <code>{envConfig.apiBaseUrl}</code>.
      </p>

      <div className="zatca-onboarding-steps">
        {steps.map((step, index) => {
          const state = stepStates[step.id] || { status: "pending" };
          const isOpen = expandedStep === step.id;
          const endpoint = resolveEndpoint(step);

          return (
            <div
              key={step.id}
              className={`zatca-onboarding-step ${state.status} ${isOpen ? "open" : ""}`}
            >
              <button
                type="button"
                className="zatca-onboarding-step-header"
                onClick={() => setExpandedStep(isOpen ? null : step.id)}
              >
                <StepIcon status={state.status} />
                <div className="zatca-onboarding-step-title">
                  <strong>{step.title}</strong>
                  <span>{step.description}</span>
                </div>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {isOpen && (
                <div className="zatca-onboarding-step-body">
                  {step.method && endpoint && (
                    <div className="zatca-onboarding-api-meta">
                      <span className="zatca-api-method">{step.method}</span>
                      <code>{endpoint}</code>
                    </div>
                  )}

                  {step.fields?.includes("otp") && (
                    <Input
                      label="OTP (from ZATCA Fatoora portal)"
                      value={stepInputs.otp}
                      onChange={(e) => {
                        setStepInputs((prev) => ({ ...prev, otp: e.target.value }));
                        updateField(K.OTP, e.target.value);
                      }}
                      placeholder="e.g. 123345"
                      style={{ marginTop: "0.75rem" }}
                    />
                  )}

                  {step.fields?.includes("compliance_request_id") && (
                    <Input
                      label="Compliance request ID"
                      value={stepInputs.compliance_request_id}
                      onChange={(e) => {
                        setStepInputs((prev) => ({
                          ...prev,
                          compliance_request_id: e.target.value,
                        }));
                        updateField(K.COMPLIANCE_REQUEST_ID, e.target.value);
                      }}
                      placeholder="From Step 4 response (requestID)"
                      style={{ marginTop: "0.75rem" }}
                    />
                  )}

                  <div className="zatca-onboarding-step-actions">
                    <Button type="button" onClick={() => runStep(step)}>
                      <Play size={16} /> Run Step {index + 1}
                    </Button>
                  </div>

                  {state.message && (
                    <Alert type={state.status === "success" ? "success" : "error"}>
                      {state.httpStatus ? `HTTP ${state.httpStatus} — ` : ""}
                      {state.message}
                    </Alert>
                  )}

                  {state.qrDataUrl && (
                    <div className="zatca-onboarding-qr-preview">
                      <img src={state.qrDataUrl} alt="Sample ZATCA QR" width={120} height={120} />
                    </div>
                  )}

                  {state.response && (
                    <details className="zatca-onboarding-response">
                      <summary>View API response</summary>
                      <pre>{JSON.stringify(state.response, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
