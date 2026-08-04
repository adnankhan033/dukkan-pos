import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ClipboardCopy,
  RefreshCw,
  Play,
  WifiOff,
  CloudUpload,
  ListChecks,
  Send,
} from "lucide-react";
import { useSettingsStore } from "../contexts/store";
import { parseZatcaConfig, buildSyncEnabledSettings } from "../zatca/core/config";
import {
  ZATCA_ENVIRONMENT_LABELS,
  ZATCA_SETTING_KEYS as K,
  ZATCA_QUEUE_STATUS,
  ZATCA_QUEUE_STATUS_LABELS,
} from "../zatca/core/constants";
import { maskSecret, summarizeCertificate } from "../zatca/testing/certificateValidator";
import { zatcaTestService } from "../zatca/testing/ZatcaTestService";
import { zatcaService } from "../services/ZatcaService";
import { zatcaInvoiceRepository } from "../zatca/repositories/ZatcaInvoiceRepository";
import { zatcaSyncService } from "../zatca/sync/ZatcaSyncService";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input, Select, Textarea } from "../components/common/Input";
import Badge from "../components/common/Badge";
import Table from "../components/common/Table";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatDateTime } from "../utils/format";
import ZatcaApiOperationPanel from "../components/zatca/ZatcaApiOperationPanel";
import ZatcaSyncStatusBanner, { SyncActionResultPanel } from "../components/zatca/ZatcaSyncStatusBanner";
import { listZatcaApiOperations } from "../zatca/api/registry";
import { formatSyncActionSummary } from "../zatca/sync/syncRouter";
import "./ZatcaTestCenter.css";

const SECTIONS = [
  { id: "checklist", label: "Checklist", step: 9 },
  { id: "config", label: "Configuration", step: 1 },
  { id: "api", label: "API Explorer", step: 2 },
  { id: "cert", label: "Certificates", step: 3 },
  { id: "invoice", label: "Test Invoice", step: 4 },
  { id: "offline", label: "Offline Test", step: 5 },
  { id: "online", label: "Online Sync", step: 6 },
  { id: "queue", label: "Queue Monitor", step: 7 },
  { id: "logs", label: "API Logs", step: 8 },
];

function ResultBanner({ result }) {
  if (!result) return null;
  const ok = result.passed ?? result.allPassed ?? result.success;
  return (
    <Alert type={ok ? "success" : "error"}>
      {result.summary || result.message || (ok ? "Test passed." : "Test failed.")}
    </Alert>
  );
}

