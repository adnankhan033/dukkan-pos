import { ZATCA_QUEUE_STATUS } from "../zatca/core/constants";
import { downloadTextFile } from "./downloadText";

export function zatcaXmlFilename(saleNumber) {
  const base = String(saleNumber || "invoice").replace(/[^\w.-]+/g, "_");
  return `${base}-zatca-signed.xml`;
}

export function downloadZatcaSignedXml(saleNumber, signedXml) {
  const xml = signedXml?.trim();
  if (!xml) {
    throw new Error("Signed XML is not available for this order.");
  }
  downloadTextFile(zatcaXmlFilename(saleNumber), xml, "application/xml;charset=utf-8");
}

export function canDownloadZatcaXml(record) {
  if (!record) return false;
  if (record.status !== ZATCA_QUEUE_STATUS.SYNCED) return false;
  if (record.has_signed_xml === 1 || record.has_signed_xml === true) return true;
  return Boolean(record.signed_xml?.trim());
}
