import { zatcaLogger } from "../core/logger";
import { ZATCA_ENVIRONMENTS } from "../core/constants";
import { executeZatcaApiOperation } from "../api/executor";
import { pemToZatcaAuthToken, base64TokenToPem, normalizeCertificatePem } from "../core/certificateUtils";

/**
 * ZATCA Fatoora API client — thin wrapper over the dynamic API executor.
 * @see src/zatca/api/registry.js
 */
export class ZatcaApiClient {
  constructor(config, settings = null) {
    this.config = config;
    this.settings = settings;
  }

  _settingsPayload() {
    return this.settings || this._configToSettings();
  }

  _configToSettings() {
    const c = this.config;
    return {
      zatca_environment: c.environment,
      zatca_api_base_url: c.api?.baseUrl,
      zatca_certificate_request: c.credentials?.certificateRequest,
      zatca_compliance_csid: c.credentials?.complianceCsid,
      zatca_compliance_request_id: c.credentials?.complianceRequestId,
      zatca_production_csid: c.credentials?.productionCsid,
      zatca_certificate: c.credentials?.certificate,
      zatca_secret: c.credentials?.secret,
      zatca_otp: c.credentials?.otp,
    };
  }

  async requestComplianceCsid({ otp, csrBase64 }) {
    const result = await executeZatcaApiOperation("compliance_csid", {
      settings: this._settingsPayload(),
      inputs: { otp, csrBase64 },
    });

    return this._mapCsidResult(result);
  }

  async requestProductionCsid({ complianceRequestId }) {
    const result = await executeZatcaApiOperation("production_csid_onboarding", {
      settings: this._settingsPayload(),
      inputs: { compliance_request_id: complianceRequestId },
    });

    return this._mapCsidResult(result);
  }

  async requestProductionCsidRenewal({ otp, csrBase64 }) {
    const result = await executeZatcaApiOperation("production_csid_renewal", {
      settings: this._settingsPayload(),
      inputs: { otp, csrBase64 },
    });

    return this._mapCsidResult(result);
  }

  async submitComplianceInvoice(invoicePayload) {
    return this._submitInvoice("compliance_invoice", invoicePayload);
  }

  async submitReportingInvoice(invoicePayload) {
    if (this.config.environment === ZATCA_ENVIRONMENTS.SANDBOX) {
      const cert = this.config.credentials.productionCsid || this.config.credentials.complianceCsid;
      const secret = this.config.credentials.secret;
      const certToken = cert?.includes("BEGIN CERTIFICATE")
        ? pemToZatcaAuthToken(cert)
        : String(cert || "").replace(/\s/g, "");

      if (!certToken || !secret) {
        return {
          success: false,
          sandbox: true,
          status: "pending_credentials",
          message: "Certificate and secret required before invoice submission.",
          invoiceUuid: invoicePayload.uuid,
        };
      }
    }

    return this._submitInvoice("reporting_single", invoicePayload);
  }

  async submitClearanceInvoice(invoicePayload) {
    return this._submitInvoice("clearance_single", invoicePayload);
  }

  async _submitInvoice(operationId, invoicePayload) {
    const egsUuid = invoicePayload.egsUuid || invoicePayload.uuid;
    const inputs = {
      invoice_uuid: egsUuid,
      invoice_hash: invoicePayload.invoiceHash || invoicePayload.hash,
      invoice_base64: invoicePayload.invoiceBase64 || invoicePayload.apiBody?.invoice,
    };

    const result = await executeZatcaApiOperation(operationId, {
      settings: this._settingsPayload(),
      inputs,
    });

    if (result.simulated) {
      return {
        success: true,
        status: "simulated",
        message: result.message,
        invoiceUuid: invoicePayload.uuid,
      };
    }

    if (!result.success) {
      return {
        success: false,
        status: "failed",
        httpStatus: result.httpStatus,
        message: result.message,
        response: result.response,
        invoiceUuid: invoicePayload.uuid,
      };
    }

    return {
      success: true,
      status: "synced",
      message: result.message,
      response: result.response,
      invoiceUuid: invoicePayload.uuid,
    };
  }

  _mapCsidResult(result) {
    if (result.simulated) {
      return {
        success: true,
        status: null,
        message: result.message,
        response: result.response,
      };
    }

    if (!result.success) {
      zatcaLogger.error("ZATCA CSID request failed", result);
      return {
        success: false,
        status: result.httpStatus,
        message: result.message,
        response: result.response,
      };
    }

    const data = result.response;
    const certificatePem = data?.binarySecurityToken
      ? normalizeCertificatePem(base64TokenToPem(data.binarySecurityToken))
      : null;

    return {
      success: true,
      status: result.httpStatus,
      message: data?.dispositionMessage || result.message,
      requestId: data?.requestID,
      binarySecurityToken: data?.binarySecurityToken,
      certificatePem,
      secret: data?.secret || result.savedFields?.zatca_secret,
      response: data,
      savedFields: result.savedFields,
    };
  }
}
