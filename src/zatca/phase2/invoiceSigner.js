import { invoke, isTauri } from "@tauri-apps/api/core";
import { ZATCA_ENVIRONMENTS } from "../core/constants";
import { resolveStoredCertificate } from "../core/certificateUtils";

/** ZATCA sandbox test CR (10 digits) — invalid placeholder CRN causes BR-KSA-F-13. */
export const ZATCA_SANDBOX_CR_PLACEHOLDER = "1010010000";

/** ZATCA sandbox test VAT. */
export const ZATCA_SANDBOX_VAT_PLACEHOLDER = "300000000000003";

/** Normalize Saudi CR number for invoice XML (BT-29). */
export function normalizeCrnNumber(crn, environment) {
  const digits = String(crn || "").replace(/\D/g, "");
  if (/^\d{10}$/.test(digits) && digits !== "0000000000") {
    return digits;
  }
  if (environment === ZATCA_ENVIRONMENTS.SANDBOX) {
    return ZATCA_SANDBOX_CR_PLACEHOLDER;
  }
  return /^\d{10}$/.test(digits) ? digits : ZATCA_SANDBOX_CR_PLACEHOLDER;
}

/** Parse sale/invoice timestamp into ZATCA IssueDate + IssueTime (Asia/Riyadh, no timezone suffix). */
export function resolveZatcaIssueDateTime(payload = {}) {
  const raw = payload.created_at || payload.sale?.created_at;
  if (raw) {
    const parsed = parseZatcaTimestamp(raw);
    if (parsed) return parsed;
  }

  if (payload.issueDate && payload.issueTime) {
    const time = normalizeZatcaIssueTime(payload.issueTime);
    if (/^\d{2}:\d{2}/.test(time)) {
      return {
        issue_date: String(payload.issueDate).slice(0, 10),
        issue_time: time,
      };
    }
  }

  return zatcaRiyadhNow();
}

export function normalizeZatcaIssueTime(time) {
  const t = String(time || "").trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  return t.slice(0, 8) || "00:00:00";
}

function parseZatcaTimestamp(value) {
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    const [date, timePart] = s.split(" ");
    return { issue_date: date, issue_time: normalizeZatcaIssueTime(timePart) };
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return zatcaPartsFromDate(d);
  }
  return null;
}

function zatcaPartsFromDate(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    issue_date: `${parts.year}-${parts.month}-${parts.day}`,
    issue_time: normalizeZatcaIssueTime(`${parts.hour}:${parts.minute}:${parts.second}`),
  };
}

export function zatcaRiyadhNow() {
  return zatcaPartsFromDate(new Date());
}

/** QR tag 3 / display timestamp — must match XML IssueDate + IssueTime (KSA local, no Z). */
export function formatZatcaQrTimestamp(issue_date, issue_time) {
  const date = String(issue_date || "").slice(0, 10);
  const time = normalizeZatcaIssueTime(String(issue_time || "").replace(/Z$/i, "").trim());
  return `${date}T${time}`;
}

export function resolveBuyerName(payload = {}) {
  return (
    String(payload.buyer?.name || payload.customer_name || "").trim() || "Walk-in Customer"
  );
}

/** ZATCA initial previous-invoice hash (first invoice in chain). */
export const ZATCA_INITIAL_PIH =
  "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidFromSeed(seed) {
  const bytes = new Uint8Array(16);
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
    bytes[i % 16] ^= hash & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** EGS terminal UUID sent to ZATCA as request `uuid` (not the invoice document UUID). */
export function resolveEgsUuid(config) {
  const candidates = [
    config.device?.id,
    config.device?.serial,
    config.device?.egsUnitName,
  ];
  for (const value of candidates) {
    const trimmed = String(value || "").trim();
    if (UUID_RE.test(trimmed)) return trimmed;
  }
  const seed = String(config.device?.serial || config.device?.id || "portal-pos-egs");
  return uuidFromSeed(seed);
}

function defaultLocation(config) {
  const address = String(config.company?.address || "").trim();
  return {
    city: "Riyadh",
    city_subdivision: "District",
    street: address || "Main Street",
    plot_identification: "0000",
    building: "0000",
    postal_zone: "12345",
  };
}

