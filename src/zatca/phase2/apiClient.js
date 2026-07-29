import { zatcaLogger } from "../core/logger";
import { ZATCA_ENVIRONMENTS } from "../core/constants";

/**
 * Sandbox/production ZATCA Fatoora API client.
 * Placeholder — wire real mTLS + UBL signing when certificates are provided.
 */
export class ZatcaApiClient {
  constructor(config) {
    this.config = config;
  }

  get headers() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      AcceptVersion: "V2",
      "Accept-Language": "en",
    };
  }

  async submitReportingInvoice(invoicePayload) {
    const url = this.config.api.reportingUrl;

    if (this.config.environment === ZATCA_ENVIRONMENTS.SANDBOX) {
      zatcaLogger.info("Sandbox reporting invoice (placeholder)", {
        url,
        saleNumber: invoicePayload.saleNumber,
      });

      if (!this.config.credentials.certificate || !this.config.credentials.privateKey) {
        return {
          success: false,
          sandbox: true,
          status: "pending_credentials",
          message:
            "Sandbox submission placeholder — add certificate and private key in ZATCA Settings.",
          invoiceUuid: `SANDBOX-${Date.now()}`,
          warnings: ["Certificate and private key not configured."],
        };
      }

      return {
        success: true,
        sandbox: true,
        status: "accepted_placeholder",
        message:
          "Sandbox API call ready — implement signed UBL submission when keys are provided.",
        invoiceUuid: `SANDBOX-${Date.now()}`,
        reportingUrl: url,
      };
    }

    zatcaLogger.info("Production reporting invoice (placeholder)", { url });
    return {
      success: false,
      sandbox: false,
      status: "not_implemented",
      message: "Production submission requires validated certificates. Configure production CSID.",
    };
  }

  async requestComplianceCsid() {
    zatcaLogger.info("Compliance CSID request (placeholder)", {
      url: this.config.api.complianceUrl,
    });
    return {
      success: false,
      message: "Compliance CSID onboarding placeholder — provide OTP and CSR in ZATCA Settings.",
    };
  }
}
