import { useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { zatcaService } from "../../services/ZatcaService";
import { ZATCA_QUEUE_STATUS } from "../../zatca/core/constants";
import { resolveXmlValidatorUrl } from "../../zatca/core/environments";
import { canDownloadZatcaXml, downloadZatcaSignedXml } from "../../utils/zatcaXmlDownload";
import "./ZatcaXmlDownloadLink.css";

export default function ZatcaXmlDownloadLink({
  saleId,
  saleNumber,
  record = null,
  environment,
  layout = "inline",
  onError,
}) {
  const [busy, setBusy] = useState(false);

  const status = record?.status;
  const env = environment || record?.environment;
  const validatorUrl = resolveXmlValidatorUrl(env);
  const downloadable = canDownloadZatcaXml(record);

  async function handleDownload(event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();

    if (!saleId || busy) return;

    setBusy(true);
    try {
      let xml = record?.signed_xml?.trim();
      let number = saleNumber || record?.sale_number;

      if (!xml) {
        const fetched = await zatcaService.getSignedXmlForSale(saleId);
        xml = fetched?.signed_xml?.trim();
        number = number || fetched?.sale_number;
        if (fetched?.status !== ZATCA_QUEUE_STATUS.SYNCED) {
          throw new Error("Sync this order from Sales → ZATCA Sync first.");
        }
      }

      downloadZatcaSignedXml(number, xml);
    } catch (err) {
      onError?.(err.message || "Could not download XML.");
    } finally {
      setBusy(false);
    }
  }

  if (!record) {
    return <span className="zatca-xml-link-muted">—</span>;
  }

  if (status && status !== ZATCA_QUEUE_STATUS.SYNCED) {
    return (
      <span className="zatca-xml-link-muted" title="Sync from Sales → ZATCA Sync first">
        Sync first
      </span>
    );
  }

  if (status === ZATCA_QUEUE_STATUS.SYNCED && !downloadable && !saleId) {
    return <span className="zatca-xml-link-muted">No XML</span>;
  }

  function handleValidatorClick(event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    const ok = window.confirm(
      "ZATCA web validator often shows X509IssuerName / X509SerialNumber errors for simplified POS invoices — that is expected and does NOT mean sync failed.\n\n" +
        "If this order shows Synced in the app, trust the ZATCA API response instead.\n\n" +
        "Open the web validator anyway?"
    );
    if (ok) {
      window.open(validatorUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className={`zatca-xml-download-link layout-${layout}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="zatca-xml-download-btn"
        disabled={busy}
        onClick={handleDownload}
        title="Download signed XML"
      >
        {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
        Download XML
      </button>
      <button
        type="button"
        className="zatca-xml-validator-link"
        title="Optional — X509 errors are normal for POS invoices"
        onClick={handleValidatorClick}
      >
        <ExternalLink size={13} />
        Web validator
      </button>
    </div>
  );
}
