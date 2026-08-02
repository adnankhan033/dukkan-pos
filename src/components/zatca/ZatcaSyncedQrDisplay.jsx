import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { ZATCA_QUEUE_STATUS } from "../../zatca/core/constants";
import { resolveZatcaQrTlv, zatcaTlvBase64ToDataUrl } from "../../utils/zatcaQr";
import "./ZatcaSyncedQrDisplay.css";

export default function ZatcaSyncedQrDisplay({ record, compact = false }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  const isSynced = record?.status === ZATCA_QUEUE_STATUS.SYNCED;
  const tlv = resolveZatcaQrTlv(record);

  useEffect(() => {
    if (!isSynced || !tlv) {
      setDataUrl("");
      setError("");
      return undefined;
    }

    let cancelled = false;
    setError("");

    zatcaTlvBase64ToDataUrl(tlv, compact ? 160 : 220)
      .then((url) => {
        if (!cancelled) setDataUrl(url || "");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not render QR code.");
      });

    return () => {
      cancelled = true;
    };
  }, [isSynced, tlv, compact]);

  if (!isSynced) return null;

  if (!tlv) {
    return (
      <p className="zatca-synced-qr-missing">
        Signed QR not stored for this order — re-sync or download XML to verify.
      </p>
    );
  }

  return (
    <div className={`zatca-synced-qr${compact ? " compact" : ""}`}>
      <div className="zatca-synced-qr-visual">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="ZATCA Phase 2 invoice QR code"
            width={compact ? 160 : 220}
            height={compact ? 160 : 220}
          />
        ) : error ? (
          <div className="zatca-synced-qr-error">{error}</div>
        ) : (
          <div className="zatca-synced-qr-loading">Loading QR…</div>
        )}
      </div>
      <div className="zatca-synced-qr-caption">
        <QrCode size={16} />
        <div>
          <strong>ZATCA Phase 2 QR</strong>
          <span>
            Full signed invoice QR (tags 1–9) — scan to verify seller, VAT, total, hash &amp;
            signature.
          </span>
        </div>
      </div>
    </div>
  );
}
