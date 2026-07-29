import QRCode from "qrcode";

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
  const date = dateStr ? new Date(String(dateStr).replace(" ", "T")) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

export function canGenerateZatcaQr(settings) {
  return Boolean(settings?.vat_registration?.trim() && settings?.store_name?.trim());
}

/** Generate a ZATCA Phase 1 QR code as a data URL for receipt printing. */
export async function generateZatcaQrDataUrl({ sale, settings }) {
  if (!canGenerateZatcaQr(settings)) return null;

  const payload = buildZatcaQrPayload({
    sellerName: settings.store_name.trim(),
    vatNumber: settings.vat_registration.trim(),
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
