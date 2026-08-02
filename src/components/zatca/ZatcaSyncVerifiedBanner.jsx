import { CheckCircle2, Info } from "lucide-react";
import { ZATCA_QUEUE_STATUS } from "../../zatca/core/constants";
import { isZatcaApiAccepted, summarizeZatcaSyncResponse } from "../../utils/zatcaSyncResponse";
import "./ZatcaSyncVerifiedBanner.css";

/**
 * Shown on synced POS invoices — explains that ZATCA web validator X509 errors are expected.
 */
export default function ZatcaSyncVerifiedBanner({ record }) {
  if (!record || record.status !== ZATCA_QUEUE_STATUS.SYNCED) {
    return null;
  }

  const apiSummary = summarizeZatcaSyncResponse(record);
  const accepted = isZatcaApiAccepted(record);

  return (
    <div className={`zatca-sync-verified-banner${accepted ? " accepted" : ""}`}>
      <div className="zatca-sync-verified-head">
        <CheckCircle2 size={18} />
        <strong>
          {accepted
            ? "Accepted by ZATCA API — your integration is working"
            : "Synced locally — check ZATCA Test Center → API Logs for API details"}
        </strong>
      </div>
      {apiSummary && <p className="zatca-sync-verified-api">API response: {apiSummary}</p>}
      <p className="zatca-sync-verified-note">
        <Info size={14} />
        The ZATCA web validator at sandbox.zatca.gov.sa often shows{" "}
        <code>X509IssuerName</code> / <code>X509SerialNumber</code> errors for{" "}
        <strong>simplified POS invoices</strong>. That is normal — the site uses a different
        certificate than yours. Do not use it as pass/fail for POS sales.
      </p>
    </div>
  );
}
