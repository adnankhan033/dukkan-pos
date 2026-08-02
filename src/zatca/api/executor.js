import { ZATCA_ENVIRONMENTS, ZATCA_SETTING_KEYS as K } from "../core/constants";
import { parseZatcaConfig } from "../core/config";
import {
  zatcaHttpRequest,
  formatZatcaApiError,
  buildBasicAuthHeader,
} from "../core/httpClient";
import {
  base64TokenToPem,
  pemToZatcaAuthToken,
  normalizeCertificatePem,
} from "../core/certificateUtils";
import { isValidCsrPem, csrPemToBase64 } from "../onboarding/csrGenerator";
import { zatcaLogger } from "../core/logger";
import { generateTestInvoice } from "../testing/testInvoiceGenerator";
import { resolveEgsUuid } from "../phase2/invoiceSigner";
import { resolveAuthToken } from "../sync/syncRouter";
import {
  ZATCA_AUTH,
  getZatcaApiOperation,
  resolveOperationUrl,
  mapCsidResponseToSettings,
  ZATCA_PREREQUISITE_LABELS,
} from "./registry";

export { resolveOperationUrl, getZatcaApiOperation, listZatcaApiOperations } from "./registry";

function certToToken(cert, creds, authMode) {
  const fromStore = resolveAuthToken(creds, authMode);
  if (fromStore) return fromStore;
  if (!cert) return "";
  if (cert.includes("BEGIN CERTIFICATE")) {
    return pemToZatcaAuthToken(cert);
  }
  return String(cert).replace(/\s/g, "");
}

function encodeBase64(text) {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(text)));
  }
  return Buffer.from(text, "utf8").toString("base64");
}

function buildDefaultHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Version": "V2",
    "Accept-Language": "en",
  };
}

function resolveAuthHeaders(auth, config, inputs) {
  const headers = {};
  const creds = config.credentials;

  if (auth === ZATCA_AUTH.OTP || auth === ZATCA_AUTH.OTP_PRODUCTION_BASIC) {
    const otp = String(inputs.otp || creds.otp || "").trim();
    if (!otp) {
      throw new Error("OTP is required. Get a fresh OTP from the ZATCA Fatoora Developer Portal.");
    }
    // ZATCA Swagger: OTP is integer — send digits only in header
    headers.OTP = otp.replace(/\D/g, "") || otp;
  }

  if (auth === ZATCA_AUTH.COMPLIANCE_BASIC) {
    const token = certToToken(
      creds.complianceCsid || creds.certificate,
      creds,
      "compliance"
    );
    if (!token || !creds.secret) {
      throw new Error("Compliance CSID certificate and secret are required.");
    }
    headers.Authorization = buildBasicAuthHeader(token, creds.secret);
  }

  if (auth === ZATCA_AUTH.PRODUCTION_BASIC || auth === ZATCA_AUTH.OTP_PRODUCTION_BASIC) {
    const token = certToToken(creds.productionCsid, creds, "production");
    if (!token || !creds.secret) {
      throw new Error(
        "Production CSID required for this API. Run POST /production/csids in API Explorer first."
      );
    }
    headers.Authorization = buildBasicAuthHeader(token, creds.secret);
  }

  return headers;
}

function checkPrerequisites(operation, config, settings) {
  const missing = [];
  const creds = config.credentials;

  for (const prereq of operation.prerequisites || []) {
    if (prereq === "csr") {
      const csrPem = settings[K.CERTIFICATE_REQUEST] || creds.certificateRequest;
      if (!isValidCsrPem(csrPem)) {
        missing.push(ZATCA_PREREQUISITE_LABELS.csr);
      }
    }
    if (prereq === "compliance_csid") {
      if (!creds.complianceCsid && !creds.certificate) {
        missing.push(ZATCA_PREREQUISITE_LABELS.compliance_csid);
      }
    }
    if (prereq === "production_csid") {
      if (!creds.productionCsid && !creds.productionAuthToken) {
        missing.push(ZATCA_PREREQUISITE_LABELS.production_csid);
      }
    }
  }

  return missing;
}

async function buildRequestBody(operation, config, settings, inputs) {
  const creds = config.credentials;

  if (operation.id === "compliance_csid") {
    const csrPem = settings[K.CERTIFICATE_REQUEST] || creds.certificateRequest;
    const csrBase64 = inputs.csrBase64 || csrPemToBase64(csrPem);
    if (!csrBase64) {
      throw new Error("CSR is required. Generate CSR in Settings → ZATCA first.");
    }
    return { csr: csrBase64 };
  }

  if (operation.id === "production_csid_onboarding") {
    const complianceRequestId =
      inputs.compliance_request_id ||
      settings[K.COMPLIANCE_REQUEST_ID] ||
      creds.complianceRequestId;
    if (!complianceRequestId) {
      throw new Error("Compliance request ID is required (from Compliance CSID response).");
    }
    return { compliance_request_id: Number(complianceRequestId) || complianceRequestId };
  }

  if (operation.id === "production_csid_renewal") {
    const csrPem = settings[K.CERTIFICATE_REQUEST] || creds.certificateRequest;
    const csrBase64 = inputs.csrBase64 || csrPemToBase64(csrPem);
    if (!csrBase64) {
      throw new Error("CSR is required for renewal. Generate a new CSR first.");
    }
    return { csr: csrBase64 };
  }

  if (operation.usesTestInvoice) {
    const egsUuid = inputs.egs_uuid || resolveEgsUuid(config);

    if (inputs.invoice_hash && inputs.invoice_base64 && egsUuid) {
      return {
        uuid: egsUuid,
        invoiceHash: inputs.invoice_hash,
        invoice: inputs.invoice_base64,
      };
    }

    const testData = await generateTestInvoice(config);
    const invoiceBase64 = inputs.invoice_base64 || encodeBase64(testData.xml);
    return {
      uuid: egsUuid,
      invoiceHash: inputs.invoice_hash || testData.invoiceHash,
      invoice: invoiceBase64,
    };
  }

  return inputs.body || {};
}

