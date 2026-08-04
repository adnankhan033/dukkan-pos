import { invoke, isTauri } from "@tauri-apps/api/core";
import { isValidPrivateKeyPem } from "../onboarding/keyGenerator";
import {
  pemToBase64Token,
  normalizeCertificatePem,
  isCertificateLike,
  resolveStoredCertificate,
} from "../core/certificateUtils";

/** Validate ZATCA certificate and private key using OpenSSL (desktop) or basic checks. */
export async function validateZatcaCertificate({
  certificate,
  privateKey,
  deviceId,
  complianceCsid,
}) {
  const results = [];
  let allPassed = true;

  const certPem = normalizeCertificatePem(
    certificate || complianceCsid || resolveStoredCertificate({ certificate, complianceCsid })
  );
  const keyPem = String(privateKey || "").trim();

  if (!certPem) {
    results.push({
      id: "cert_present",
      label: "Certificate file exists",
      passed: false,
      message: "No certificate found. Complete the Compliance CSID step first.",
      fix: "Go to ZATCA Test Center → API Explorer → Run POST /compliance, or paste your certificate in Settings → ZATCA.",
    });
    allPassed = false;
  } else if (!isCertificateLike(certPem)) {
    results.push({
      id: "cert_format",
      label: "Certificate format is valid",
      passed: false,
      message: "Certificate must be PEM or ZATCA base64 token (binarySecurityToken).",
      fix: "Paste the full PEM including BEGIN/END lines, or the binarySecurityToken from ZATCA.",
    });
    allPassed = false;
  } else {
    results.push({
      id: "cert_present",
      label: "Certificate file exists",
      passed: true,
      message: certPem.includes("BEGIN CERTIFICATE")
        ? "Certificate is present and normalized to PEM format."
        : "Certificate token present.",
    });
  }

  if (!keyPem) {
    results.push({
      id: "key_present",
      label: "Private key exists",
      passed: false,
      message: "No private key found on this device.",
      fix: "Run the Private Key step in API Explorer or open Settings → ZATCA.",
    });
    allPassed = false;
  } else if (!isValidPrivateKeyPem(keyPem)) {
    results.push({
      id: "key_format",
      label: "Private key format is valid",
      passed: false,
      message: "Private key must be a valid PEM EC or PKCS8 key.",
      fix: "Regenerate the private key in Settings → ZATCA.",
    });
    allPassed = false;
  } else {
    results.push({
      id: "key_present",
      label: "Private key exists",
      passed: true,
      message: "Private key is present and looks correctly formatted.",
    });
  }

  if (certPem && keyPem && isTauri()) {
    try {
      const opensslResult = await invoke("validate_zatca_certificate", {
        certificatePem: certPem,
        privateKeyPem: keyPem,
      });

      results.push({
        id: "cert_expiry",
        label: "Certificate has not expired",
        passed: opensslResult.not_expired,
        message: opensslResult.not_expired
          ? `Certificate is valid until ${opensslResult.not_after || "unknown"}.`
          : `Certificate expired on ${opensslResult.not_after || "unknown"}.`,
        fix: opensslResult.not_expired
          ? null
          : "Request a new Compliance or Production CSID from ZATCA.",
      });

      results.push({
        id: "key_match",
        label: "Private key matches certificate",
        passed: opensslResult.key_matches,
        message: opensslResult.key_matches
          ? "The private key on this device matches the certificate public key."
          : "The private key does NOT match the certificate.",
        fix: opensslResult.key_matches
          ? null
          : "Use the same private key that was used to generate the CSR for this CSID.",
      });

      if (!opensslResult.not_expired || !opensslResult.key_matches) allPassed = false;
    } catch (err) {
      results.push({
        id: "openssl_check",
        label: "OpenSSL certificate check",
        passed: false,
        message: `Could not run OpenSSL validation: ${err.message || err}`,
        fix:
          "Ensure OpenSSL is installed. If the certificate is from ZATCA, re-run Compliance CSID to refresh it.",
      });
      allPassed = false;
    }
  }

  const device = String(deviceId || "").trim();
  if (!device) {
    results.push({
      id: "device_id",
      label: "Device is registered (Device ID set)",
      passed: false,
      message: "Device ID or Device Serial is missing.",
      fix: "Enter Device ID (e.g. EGS-001) in Settings → ZATCA → Device (EGS) or ZATCA Test Center → Configuration.",
    });
    allPassed = false;
  } else {
    results.push({
      id: "device_id",
      label: "Device is registered (Device ID set)",
      passed: true,
      message: `Device: ${device}`,
    });
  }

  return {
    passed: allPassed,
    results,
    normalizedCertificate: certPem || null,
    summary: allPassed
      ? "All certificate checks passed."
      : "Some certificate checks failed. See details below.",
  };
}

export function maskSecret(value) {
  const str = String(value || "");
  if (str.length <= 8) return str ? "••••••••" : "";
  return `${str.slice(0, 4)}••••${str.slice(-4)}`;
}

export function summarizeCertificate(certificate) {
  if (!certificate?.trim()) return "Not set";
  const b64 = pemToBase64Token(normalizeCertificatePem(certificate));
  return b64 ? `${b64.slice(0, 12)}…${b64.slice(-8)}` : "Invalid format";
}
