import { ZATCA_PHASES } from "../core/constants";

/** Step definitions for the ZATCA onboarding wizard — linked to api/registry.js via apiId. */
export const ZATCA_ONBOARDING_STEPS = {
  [ZATCA_PHASES.PHASE1]: [
    {
      id: "phase1_config",
      title: "Step 1 — Validate Phase 1 configuration",
      description:
        "Checks VAT number and company name required for simplified tax invoice QR codes.",
      method: null,
      endpoint: null,
      phase: ZATCA_PHASES.PHASE1,
    },
    {
      id: "phase1_qr",
      title: "Step 2 — Test QR generation",
      description:
        "Generates a sample Phase 1 TLV QR code locally. No API call — works offline.",
      method: null,
      endpoint: null,
      phase: ZATCA_PHASES.PHASE1,
    },
  ],
  [ZATCA_PHASES.PHASE2]: [
    {
      id: "phase2_config",
      title: "Step 1 — Validate Phase 2 configuration",
      description: "Checks company, device, and credential prerequisites for Phase 2.",
      method: null,
      endpoint: null,
      phase: ZATCA_PHASES.PHASE2,
    },
    {
      id: "private_key",
      title: "Step 2 — Private key",
      description:
        "Ensures a secp256k1 private key exists on this device. Required before CSR generation.",
      method: null,
      endpoint: null,
      phase: ZATCA_PHASES.PHASE2,
    },
    {
      id: "generate_csr",
      title: "Step 3 — Generate CSR",
      description:
        "Creates a Certificate Signing Request (CSR) using OpenSSL on this device.",
      method: null,
      endpoint: null,
      phase: ZATCA_PHASES.PHASE2,
    },
    {
      id: "compliance_csid",
      apiId: "compliance_csid",
      title: "Step 4 — Compliance CSID API",
      description:
        "POST /compliance — Issues Compliance CSID (CCSID) from OTP + CSR. Matches ZATCA Swagger.",
      method: "POST",
      endpoint: "/compliance",
      phase: ZATCA_PHASES.PHASE2,
      fields: ["otp"],
    },
    {
      id: "compliance_invoice",
      apiId: "compliance_invoice",
      title: "Step 5 — Compliance Invoice API",
      description:
        "POST /compliance/invoices — Submit test invoice for compliance validation.",
      method: "POST",
      endpoint: "/compliance/invoices",
      phase: ZATCA_PHASES.PHASE2,
      fields: [],
    },
    {
      id: "production_csid",
      apiId: "production_csid_onboarding",
      title: "Step 6 — Production CSID API",
      description:
        "POST /production/csids — Issues Production CSID using Compliance credentials.",
      method: "POST",
      endpoint: "/production/csids",
      phase: ZATCA_PHASES.PHASE2,
      fields: ["compliance_request_id"],
    },
    {
      id: "reporting_api",
      apiId: "reporting_single",
      title: "Step 7 — Reporting API",
      description:
        "POST /invoices/reporting/single — Report a simplified test invoice.",
      method: "POST",
      endpoint: "/invoices/reporting/single",
      phase: ZATCA_PHASES.PHASE2,
      fields: [],
    },
    {
      id: "clearance_api",
      apiId: "clearance_single",
      title: "Step 8 — Clearance API",
      description:
        "POST /invoices/clearance/single — Clear a standard test invoice.",
      method: "POST",
      endpoint: "/invoices/clearance/single",
      phase: ZATCA_PHASES.PHASE2,
      fields: [],
    },
    {
      id: "renewal_csid",
      apiId: "production_csid_renewal",
      title: "Step 9 — Production CSID Renewal (optional)",
      description:
        "PATCH /production/csids — Renew Production CSID with OTP + new CSR.",
      method: "PATCH",
      endpoint: "/production/csids",
      phase: ZATCA_PHASES.PHASE2,
      fields: ["otp"],
    },
  ],
};

export function getOnboardingStepsForPhase(phase) {
  return ZATCA_ONBOARDING_STEPS[phase] || [];
}
