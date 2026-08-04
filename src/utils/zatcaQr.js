import QRCode from "qrcode";

/** Render ZATCA TLV base64 payload as a scannable QR image data URL. */
export async function zatcaTlvBase64ToDataUrl(base64Tlv, size = 200) {
  const payload = String(base64Tlv || "").trim();
  if (!payload) return null;

  return QRCode.toDataURL(payload, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

/** Pull Phase 2 QR TLV from signed invoice XML (AdditionalDocumentReference ID=QR). */
export function extractQrTlvFromSignedXml(signedXml) {
  const xml = String(signedXml || "");
  if (!xml) return "";

  const match = xml.match(
    /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\/cbc:EmbeddedDocumentBinaryObject>/
  );
  return match?.[1]?.trim() || "";
}

/** Resolve QR TLV from a zatca_invoices row. */
export function resolveZatcaQrTlv(record) {
  if (!record) return "";
  const stored = String(record.qr_tlv || "").trim();
  if (stored) return stored;
  return extractQrTlvFromSignedXml(record.signed_xml);
}
