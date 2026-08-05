import QRCode from "qrcode";
import { ZATCA_PHASES } from "../core/constants";
import {
  resolveZatcaIssueDateTime,
  normalizeZatcaIssueTime,
  formatZatcaQrTimestamp,
} from "../phase2/invoiceSigner.js";

function encodeTLV(tag, value) {
  const valueBytes = new TextEncoder().encode(String(value));
  if (valueBytes.length > 255) {
    throw new Error(`TLV value too long for tag ${tag}`);
  }
  const result = new Uint8Array(2 + valueBytes.length);
  result[0] = tag;
  result[1] = valueBytes.length;
  result.set(valueBytes, 2);
  return result;
}

function concatBytes(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

/** ZATCA Phase 1 TLV payload (tags 1–5) encoded as Base64. */
export function buildZatcaQrPayload({ sellerName, vatNumber, timestamp, total, vatTotal }) {
  const tlv = concatBytes([
    encodeTLV(1, sellerName),
    encodeTLV(2, vatNumber),
    encodeTLV(3, timestamp),
    encodeTLV(4, Number(total).toFixed(2)),
    encodeTLV(5, Number(vatTotal).toFixed(2)),
  ]);

  let binary = "";
  for (let i = 0; i < tlv.length; i++) {
    binary += String.fromCharCode(tlv[i]);
  }
  return btoa(binary);
}

export function formatZatcaTimestamp(dateStr) {
  const { issue_date, issue_time } = resolveZatcaIssueDateTime({ created_at: dateStr });
  return formatZatcaQrTimestamp(issue_date, issue_time);
}

export { resolveZatcaIssueDateTime, normalizeZatcaIssueTime, formatZatcaQrTimestamp };

export async function generateQrDataUrl({ sellerName, vatNumber, sale }) {
  const payload = buildZatcaQrPayload({
    sellerName,
    vatNumber,
    timestamp: formatZatcaTimestamp(sale.created_at),
    total: sale.total,
    vatTotal: sale.vat,
  });

  return QRCode.toDataURL(payload, {
    width: 160,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/** Phase 2 will extend TLV with tags 6–9 (invoice hash, signature, etc.). */
export function buildPhase2QrPayloadPlaceholder(basePayload, invoiceHash) {
  return {
    phase: ZATCA_PHASES.PHASE2,
    basePayload,
    invoiceHash: invoiceHash || "",
    note: "Phase 2 extended TLV tags will be appended when certificates are configured.",
  };
}
