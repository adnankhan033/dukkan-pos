import { useState } from "react";
import { ClipboardCopy, ExternalLink, FileCode2 } from "lucide-react";
import Button from "../common/Button";
import ZatcaXmlDownloadLink from "./ZatcaXmlDownloadLink";
import ZatcaSyncVerifiedBanner from "./ZatcaSyncVerifiedBanner";
import { ZATCA_QUEUE_STATUS } from "../../zatca/core/constants";
import { summarizeZatcaSyncResponse, isZatcaApiAccepted } from "../../utils/zatcaSyncResponse";
import "./ZatcaInvoiceXmlActions.css";

export default function ZatcaInvoiceXmlActions({ record, compact = false }) {
  const [showXml, setShowXml] = useState(false);
  const [note, setNote] = useState("");

  if (!record) return null;

  const isSynced = record.status === ZATCA_QUEUE_STATUS.SYNCED;
  const signedXml = record.signed_xml?.trim();
  const apiSummary = summarizeZatcaSyncResponse(record);
  const apiAccepted = isZatcaApiAccepted(record);

  async function copyXml() {
    if (!signedXml) return;
    await navigator.clipboard.writeText(signedXml);
    setNote("Signed XML copied — upload this file to the ZATCA validator.");
    setTimeout(() => setNote(""), 4000);
  }

  return (
    <div className={`zatca-xml-actions${compact ? " compact" : ""}`}>
      {record.invoice_uuid && (
        <p className="zatca-xml-meta">
          <span>UUID</span>
          <code>{record.invoice_uuid}</code>
        </p>
      )}
      {record.invoice_hash && (
        <p className="zatca-xml-meta">
          <span>Invoice hash</span>
          <code title={record.invoice_hash}>{record.invoice_hash.slice(0, 24)}…</code>
        </p>
      )}

      {isSynced && apiSummary && (
        <p className={`zatca-xml-api-result${apiAccepted ? " ok" : ""}`}>
          ZATCA API: {apiSummary}
        </p>
      )}

      {isSynced && <ZatcaSyncVerifiedBanner record={record} />}

      {!isSynced && (
        <p className="zatca-xml-hint">
          Sync this order from <strong>Sales → ZATCA Sync</strong> first. The signed XML is saved only after a successful sync.
        </p>
      )}

      {isSynced && !signedXml && !record.has_signed_xml && (
        <p className="zatca-xml-hint">
          Marked synced but signed XML is missing — try syncing again or check Settings → ZATCA credentials.
        </p>
      )}

      {isSynced && (signedXml || record.has_signed_xml) && (
        <>
          <div className="zatca-xml-buttons">
            <ZatcaXmlDownloadLink
              saleId={record.sale_id}
              saleNumber={record.sale_number}
              record={record}
              layout="inline"
              onError={(msg) => setNote(msg)}
            />
            {signedXml && (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={copyXml}>
                  <ClipboardCopy size={14} /> Copy
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowXml((open) => !open)}>
                  <FileCode2 size={14} /> {showXml ? "Hide" : "View"}
                </Button>
              </>
            )}
          </div>
          <p className="zatca-xml-hint">
            <ExternalLink size={12} style={{ verticalAlign: "middle" }} /> Download XML for your records. Optional: upload on{" "}
            <strong>Check online</strong> (ZATCA Web Validator).
          </p>
          <p className="zatca-xml-validator-note">
            Simplified POS invoices often show <strong>X509IssuerName</strong> /{" "}
            <strong>X509SerialNumber</strong> errors on the web validator — that is expected. The
            validator uses a different certificate than yours. Trust the app <strong>Synced</strong>{" "}
            status and ZATCA API response above; use Test Center → API Logs for full JSON.
          </p>
          {note && <p className="zatca-xml-note">{note}</p>}
          {showXml && signedXml && <pre className="zatca-xml-preview">{signedXml}</pre>}
        </>
      )}
    </div>
  );
}