function sanitizeRequestForDisplay(requestBody, headers) {
  const safeHeaders = { ...headers };
  if (safeHeaders.OTP) safeHeaders.OTP = "[hidden]";
  if (safeHeaders.Authorization) safeHeaders.Authorization = "[hidden]";

  const safeBody = { ...requestBody };
  if (safeBody.csr && safeBody.csr.length > 32) {
    safeBody.csr = `${safeBody.csr.slice(0, 24)}…`;
  }
  if (safeBody.invoice && safeBody.invoice.length > 32) {
    safeBody.invoice = `${safeBody.invoice.slice(0, 24)}…`;
  }

  return { headers: safeHeaders, body: safeBody };
}

function interpretCsidSuccess(data) {
  const disposition = String(data?.dispositionMessage || "").toUpperCase();
  return disposition === "ISSUED" && Boolean(data?.binarySecurityToken);
}

function interpretComplianceInvoiceSuccess(data) {
  const status = data?.validationResults?.status || data?.reportingStatus || data?.clearanceStatus;
  if (status) return String(status).toUpperCase() === "PASS" || String(status).toUpperCase() === "REPORTED";
  return data?.validationResults != null || data?.reportingStatus != null;
}

/**
 * Execute any registered ZATCA API operation dynamically.
 */
export async function executeZatcaApiOperation(operationId, { settings = {}, inputs = {} } = {}) {
  const operation = getZatcaApiOperation(operationId);
  if (!operation) {
    return { success: false, message: `Unknown API operation: ${operationId}` };
  }

  const config = parseZatcaConfig(settings);

  if (config.environment === ZATCA_ENVIRONMENTS.SIMULATION) {
    return {
      success: true,
      simulated: true,
      operationId,
      message: `Simulation mode — ${operation.name} was not sent to ZATCA.`,
      httpStatus: null,
      request: {
        method: operation.method,
        url: resolveOperationUrl(config, operation),
        note: "Local simulation only",
      },
      response: operation.responseExample || null,
    };
  }

  const missingPrereqs = checkPrerequisites(operation, config, settings);
  if (missingPrereqs.length) {
    return {
      success: false,
      operationId,
      message: `Missing prerequisites: ${missingPrereqs.join("; ")}`,
      missingPrereqs,
    };
  }

  const url = resolveOperationUrl(config, operation);

  try {
    const authHeaders = resolveAuthHeaders(operation.auth, config, inputs);
    const requestBody = await buildRequestBody(operation, config, settings, inputs);
    const headers = { ...buildDefaultHeaders(), ...authHeaders };
    const bodyJson = JSON.stringify(requestBody);

    zatcaLogger.info(`ZATCA API: ${operation.name}`, { method: operation.method, url });

    const response = await zatcaHttpRequest({
      method: operation.method,
      url,
      headers,
      body: bodyJson,
    });

    const displayRequest = {
      method: operation.method,
      url,
      ...sanitizeRequestForDisplay(requestBody, headers),
    };

    if (!response.ok) {
      return {
        success: false,
        operationId,
        httpStatus: response.status,
        durationMs: response.durationMs,
        message: formatZatcaApiError(response),
        request: displayRequest,
        response: response.body,
      };
    }

    const data = response.body;
    let success = true;
    let savedFields = null;
    let message = "Request completed successfully.";

    if (operation.id === "compliance_csid" || operation.id === "production_csid_onboarding" || operation.id === "production_csid_renewal") {
      success = interpretCsidSuccess(data);
      if (success) {
        const certificatePem = normalizeCertificatePem(
          base64TokenToPem(data.binarySecurityToken)
        );
        const kind = operation.id === "compliance_csid" ? "compliance" : "production";
        savedFields = mapCsidResponseToSettings(kind, data, certificatePem);
        message = `${data.dispositionMessage} — ${operation.name} saved to settings.`;
      } else {
        message = data?.dispositionMessage || `${operation.name} was not issued.`;
      }
    } else if (operation.id === "compliance_invoice") {
      success = interpretComplianceInvoiceSuccess(data);
      message = success
        ? "Compliance invoice validation passed."
        : formatZatcaApiError({ status: response.status, body: data }) || "Compliance invoice validation failed.";
    } else if (operation.id === "reporting_single" || operation.id === "clearance_single") {
      const reported =
        data?.reportingStatus === "REPORTED" ||
        data?.clearanceStatus === "CLEARED" ||
        response.status === 200 ||
        response.status === 202;
      success = reported;
      message = success
        ? `${operation.name} accepted by ZATCA.`
        : formatZatcaApiError({ status: response.status, body: data }) || "Invoice submission failed.";
    }

    return {
      success,
      operationId,
      httpStatus: response.status,
      durationMs: response.durationMs,
      message,
      request: displayRequest,
      response: data,
      savedFields,
    };
  } catch (err) {
    return {
      success: false,
      operationId,
      httpStatus: 0,
      message: err.message,
      request: {
        method: operation.method,
        url: resolveOperationUrl(config, operation),
      },
      response: null,
      error: err.message,
    };
  }
}

