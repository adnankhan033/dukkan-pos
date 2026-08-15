import { ZATCA_PHASES } from "../core/constants";

function detectPlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/Win/i.test(ua) || /Win/i.test(platform)) return "windows";
  if (/Mac/i.test(ua) || /Mac/i.test(platform)) return "macos";
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return "linux";
  return "unknown";
}

export const ZATCA_LINKS = {
  fatooraPortal: {
    label: "Fatoora Developer Portal",
    url: "https://fatoora.zatca.gov.sa/",
    hint: "Generate OTP and manage your e-invoicing devices",
  },
  zatcaSandbox: {
    label: "ZATCA Sandbox Portal",
    url: "https://sandbox.zatca.gov.sa/",
    hint: "Register and test in the ZATCA sandbox environment",
  },
  zatcaGuide: {
    label: "ZATCA Developer Guide",
    url: "https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/default.aspx",
    hint: "Official documentation for e-invoicing integration",
  },
  opensslInstallMac: {
    label: "Install OpenSSL (Mac)",
    url: "https://formulae.brew.sh/formula/openssl@3",
    hint: "Required once on your Mac to generate CSR keys",
  },
  opensslInstallWindows: {
    label: "Install OpenSSL (Windows)",
    url: "https://slproweb.com/products/Win32OpenSSL.html",
    hint: "Download Win64 OpenSSL v3.x Light, enable Add to PATH during setup, then restart DukkanPOS",
  },
};

export function getOpensslInstallLink() {
  return detectPlatform() === "windows"
    ? ZATCA_LINKS.opensslInstallWindows
    : ZATCA_LINKS.opensslInstallMac;
}

function getOpensslInstallHint() {
  if (detectPlatform() === "windows") {
    return "Install Win64 OpenSSL v3.x (Light edition is enough), enable Add to PATH during setup, then restart DukkanPOS.";
  }
  return "Install OpenSSL on your Mac, then restart DukkanPOS and try again.";
}

function getOpensslInstallCommandHint() {
  if (detectPlatform() === "windows") {
    return "Download Win64 OpenSSL v3.x from slproweb.com, enable Add to PATH, then restart the app.";
  }
  return "Run: brew install openssl — then restart the app.";
}

export function getUnifiedSetupSteps(phase) {
  if (phase === ZATCA_PHASES.PHASE1) {
    return [
      {
        id: "company",
        label: "Company Details",
        description: "Store name, VAT, CR number, and address",
        help: [
          "Enter your business details below — same information shown on tax invoices.",
          "VAT must be 15 digits, starting and ending with 3 (e.g. 300000000000003 for sandbox testing).",
        ],
        links: [ZATCA_LINKS.zatcaGuide],
      },
      {
        id: "qr",
        label: "Phase 1 QR Ready",
        description: "QR codes appear on receipts after each sale",
        help: [
          "Once company details are saved, Phase 1 QR codes are generated automatically on every sale.",
          "No certificate or OTP is needed for Phase 1.",
        ],
        links: [],
      },
    ];
  }

  if (phase === ZATCA_PHASES.PHASE2) {
    return [
      {
        id: "company",
        label: "Company Details",
        description: "Store name, VAT, CR number, and address",
        help: [
          "Fill in all company fields below, then click Save & Continue.",
          "For sandbox testing you can use VAT 300000000000003.",
        ],
        links: [ZATCA_LINKS.zatcaSandbox, ZATCA_LINKS.zatcaGuide],
      },
      {
        id: "keys",
        label: "Keys & CSR",
        description: "Private key and certificate signing request — generated automatically",
        help: [
          "We create a device ID, secp256k1 private key, and CSR on this computer.",
          "This matches the Fatoora platform onboarding flow — no manual OpenSSL steps.",
          detectPlatform() === "windows"
            ? "If this step fails, install OpenSSL once on Windows (link below) and restart the app."
            : "If this step fails, install OpenSSL once on your Mac (link below) and restart the app.",
        ],
        links: [getOpensslInstallLink()],
        auto: true,
      },
      {
        id: "compliance",
        label: "Compliance Certificate",
        description: "OTP from Fatoora portal → Compliance CSID",
        help: [
          "Open the Fatoora Developer Portal and log in with your ZATCA account.",
          "Go to Onboarding → Generate OTP for your solution/device.",
          "Paste the OTP below — we send your CSR to ZATCA and save the Compliance certificate.",
        ],
        links: [ZATCA_LINKS.fatooraPortal],
      },
      {
        id: "production",
        label: "Production Certificate",
        description: "Activate live e-invoicing",
        help: [
          "After Compliance certificate is received, click Activate to get your Production CSID.",
          "Switch Environment to Production when you are ready for live invoices.",
        ],
        links: [ZATCA_LINKS.fatooraPortal, ZATCA_LINKS.zatcaGuide],
        auto: true,
      },
    ];
  }

  return [];
}

export function formatSetupError(error, stepId) {
  const raw =
    typeof error === "string"
      ? error
      : error?.message || error?.toString?.() || "Unknown error";

  if (/openssl|OpenSSL/i.test(raw)) {
    return {
      message: raw,
      links: [getOpensslInstallLink()],
      hint: getOpensslInstallHint(),
    };
  }

  if (/OTP|otp/i.test(raw)) {
    return {
      message: raw,
      links: [ZATCA_LINKS.fatooraPortal],
      hint: "Get a fresh OTP from the Fatoora Developer Portal (OTP expires quickly).",
    };
  }

  if (/certificate-permissions|certificate VAT|does not match.*certificate VAT/i.test(raw)) {
    return {
      message: raw,
      links: [ZATCA_LINKS.fatooraPortal],
      hint:
        "The invoice must use the VAT embedded in your Production CSID certificate. " +
        "In sandbox, use test VAT 300000000000003. If you changed store VAT after generating CSR, " +
        "regenerate Keys & CSR, then request new Compliance and Production certificates.",
    };
  }

  if (/XML-INVOICE-ERROR|not a Standard TAX document/i.test(raw)) {
    return {
      message: raw,
      links: [ZATCA_LINKS.zatcaGuide],
      hint:
        "Clearance API is for Standard (B2B) tax invoices. DukkanPOS retail sales use Simplified invoices via the Reporting API. " +
        "The Clearance test now generates a standard invoice with sandbox buyer VAT 301121971500003.",
    };
  }

  if (stepId === "keys" && !raw.trim()) {
    return {
      message:
        detectPlatform() === "windows"
          ? "Could not generate CSR. OpenSSL may not be installed on this PC."
          : "Could not generate CSR. OpenSSL may not be installed on this Mac.",
      links: [getOpensslInstallLink()],
      hint: getOpensslInstallCommandHint(),
    };
  }

  return { message: raw || "Step failed.", links: [], hint: null };
}
