import { ZATCA_ENVIRONMENTS } from "../core/constants";
import { pemToZatcaAuthToken } from "../core/certificateUtils";

/**
 * Resolve which ZATCA API to use for queue sync based on available credentials.
 * - Production CSID → Reporting API (/invoices/reporting/single)
 * - Compliance CSID only → Compliance Invoice API (/compliance/invoices) for sandbox testing
 */
export function resolveSyncApiOperation(config) {
  const creds = config.credentials || {};

  const hasProduction =
    Boolean(creds.productionAuthToken) || Boolean(creds.productionCsid?.trim());
  const hasCompliance =
    Boolean(creds.complianceAuthToken) ||
    Boolean(creds.complianceCsid?.trim()) ||
    Boolean(creds.certificate?.trim() && creds.secret);

  if (hasProduction) {
    return {
      operationId: "reporting_single",
      label: "Reporting API (Production CSID)",
      authMode: "production",
    };
  }

  if (hasCompliance) {
    return {
      operationId: "compliance_invoice",
      label: "Compliance Invoice API (Compliance CSID — sandbox testing)",
      authMode: "compliance",
    };
  }

  return {
    operationId: null,
    label: null,
    authMode: null,
    error:
      "No ZATCA credentials. Run Compliance CSID in API Explorer first, then Production CSID for live reporting.",
  };
}

export function resolveAuthToken(creds, authMode) {
  if (!creds) return "";

  if (authMode === "production") {
    if (creds.productionAuthToken) {
      return String(creds.productionAuthToken).replace(/\s/g, "");
    }
    if (creds.productionCsid) {
      return pemToZatcaAuthToken(creds.productionCsid);
    }
    return "";
  }

  if (authMode === "compliance") {
    if (creds.complianceAuthToken) {
      return String(creds.complianceAuthToken).replace(/\s/g, "");
    }
    if (creds.complianceCsid) {
      return pemToZatcaAuthToken(creds.complianceCsid);
    }
    if (creds.certificate) {
      return pemToZatcaAuthToken(creds.certificate);
    }
  }

  return "";
}

export function buildSyncContext(config) {
  const route = resolveSyncApiOperation(config);
  const readiness = describeSyncReadiness(config);
  const env = config.environment;
  const isSandbox = env === ZATCA_ENVIRONMENTS.SANDBOX;
  const isProduction = env === ZATCA_ENVIRONMENTS.PRODUCTION;
  const isSimulation = env === ZATCA_ENVIRONMENTS.SIMULATION;

  let targetApiUrl = config.api?.baseUrl || "";
  let targetApiPath = "";
  if (route.operationId === "compliance_invoice") {
    targetApiUrl = config.api?.complianceInvoicesUrl || `${config.api?.baseUrl}/compliance/invoices`;
    targetApiPath = "/compliance/invoices";
  } else if (route.operationId === "reporting_single") {
    targetApiUrl = config.api?.reportingUrl || `${config.api?.baseUrl}/invoices/reporting/single`;
    targetApiPath = "/invoices/reporting/single";
  }

  return {
    ...readiness,
    route,
    environment: env,
    environmentLabel: config.environmentLabel || env,
    isSandbox,
    isProduction,
    isSimulation,
    sendsToZatca: !isSimulation,
    targetApiUrl,
    targetApiPath,
    destinationSummary: isSimulation
      ? "Local simulation — no HTTP call to ZATCA"
      : isSandbox
        ? `ZATCA Sandbox (${targetApiPath || "configure CSID first"})`
        : isProduction
          ? `ZATCA Production (${targetApiPath || "configure CSID first"})`
          : env,
  };
}