function buildEgsInfo(config, { production = false } = {}) {
  const certificatePem = resolveStoredCertificate(config.credentials);
  const certBody = certificatePem
    ? certificatePem
        .replace(/-----BEGIN CERTIFICATE-----/g, "")
        .replace(/-----END CERTIFICATE-----/g, "")
        .replace(/\s/g, "")
    : "";

  const info = {
    uuid: resolveEgsUuid(config),
    custom_id: config.device?.id || config.device?.serial || "EGS-001",
    model: config.device?.model || "Portal POS",
    CRN_number: normalizeCrnNumber(config.company?.crNumber, config.environment),
    VAT_name: config.company?.name || "Store",
    VAT_number:
      config.company?.vatNumber ||
      (config.environment === ZATCA_ENVIRONMENTS.SANDBOX ? "300000000000003" : ""),
    branch_name: config.device?.egsUnitName || config.company?.name || "Main Branch",
    branch_industry: "Retail",
    location: defaultLocation(config),
    private_key: config.credentials?.privateKey || "",
  };

  if (production) {
    info.production_certificate = certBody;
    info.production_api_secret = config.credentials?.secret || "";
  } else {
    info.compliance_certificate = certBody;
    info.compliance_api_secret = config.credentials?.secret || "";
  }

  return info;
}

function mapLineItems(payload, config) {
  const vatPercent = Number(config.vatPercent || 15) / 100;
  const items = payload.lineItems || payload.items || [];
  if (!items.length) {
    const subtotal = Number(payload.totals?.subtotal ?? payload.subtotal ?? 100);
    const vat = Number(payload.totals?.vat ?? payload.vat ?? subtotal * vatPercent);
    return [
      {
        id: "1",
        name: "Sale Item",
        quantity: 1,
        tax_exclusive_price: subtotal,
        VAT_percent: vatPercent,
      },
    ];
  }

  return items.map((item, index) => ({
    id: String(item.id ?? index + 1),
    name: item.name || item.product_name || `Item ${index + 1}`,
    quantity: Number(item.quantity || 1),
    tax_exclusive_price: Number(item.unitPrice ?? item.unit_price ?? item.total ?? 0),
    VAT_percent: Number(item.vatRate ?? item.vat_rate ?? vatPercent * 100) / 100 || vatPercent,
  }));
}

function buildInvoiceProps(payload, config, { production = false } = {}) {
  const egsInfo = buildEgsInfo(config, { production });
  const { issue_date, issue_time } = resolveZatcaIssueDateTime(payload);

  return {
    egs_info: egsInfo,
    invoice_counter_number: Number(payload.icv || config.chain?.invoiceCounter || 0) + 1,
    invoice_serial_number: payload.saleNumber || payload.sale_number || "INV-001",
    issue_date,
    issue_time,
    previous_invoice_hash:
      config.chain?.previousInvoiceHash?.trim() || ZATCA_INITIAL_PIH,
    line_items: mapLineItems(payload, config),
    buyer_name: resolveBuyerName(payload),
  };
}

/**
 * Build and cryptographically sign a ZATCA simplified tax invoice.
 * Uses zatca-xml-js via Tauri (Node.js + OpenSSL).
 */
export async function signZatcaInvoice(config, payload, { production = false } = {}) {
  if (!isTauri()) {
    throw new Error("Invoice signing requires the Portal POS desktop app.");
  }

  const privateKey = config.credentials?.privateKey?.trim();
  const certificate = resolveStoredCertificate(config.credentials);
  if (!privateKey) {
    throw new Error("Private key missing — generate one in Settings → ZATCA.");
  }
  if (!certificate) {
    throw new Error("Compliance CSID certificate missing — run Compliance CSID in Step 2.");
  }

  const egs_info = buildEgsInfo(config, { production });
  const invoice_props = buildInvoiceProps(payload, config, { production });

  let resultJson;
  try {
    resultJson = await invoke("sign_zatca_invoice", {
      inputJson: JSON.stringify({
        egs_info,
        invoice_props,
        production,
        buyer_name: invoice_props.buyer_name,
      }),
    });
  } catch (err) {
    const detail =
      typeof err === "string"
        ? err
        : err?.message || err?.toString?.() || "Unknown signing error";
    if (detail.includes("DECODE_ERROR")) {
      throw new Error(
        `Invoice signing failed (key/certificate format). Ensure your private key matches the CSR used for Compliance CSID. Detail: ${detail}`
      );
    }
    throw new Error(`Invoice signing failed: ${detail}`);
  }

  const result = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
  const egsUuid = resolveEgsUuid(config);

  return {
    egsUuid,
    signedXml: result.signedXml,
    invoiceHash: result.invoiceHash,
    invoiceBase64: result.invoiceBase64,
    qr: result.qr,
  };
}
