import { Play, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Button from "../common/Button";
import { Input } from "../common/Input";
import { Alert } from "../common/Loading";
import { ZATCA_SETTING_KEYS as K } from "../../zatca/core/constants";
import {
  ZATCA_API_FIELD_LABELS,
  resolveOperationUrl,
  getZatcaApiOperation,
} from "../../zatca/api/registry";
import { ZATCA_LOCAL_STEPS } from "../../zatca/api/stepRunner";

const FIELD_TO_SETTING = {
  otp: K.OTP,
  compliance_request_id: K.COMPLIANCE_REQUEST_ID,
};

/**
 * Reusable panel to run any ZATCA Swagger API operation with dynamic prerequisite steps.
 */
export default function ZatcaApiOperationPanel({
  operationId,
  config,
  form,
  updateField,
  onRun,
  onRunLocalStep,
  busy = false,
  result = null,
  prerequisites = [],
  prepStepResults = {},
  compact = false,
}) {
  const operation = getZatcaApiOperation(operationId);
  if (!operation) return null;

  const endpoint = resolveOperationUrl(config, operation);
  const localPrereqs = prerequisites.filter((p) => p.localStepId);

  return (
    <div className={`zatca-api-operation-panel ${compact ? "compact" : ""}`}>
      {!compact && (
        <>
          <h4>{operation.name}</h4>
          <p className="zatca-test-help">{operation.description}</p>
        </>
      )}

      {localPrereqs.length > 0 && (
        <div className="zatca-api-prep-steps">
          <strong className="zatca-api-prep-title">Preparation steps (run in order)</strong>
          <ul className="zatca-api-prep-list">
            {localPrereqs.map((prereq) => {
              const localStep = ZATCA_LOCAL_STEPS[prereq.localStepId];
              const stepResult = prepStepResults[prereq.localStepId];
              return (
                <li key={prereq.id} className={prereq.ready ? "ready" : "pending"}>
                  <div className="zatca-api-prep-row">
                    {prereq.ready ? (
                      <CheckCircle2 size={16} className="zatca-prep-icon ready" />
                    ) : stepResult?.success === false ? (
                      <XCircle size={16} className="zatca-prep-icon failed" />
                    ) : (
                      <span className="zatca-prep-icon pending" />
                    )}
                    <div className="zatca-api-prep-info">
                      <strong>{localStep?.name || prereq.label}</strong>
                      <span>{localStep?.description || prereq.label}</span>
                      {stepResult?.message && !prereq.ready && (
                        <small className={stepResult.success ? "ok" : "err"}>{stepResult.message}</small>
                      )}
                    </div>
                    {!prereq.ready && onRunLocalStep && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRunLocalStep(prereq.localStepId)}
                      >
                        {busy ? <Loader2 size={14} className="zatca-step-spin" /> : <Play size={14} />}
                        Run
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="zatca-onboarding-api-meta" style={{ marginTop: localPrereqs.length ? "0.75rem" : 0 }}>
        <span className="zatca-api-method">{operation.method}</span>
        <code>{endpoint}</code>
      </div>

      {operation.requestExample && (
        <details className="zatca-swagger-schema" style={{ marginTop: "0.5rem" }}>
          <summary>Swagger request schema</summary>
          <pre>{JSON.stringify(operation.requestExample, null, 2)}</pre>
        </details>
      )}

      {operation.fields?.map((field) => (
        <Input
          key={field}
          label={ZATCA_API_FIELD_LABELS[field] || field}
          value={form[FIELD_TO_SETTING[field]] || ""}
          onChange={(e) => updateField(FIELD_TO_SETTING[field], e.target.value)}
          placeholder={field === "otp" ? "e.g. 123345" : ""}
          style={{ marginTop: "0.75rem" }}
        />
      ))}

      {operation.id === "compliance_csid" && (
        <p className="zatca-test-help" style={{ marginTop: "0.5rem" }}>
          Headers: <code>OTP</code>, <code>Accept-Version: V2</code> · Body:{" "}
          <code>{`{ "csr": "<base64 CSR>" }`}</code>
        </p>
      )}

      {operation.usesTestInvoice && (
        <p className="zatca-test-help" style={{ marginTop: "0.5rem" }}>
          Uses auto-generated test invoice XML (unsigned placeholder until full signing is added).
        </p>
      )}

      {prerequisites.filter((p) => !p.localStepId && !p.ready).map((p) => (
        <p key={p.id} className="zatca-test-help zatca-prep-warning">
          ⚠️ {p.label} — complete the previous API step first.
        </p>
      ))}

      <Button
        type="button"
        disabled={busy}
        onClick={() => onRun(operationId)}
        style={{ marginTop: "0.75rem" }}
      >
        <Play size={16} /> Run {operation.method} {operation.path}
        {localPrereqs.some((p) => !p.ready) ? " (auto-prepare)" : ""}
      </Button>

      {result?.prepSteps?.length > 0 && (
        <details className="zatca-prep-log" style={{ marginTop: "0.75rem" }}>
          <summary>Preparation log ({result.prepSteps.length} step(s))</summary>
          <ul>
            {result.prepSteps.map((s, i) => (
              <li key={i} className={s.success ? "ok" : "fail"}>
                {s.skipped ? "⏭" : s.success ? "✅" : "❌"} {s.stepId}: {s.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result && (
        <Alert type={result.success ? "success" : "error"} style={{ marginTop: "0.75rem" }}>
          {result.httpStatus ? `HTTP ${result.httpStatus} — ` : ""}
          {result.message}
        </Alert>
      )}
    </div>
  );
}