export function formatSyncActionSummary(action, result, context) {
  const dest = context?.destinationSummary || "ZATCA";
  const when = new Date().toLocaleString();

  if (result?.error && result.success === false && !result.results) {
    return {
      passed: false,
      summary: `${action} failed: ${result.error}`,
      detail: `Environment: ${context?.environmentLabel || "—"} · ${dest} · ${when}`,
    };
  }

  if (result?.queued) {
    return {
      passed: true,
      summary: result.message || "Items reset to pending.",
      detail: `Environment: ${context?.environmentLabel || "—"} · ${when}`,
    };
  }

  if (action === "Clear Completed") {
    const n = result?.cleared ?? 0;
    return {
      passed: true,
      summary: n ? `Removed ${n} completed invoice(s) from the queue.` : "No completed invoices to remove.",
      detail: when,
    };
  }

  if (action === "Refresh") {
    const stats = result?.stats;
    return {
      passed: true,
      summary: stats
        ? `Queue: ${stats.pending} pending, ${stats.synced} synced, ${stats.failed} failed (${stats.total} total).`
        : "Queue refreshed.",
      detail: `${dest} · ${when}`,
    };
  }

  const synced = result?.synced ?? 0;
  const failed = result?.failed ?? 0;
  const total = result?.total ?? result?.results?.length ?? 0;
  const skipped = result?.results?.filter((r) => r.skipped)?.length ?? 0;
  const firstResult = result?.results?.[0] || result;
  const verificationHint = firstResult?.verificationHint;

  if (total === 0 && action !== "Retry Failed") {
    return {
      passed: true,
      summary: "Nothing to sync — queue has no pending invoices. Run Step 5 (Offline Test) first.",
      detail: `${dest} · ${when}`,
    };
  }

  const apiLabel = context?.route?.label || "ZATCA API";
  const singleSuccess = result?.success === true && total <= 1;
  const passed = singleSuccess || (failed === 0 && synced > 0);

  return {
    passed,
    summary: passed
      ? singleSuccess
        ? `${action}: invoice accepted by ${dest}.`
        : `${action}: ${synced} invoice(s) sent to ${dest} via ${apiLabel}.`
      : `${action}: ${synced} succeeded, ${failed} failed${skipped ? `, ${skipped} skipped (max retries)` : ""} of ${total}.`,
    detail: verificationHint
      ? `${verificationHint} · Target: ${context?.targetApiUrl || "—"} · ${when}`
      : `Target: ${context?.targetApiUrl || "—"} · ${when}`,
    results: result?.results,
  };
}

export function describeSandboxVerification(config, apiResult) {
  if (config.environment !== ZATCA_ENVIRONMENTS.SANDBOX) {
    return "Invoice reported to ZATCA. Check your production Fatoora portal for clearance status.";
  }

  const disposition =
    apiResult?.response?.validationResults?.status ||
    apiResult?.response?.reportingStatus ||
    apiResult?.status;

  const infoStatus = disposition ? ` ZATCA status: ${disposition}.` : "";
  return (
    "Sandbox compliance check passed — ZATCA accepted this test invoice." +
    infoStatus +
    " Open Step 8 (API Logs) for the full JSON response. In Fatoora Developer Portal → Compliance checks, " +
    "confirm your device CSID is active. Compliance invoices are validated via API (not listed like production invoices)."
  );
}

export function describeSyncReadiness(config) {
  const route = resolveSyncApiOperation(config);
  if (route.error) {
    return { ready: false, message: route.error, route };
  }

  const creds = config.credentials;
  const token = resolveAuthToken(creds, route.authMode);
  const secret =
    route.authMode === "production"
      ? creds.productionSecret || creds.secret
      : creds.complianceSecret || creds.secret;
  if (!token || !secret) {
    return {
      ready: false,
      message:
        route.authMode === "production"
          ? "Production CSID or secret missing. Run Step 6 — Production CSID first."
          : "Certificate or secret missing. Re-run Compliance CSID with a fresh OTP.",
      route,
    };
  }

  if (route.authMode === "production" && !creds.productionCsid?.trim() && !creds.productionAuthToken?.trim()) {
    return {
      ready: false,
      message:
        "Reporting API requires Production CSID (Step 6). Compliance CSID alone is not enough.",
      route,
    };
  }

  if (config.environment === ZATCA_ENVIRONMENTS.SIMULATION) {
    return {
      ready: true,
      message: "Simulation mode — sync will not call ZATCA (local test only).",
      route,
      environment: config.environment,
      isSandbox: false,
    };
  }

  return {
    ready: true,
    message: `Ready to sync to ${config.environmentLabel || config.environment} using ${route.label}.`,
    route,
    environment: config.environment,
    isSandbox: config.environment === ZATCA_ENVIRONMENTS.SANDBOX,
  };
}

export function explainSyncHttpError(status, authMode, operationId) {
  if (status !== 401) return null;

  if (operationId === "reporting_single") {
    return (
      "HTTP 401 — Reporting API rejected credentials. Use Production CSID (POST /production/csids), " +
      "not Compliance CSID. Re-run Production CSID and ensure secret matches."
    );
  }

  if (operationId === "compliance_invoice") {
    return (
      "HTTP 401 — Compliance Invoice API rejected credentials. Re-run Compliance CSID with a fresh OTP " +
      "and confirm the secret in Settings matches the API response."
    );
  }

  return `HTTP 401 — Authentication failed (${authMode || "unknown"} credentials). Re-run CSID onboarding steps.`;
}