function JsonBlock({ label, data, onCopy }) {
  if (!data) return null;
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="zatca-test-json-block">
      <div className="zatca-test-json-head">
        <strong>{label}</strong>
        <button type="button" className="zatca-test-copy-btn" onClick={() => onCopy(text)}>
          <ClipboardCopy size={14} /> Copy
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

export default function ZatcaTestCenter() {
  const storeSettings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const [activeSection, setActiveSection] = useState("checklist");
  const [busy, setBusy] = useState(false);
  const [copyNote, setCopyNote] = useState("");

  const [form, setForm] = useState({});
  const [configResult, setConfigResult] = useState(null);
  const [apiResult, setApiResult] = useState(null);
  const [apiOpResults, setApiOpResults] = useState({});
  const [prepStepResults, setPrepStepResults] = useState({});
  const [expandedApiOp, setExpandedApiOp] = useState("compliance_csid");
  const [certResult, setCertResult] = useState(null);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [offlineResult, setOfflineResult] = useState(null);
  const [onlineResult, setOnlineResult] = useState(null);
  const [queueActionResult, setQueueActionResult] = useState(null);
  const [syncingRowIds, setSyncingRowIds] = useState([]);
  const [checklistResult, setChecklistResult] = useState(null);

  const [queueItems, setQueueItems] = useState([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [syncReadiness, setSyncReadiness] = useState(null);

  useEffect(() => {
    setForm({
      [K.ENVIRONMENT]: storeSettings[K.ENVIRONMENT] || "sandbox",
      [K.API_BASE_URL]: storeSettings[K.API_BASE_URL] || "",
      [K.DEVICE_ID]: storeSettings[K.DEVICE_ID] || "",
      [K.DEVICE_SERIAL]: storeSettings[K.DEVICE_SERIAL] || "",
      [K.COMPANY_NAME]: storeSettings[K.COMPANY_NAME] || storeSettings.store_name || "",
      [K.COMPANY_ADDRESS]: storeSettings[K.COMPANY_ADDRESS] || storeSettings.store_address || "",
      [K.VAT_NUMBER]: storeSettings[K.VAT_NUMBER] || storeSettings.vat_registration || "",
      [K.CERTIFICATE_REQUEST]: storeSettings[K.CERTIFICATE_REQUEST] || "",
      [K.PRIVATE_KEY]: storeSettings[K.PRIVATE_KEY] || "",
      [K.CERTIFICATE]: storeSettings[K.CERTIFICATE] || "",
      [K.SECRET]: storeSettings[K.SECRET] || "",
      [K.OTP]: storeSettings[K.OTP] || "",
      [K.COMPLIANCE_REQUEST_ID]: storeSettings[K.COMPLIANCE_REQUEST_ID] || "",
      [K.COMPLIANCE_CSID]: storeSettings[K.COMPLIANCE_CSID] || "",
    });
  }, [storeSettings]);

  const mergedSettings = useMemo(() => ({ ...storeSettings, ...form }), [storeSettings, form]);
  const syncSettings = useMemo(() => buildSyncEnabledSettings(mergedSettings), [mergedSettings]);
  const config = useMemo(() => parseZatcaConfig(mergedSettings), [mergedSettings]);
  const apiOperations = useMemo(() => listZatcaApiOperations(), []);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function applyUpdatedSettings(updated) {
    if (!updated) return;
    setSettings(updated);
    setForm((prev) => ({
      ...prev,
      [K.PRIVATE_KEY]: updated[K.PRIVATE_KEY] ?? prev[K.PRIVATE_KEY],
      [K.CERTIFICATE_REQUEST]: updated[K.CERTIFICATE_REQUEST] ?? prev[K.CERTIFICATE_REQUEST],
      [K.CERTIFICATE]: updated[K.CERTIFICATE] ?? prev[K.CERTIFICATE],
      [K.COMPLIANCE_CSID]: updated[K.COMPLIANCE_CSID] ?? prev[K.COMPLIANCE_CSID],
      [K.PRODUCTION_CSID]: updated[K.PRODUCTION_CSID] ?? prev[K.PRODUCTION_CSID],
      [K.SECRET]: updated[K.SECRET] ?? prev[K.SECRET],
      [K.COMPLIANCE_REQUEST_ID]: updated[K.COMPLIANCE_REQUEST_ID] ?? prev[K.COMPLIANCE_REQUEST_ID],
    }));
  }

  async function runLocalPrepStep(stepId) {
    const result = await zatcaTestService.runLocalPrepStep(stepId, mergedSettings);
    setPrepStepResults((prev) => ({ ...prev, [stepId]: result }));
    applyUpdatedSettings(result.updatedSettings);
    return result;
  }

  async function runApiOperation(operationId) {
    const result = await zatcaTestService.runApiOperation(operationId, mergedSettings, {
      otp: form[K.OTP],
      compliance_request_id: form[K.COMPLIANCE_REQUEST_ID],
      autoPrepare: true,
    });
    setApiOpResults((prev) => ({ ...prev, [operationId]: result }));
    setApiResult(result);
    applyUpdatedSettings(result.updatedSettings);
    if (result.prepSteps) {
      const prepMap = {};
      for (const s of result.prepSteps) {
        prepMap[s.stepId] = s;
      }
      setPrepStepResults((prev) => ({ ...prev, ...prepMap }));
    }
    await loadLogs();
    return result;
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
    setCopyNote("Copied to clipboard");
    setTimeout(() => setCopyNote(""), 2000);
  }

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const items = await zatcaInvoiceRepository.getQueueItems({});
      setQueueItems(items);
      const readiness = await zatcaSyncService.getSyncReadiness(mergedSettings);
      const dashboard = await zatcaSyncService.getDashboardStats();
      setSyncReadiness({
        ...readiness,
        queueStats: dashboard,
        lastSyncAt: dashboard.lastSyncAt,
      });
      return { items, readiness, dashboard };
    } finally {
      setQueueLoading(false);
    }
  }, [mergedSettings]);

  const loadLogs = useCallback(async () => {
    const logs = await zatcaTestService.getApiLogs(100);
    setApiLogs(logs);
  }, []);

  useEffect(() => {
    loadQueue();
    loadLogs();
  }, [loadQueue, loadLogs]);

  useEffect(() => {
    const unsubscribe = zatcaSyncService.subscribe((event) => {
      if (event?.type === "item-updated" || event?.type === "sync-complete") {
        loadQueue();
      }
    });
    return unsubscribe;
  }, [loadQueue]);

  async function runQueueAction(label, actionFn) {
    setBusy(true);
    try {
      zatcaSyncService.setOfflineSimulation(false);
      const context = await zatcaSyncService.getSyncReadiness(syncSettings);
      let raw;

      if (label === "Refresh") {
        const loaded = await loadQueue();
        raw = { stats: loaded?.dashboard || syncReadiness?.queueStats };
      } else if (label === "Clear Completed") {
        raw = await zatcaTestService.clearCompletedQueue();
        await loadQueue();
      } else {
        raw = await actionFn();
        await loadQueue();
        await loadLogs();
      }

      setQueueActionResult(formatSyncActionSummary(label, raw, context));
    } finally {
      setBusy(false);
    }
  }

  async function syncQueueRow(rowId, saleNumber) {
    setSyncingRowIds((prev) => [...prev, rowId]);
    setBusy(true);
    try {
      zatcaSyncService.setOfflineSimulation(false);
      const context = await zatcaSyncService.getSyncReadiness(syncSettings);
      const raw = await zatcaSyncService.syncInvoiceById(rowId, syncSettings, { force: true });
      await loadQueue();
      await loadLogs();
      setQueueActionResult(
        formatSyncActionSummary(`${saleNumber || "Invoice"} Sync`, { ...raw, total: 1, results: [raw] }, context)
      );
    } finally {
      setSyncingRowIds((prev) => prev.filter((id) => id !== rowId));
      setBusy(false);
    }
  }

  function renderQueueStatus(row) {
    const isSyncing = syncingRowIds.includes(row.id) || row.status === ZATCA_QUEUE_STATUS.SENDING;
    const status = isSyncing ? ZATCA_QUEUE_STATUS.SENDING : row.status;
    const variant =
      status === ZATCA_QUEUE_STATUS.SYNCED
        ? "success"
        : status === ZATCA_QUEUE_STATUS.FAILED
          ? "danger"
          : status === ZATCA_QUEUE_STATUS.SENDING
            ? "info"
            : "warning";

    return <Badge variant={variant}>{ZATCA_QUEUE_STATUS_LABELS[status] || status}</Badge>;
  }

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  function envLabel(env) {
    return ZATCA_ENVIRONMENT_LABELS[env] || env || "—";
  }

  const queueColumns = [
    {
      key: "select",
      label: "",
      stopPropagation: true,
      render: (row) =>
        row.status !== "synced" ? (
          <input
            type="checkbox"
            checked={selectedQueueIds.includes(row.id)}
            onChange={() =>
              setSelectedQueueIds((prev) =>
                prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
              )
            }
          />
        ) : null,
    },
    { key: "sale_number", label: "Invoice #" },
    { key: "invoice_uuid", label: "UUID", render: (r) => r.invoice_uuid?.slice(0, 8) + "…" || "—" },
    {
      key: "status",
      label: "Status",
      render: (r) => renderQueueStatus(r),
    },
    {
      key: "environment",
      label: "Env",
      render: (r) => (
        <Badge variant={r.environment === "sandbox" ? "info" : r.environment === "production" ? "success" : "neutral"}>
          {envLabel(r.environment)}
        </Badge>
      ),
    },
    { key: "retry_count", label: "Retries" },
    {
      key: "created_at",
      label: "Created",
      render: (r) => (r.created_at ? formatDateTime(r.created_at) : "—"),
    },
    {
      key: "last_attempt_at",
      label: "Last Attempt",
      render: (r) => (r.last_attempt_at ? formatDateTime(r.last_attempt_at) : "—"),
    },
    {
      key: "synced_at",
      label: "Synced",
      render: (r) => (r.synced_at ? formatDateTime(r.synced_at) : "—"),
    },
    {
      key: "actions",
      label: "Action",
      stopPropagation: true,
      render: (r) =>
        r.status !== ZATCA_QUEUE_STATUS.SYNCED ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || syncingRowIds.includes(r.id)}
            onClick={() => syncQueueRow(r.id, r.sale_number)}
          >
            <Send size={14} /> Sync
          </Button>
        ) : (
          "—"
        ),
    },
    {
      key: "error_message",
      label: "Error",
      render: (r) => r.error_message || "—",
    },
  ];

  return (
    <div className="zatca-test-center">
      <PageHeader
        title="ZATCA Test Center"
        subtitle="Verify your ZATCA setup step by step before going live. No technical experience needed — each test explains what to fix."
      />

      {copyNote && <Alert type="success">{copyNote}</Alert>}

      <div className="zatca-test-layout">
        <nav className="zatca-test-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`zatca-test-nav-item ${activeSection === s.id ? "active" : ""}`}
              onClick={() => setActiveSection(s.id)}
            >
              <span className="zatca-test-step-num">{s.step}</span>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="zatca-test-content">
          {activeSection === "checklist" && (
            <Card>
              <h3>Validation Checklist</h3>
              <p className="zatca-test-help">
                Runs all tests at once. Green = passed, Red = needs attention.
              </p>
              <Button disabled={busy} onClick={() => run(async () => setChecklistResult(await zatcaTestService.runFullChecklist(mergedSettings)))}>
                <ListChecks size={16} /> Run Full Checklist
              </Button>
              {checklistResult && (
                <ul className="zatca-test-checklist">
                  {checklistResult.items.map((item) => (
                    <li key={item.id} className={item.passed ? "pass" : "fail"}>
                      {item.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.message}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {checklistResult && <ResultBanner result={checklistResult} />}
            </Card>
          )}

          {activeSection === "config" && (
            <Card>
              <h3>Step 1 — Configuration Check</h3>
              <p className="zatca-test-help">
                Review your ZATCA settings. Values come from Settings → ZATCA (editable here for testing).
              </p>
              <Select label="Environment" value={form[K.ENVIRONMENT]} onChange={(e) => updateField(K.ENVIRONMENT, e.target.value)}>
                {Object.entries(ZATCA_ENVIRONMENT_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </Select>
              <Input label="API Base URL" value={form[K.API_BASE_URL]} onChange={(e) => updateField(K.API_BASE_URL, e.target.value)} placeholder={config.api?.baseUrl} style={{ marginTop: "0.75rem" }} />
              <Input label="Device ID" value={form[K.DEVICE_ID]} onChange={(e) => updateField(K.DEVICE_ID, e.target.value)} style={{ marginTop: "0.75rem" }} />
              <Input label="VAT Registration Number" value={form[K.VAT_NUMBER]} onChange={(e) => updateField(K.VAT_NUMBER, e.target.value)} style={{ marginTop: "0.75rem" }} />
              <Textarea label="CSR" value={form[K.CERTIFICATE_REQUEST]} onChange={(e) => updateField(K.CERTIFICATE_REQUEST, e.target.value)} rows={3} style={{ marginTop: "0.75rem" }} />
              <Textarea label="Private Key" value={form[K.PRIVATE_KEY]} onChange={(e) => updateField(K.PRIVATE_KEY, e.target.value)} rows={3} style={{ marginTop: "0.75rem" }} />
              <Textarea label="Certificate" value={form[K.CERTIFICATE]} onChange={(e) => updateField(K.CERTIFICATE, e.target.value)} rows={3} style={{ marginTop: "0.75rem" }} />
              <Input label="Secret" value={form[K.SECRET]} onChange={(e) => updateField(K.SECRET, e.target.value)} type="password" style={{ marginTop: "0.75rem" }} />
              <Input
                label="OTP (for Compliance CSID API — from ZATCA portal)"
                value={form[K.OTP]}
                onChange={(e) => updateField(K.OTP, e.target.value)}
                placeholder="e.g. 123345"
                style={{ marginTop: "0.75rem" }}
              />
              <Button disabled={busy} onClick={() => run(async () => setConfigResult(zatcaTestService.testConfiguration(mergedSettings)))} style={{ marginTop: "1rem" }}>
                <Play size={16} /> Test Configuration
              </Button>
              {configResult?.checks && (
                <ul className="zatca-test-checklist">
                  {configResult.checks.map((c) => (
                    <li key={c.field} className={c.ok ? "pass" : "fail"}>
                      {c.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <div>
                        <strong>{c.label}</strong>
                        <span>{c.message}</span>
                        {!c.ok && c.fix && <small>Fix: {c.fix}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <ResultBanner result={configResult} />
            </Card>
          )}

          {activeSection === "api" && (
            <Card>
              <h3>Step 2 — ZATCA API Explorer</h3>
              <p className="zatca-test-help">
                Full dynamic test panel matching ZATCA Sandbox Swagger (ISB 2.1.0). Server:{" "}
                <code>{config.api?.baseUrl}</code>. Run operations in order: Compliance CSID →
                Compliance Invoice → Production CSID → Reporting / Clearance.
              </p>

              <div className="zatca-api-explorer-list">
                {apiOperations.map((op) => {
                  const isOpen = expandedApiOp === op.id;
                  const opResult = apiOpResults[op.id];
                  return (
                    <div key={op.id} className={`zatca-api-explorer-item ${isOpen ? "open" : ""}`}>
                      <button
                        type="button"
                        className="zatca-api-explorer-header"
                        onClick={() => setExpandedApiOp(isOpen ? null : op.id)}
                      >
                        <span className="zatca-api-method">{op.method}</span>
                        <strong>{op.name}</strong>
                        <code>{op.path}</code>
                        {opResult && (
                          <Badge variant={opResult.success ? "success" : "danger"}>
                            {opResult.success ? "OK" : "Failed"}
                          </Badge>
                        )}
                      </button>

                      {isOpen && (
                        <div className="zatca-api-explorer-body">
                          <ZatcaApiOperationPanel
                            operationId={op.id}
                            config={config}
                            form={form}
                            updateField={updateField}
                            busy={busy}
                            result={apiOpResults[op.id]}
                            prerequisites={zatcaTestService.getOperationPrerequisites(op.id, mergedSettings)}
                            prepStepResults={prepStepResults}
                            compact
                            onRunLocalStep={(stepId) => run(() => runLocalPrepStep(stepId))}
                            onRun={() => run(() => runApiOperation(op.id))}
                          />
                          {apiOpResults[op.id] && (
                            <>
                              <p style={{ marginTop: "0.75rem" }}>
                                <strong>HTTP Status:</strong> {apiOpResults[op.id].httpStatus ?? "N/A"}{" "}
                                {apiOpResults[op.id].durationMs != null && `(${apiOpResults[op.id].durationMs}ms)`}
                              </p>
                              <JsonBlock label="Request" data={apiOpResults[op.id].request} onCopy={copyText} />
                              <JsonBlock label="Response" data={apiOpResults[op.id].response} onCopy={copyText} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {apiResult && <ResultBanner result={apiResult} />}
            </Card>
          )}

          {activeSection === "cert" && (
            <Card>
              <h3>Step 3 — Certificate Validation</h3>
              <p className="zatca-test-help">
                Checks that your Compliance CSID certificate is valid, not expired, and matches your
                private key (secp256k1).
              </p>
              <Input
                label="Device ID (required for ZATCA)"
                value={form[K.DEVICE_ID]}
                onChange={(e) => updateField(K.DEVICE_ID, e.target.value)}
                placeholder="e.g. EGS-001"
              />
              <Input
                label="Device Serial (alternative)"
                value={form[K.DEVICE_SERIAL]}
                onChange={(e) => updateField(K.DEVICE_SERIAL, e.target.value)}
                placeholder="e.g. POS-001"
                style={{ marginTop: "0.75rem" }}
              />
              <p className="zatca-test-meta" style={{ marginTop: "0.75rem" }}>
                Certificate: {summarizeCertificate(form[K.CERTIFICATE] || form[K.COMPLIANCE_CSID])} ·
                Secret: {maskSecret(form[K.SECRET])}
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await zatcaTestService.testCertificates(mergedSettings);
                    setCertResult(result);
                    if (result.repairedCertificate && result.normalizedCertificate) {
                      updateField(K.CERTIFICATE, result.normalizedCertificate);
                      updateField(K.COMPLIANCE_CSID, result.normalizedCertificate);
                    }
                  })
                }
              >
                <Play size={16} /> Validate Certificates
              </Button>
              {certResult?.results && (
                <ul className="zatca-test-checklist">
                  {certResult.results.map((r) => (
                    <li key={r.id} className={r.passed ? "pass" : "fail"}>
                      {r.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <div>
                        <strong>{r.label}</strong>
                        <span>{r.message}</span>
                        {r.fix && <small>Fix: {r.fix}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <ResultBanner result={certResult} />
            </Card>
          )}

          {activeSection === "invoice" && (
            <Card>
              <h3>Step 4 — Dummy Invoice Generator</h3>
              <p className="zatca-test-help">
                Creates a sample invoice automatically — seller, customer, products, VAT, QR, UUID, and XML. No manual entry.
              </p>
              <Button disabled={busy} onClick={() => run(async () => setInvoiceResult(await zatcaTestService.generateTestInvoice(mergedSettings)))}>
                <Play size={16} /> Generate Test Invoice
              </Button>
              {invoiceResult && (
                <div className="zatca-test-invoice-preview">
                  <p><strong>Invoice #:</strong> {invoiceResult.sale?.sale_number}</p>
                  <p><strong>UUID:</strong> {invoiceResult.uuid}</p>
                  <p><strong>Total:</strong> SAR {invoiceResult.sale?.total}</p>
                  {invoiceResult.qrDataUrl && (
                    <img src={invoiceResult.qrDataUrl} alt="Test QR" width={120} height={120} />
                  )}
                  <JsonBlock label="Invoice JSON" data={invoiceResult.payload} onCopy={copyText} />
                  <JsonBlock label="XML" data={invoiceResult.xml} onCopy={copyText} />
                </div>
              )}
            </Card>
          )}

          {activeSection === "offline" && (
            <Card>
              <h3>Step 5 — Offline Mode Test</h3>
              <p className="zatca-test-help">
                Simulates no internet: creates a test sale, saves it locally, and adds it to the ZATCA queue as Pending.
              </p>
              <Button disabled={busy} onClick={() => run(async () => {
                const result = await zatcaTestService.testOfflineMode(mergedSettings);
                setOfflineResult(result);
                await loadQueue();
              })}>
                <WifiOff size={16} /> Test Offline Mode
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => { zatcaTestService.endOfflineSimulation(); setOfflineResult({ passed: true, summary: "Offline simulation turned off. You can sync again." }); }} style={{ marginLeft: "0.5rem" }}>
                Disable Offline Simulation
              </Button>
              <ResultBanner result={offlineResult} />
              {offlineResult?.queueStats && (
                <p>Queue: {offlineResult.queueStats.pending} pending, {offlineResult.queueStats.synced} synced</p>
              )}
            </Card>
          )}

          {activeSection === "online" && (
            <Card>
              <h3>Step 6 — Online Synchronization Test</h3>
              <p className="zatca-test-help">
                Sends pending invoices to ZATCA and shows whether each invoice reached Sandbox (or Production) with dates and HTTP status.
              </p>

              <ZatcaSyncStatusBanner
                context={syncReadiness}
                queueStats={syncReadiness?.queueStats}
                lastSyncAt={syncReadiness?.lastSyncAt}
              />

              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await zatcaTestService.testOnlineSync(mergedSettings);
                    setOnlineResult(result);
                    await loadQueue();
                    await loadLogs();
                  })
                }
                style={{ marginTop: "1rem" }}
              >
                <CloudUpload size={16} /> Test Online Sync
              </Button>

              <SyncActionResultPanel result={onlineResult} />
            </Card>
          )}

          {activeSection === "queue" && (
            <Card>
              <h3>Step 7 — Queue Monitor</h3>
              <p className="zatca-test-help">
                Manage the offline queue. Each action shows a clear result — environment, target API, and timestamps.
              </p>

              <ZatcaSyncStatusBanner
                context={syncReadiness}
                queueStats={syncReadiness?.queueStats}
                lastSyncAt={syncReadiness?.lastSyncAt}
              />

              <div className="zatca-test-actions" style={{ marginTop: "1rem" }}>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => runQueueAction("Sync All", () => zatcaService.syncAll(syncSettings))}
                >
                  Sync All
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || !selectedQueueIds.length}
                  onClick={() =>
                    runQueueAction("Sync Selected", () =>
                      zatcaService.syncSelected(selectedQueueIds, syncSettings)
                    )
                  }
                >
                  Sync Selected
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    runQueueAction("Retry Failed", () => zatcaService.retryFailed(null, syncSettings))
                  }
                >
                  Retry Failed
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => runQueueAction("Clear Completed", () => zatcaTestService.clearCompletedQueue())}
                >
                  Clear Completed
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => runQueueAction("Refresh", () => {})}>
                  <RefreshCw size={16} /> Refresh
                </Button>
              </div>

              <SyncActionResultPanel result={queueActionResult} />

              {queueLoading ? (
                <LoadingSpinner message="Loading queue..." />
              ) : (
                <Table
                  columns={queueColumns}
                  data={queueItems}
                  keyField="id"
                  emptyMessage="No invoices in queue yet. Run Step 5 (Offline Test) first."
                />
              )}
            </Card>
          )}

          {activeSection === "logs" && (
            <Card>
              <h3>Step 8 — API Logs</h3>
              <p className="zatca-test-help">Every ZATCA API call is logged here for debugging.</p>
              <div className="zatca-test-actions">
                <Button variant="secondary" onClick={() => loadLogs()}><RefreshCw size={16} /> Refresh</Button>
                <Button variant="secondary" onClick={() => run(async () => { await zatcaTestService.clearApiLogs(); await loadLogs(); })}>Clear Logs</Button>
              </div>
              {apiLogs.length === 0 ? (
                <p className="zatca-test-help">No API logs yet. Run API Connection Test or Online Sync.</p>
              ) : (
                <div className="zatca-test-logs">
                  {apiLogs.map((log) => (
                    <details key={log.id} className="zatca-test-log-item">
                      <summary>
                        <Badge variant={log.success ? "success" : "danger"}>{log.success ? "OK" : "FAIL"}</Badge>
                        {formatDateTime(log.created_at)} — {log.method} {log.endpoint?.slice(0, 60)}…
                        {log.http_status ? ` (${log.http_status})` : ""}
                        {log.duration_ms != null ? ` · ${log.duration_ms}ms` : ""}
                      </summary>
                      <JsonBlock label="Request Body" data={log.request_body} onCopy={copyText} />
                      <JsonBlock label="Response Body" data={log.response_body} onCopy={copyText} />
                      {log.error_message && <Alert type="error">{log.error_message}</Alert>}
                    </details>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
