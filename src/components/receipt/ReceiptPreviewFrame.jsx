import { useEffect, useState } from "react";
import { buildReceiptHtml } from "../../utils/receipt";
import { resolvePrintSettings } from "../../utils/invoiceSettings";
import { LoadingSpinner } from "../common/Loading";
import "./ReceiptPreviewFrame.css";

export default function ReceiptPreviewFrame({
  sale,
  items,
  settings,
  currency,
  label = "Receipt preview",
  compact = false,
}) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sale) {
      setHtml("");
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    buildReceiptHtml({
      sale,
      items: items || sale.items || [],
      settings: settings || {},
      currency: currency || settings?.currency || "SAR",
    })
      .then((result) => {
        if (active) setHtml(result);
      })
      .catch(() => {
        if (active) setHtml("");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sale, items, settings, currency]);

  if (!sale) return null;

  const printSettings = resolvePrintSettings(sale, settings || {});
  const paperWidth = Number(printSettings.receipt_paper_width) || 80;

  return (
    <div className={`receipt-preview-block ${compact ? "receipt-preview-block--compact" : ""}`}>
      {label ? <p className="receipt-preview-block-label">{label}</p> : null}
      <div
        className="receipt-preview-frame-wrap"
        style={{ maxWidth: `${Math.min(paperWidth + 48, 380)}px` }}
      >
        {loading ? (
          <LoadingSpinner message="Building receipt..." />
        ) : (
          <iframe
            title="Receipt preview"
            className="receipt-preview-frame"
            srcDoc={html}
            sandbox="allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}
