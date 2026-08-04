import { Loader2, Send } from "lucide-react";
import Button from "../common/Button";
import Badge from "../common/Badge";
import ProductBilingualName from "../products/ProductBilingualName";
import {
  ZATCA_QUEUE_STATUS,
  ZATCA_QUEUE_STATUS_LABELS,
} from "../../zatca/core/constants";
import { formatRetryWait } from "../../zatca/sync/retryBackoff";
import { formatCurrency, formatDateTime } from "../../utils/format";
import ZatcaOrderStatusBadge from "./ZatcaOrderStatusBadge";
import ZatcaInvoiceXmlActions from "./ZatcaInvoiceXmlActions";
import ZatcaXmlDownloadLink from "./ZatcaXmlDownloadLink";
import ZatcaSyncVerifiedBanner from "./ZatcaSyncVerifiedBanner";
import ZatcaSyncedQrDisplay from "./ZatcaSyncedQrDisplay";

function isOlderThanDate(saleDate, businessDate) {
  if (!saleDate || !businessDate) return false;
  const day = String(saleDate).slice(0, 10);
  return day < businessDate;
}

export default function ZatcaSyncInvoiceCard({
  row,
  lineItems = [],
  currency,
  businessDate,
  isSyncing = false,
  busy = false,
  onSync,
}) {
  const displayStatus = isSyncing ? ZATCA_QUEUE_STATUS.SENDING : row.status;
  const isPreviousDay = isOlderThanDate(row.sale_date, businessDate);

  return (
    <li className={`zatca-daily-card status-${displayStatus}`}>
      <div className="zatca-daily-card-head">
        <div className="zatca-daily-card-title">
          <strong>{row.sale_number}</strong>
          <span>{formatDateTime(row.sale_date)}</span>
        </div>
        {isPreviousDay && (
          <Badge variant="neutral">Previous day</Badge>
        )}
        <ZatcaOrderStatusBadge status={displayStatus} />
        <strong className="zatca-daily-total">{formatCurrency(row.sale_total, currency)}</strong>
      </div>

      <div className="zatca-daily-card-meta">
        <span>{row.customer_name || "Walk-in"}</span>
        <span style={{ textTransform: "capitalize" }}>{row.payment_method || "cash"}</span>
        <span>{row.item_count ?? lineItems.length} item(s)</span>
        {row.synced_at && <span>Synced {formatDateTime(row.synced_at)}</span>}
      </div>

      {lineItems.length > 0 && (
        <ul className="zatca-daily-products">
          {lineItems.map((item, index) => (
            <li key={`${row.sale_id}-${index}`}>
              <ProductBilingualName name={item.product_name} nameAr={item.name_ar} size="sm" />
              <span>
                × {item.quantity} · {formatCurrency(item.total, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {row.error_message && displayStatus === ZATCA_QUEUE_STATUS.FAILED && (
        <p className="zatca-daily-error">{row.error_message}</p>
      )}

      {displayStatus === ZATCA_QUEUE_STATUS.SYNCED && (
        <>
          <ZatcaSyncedQrDisplay record={row} compact />
          <ZatcaSyncVerifiedBanner record={row} />
          <div className="zatca-daily-xml-row">
            <ZatcaXmlDownloadLink
              saleId={row.sale_id}
              saleNumber={row.sale_number}
              record={row}
              layout="stack"
            />
          </div>
          <ZatcaInvoiceXmlActions record={row} compact />
        </>
      )}

      {row.next_retry_at && displayStatus === ZATCA_QUEUE_STATUS.FAILED && (
        <p className="zatca-daily-retry">
          Next automatic retry {formatRetryWait(row.next_retry_at)}
        </p>
      )}

      {displayStatus !== ZATCA_QUEUE_STATUS.SYNCED && (
        <div className="zatca-daily-card-actions">
          <Button size="sm" variant="secondary" disabled={busy || isSyncing} onClick={() => onSync(row.id)}>
            {isSyncing ? (
              <>
                <Loader2 size={14} className="spin" /> Sending…
              </>
            ) : (
              <>
                <Send size={14} /> Sync now
              </>
            )}
          </Button>
        </div>
      )}
    </li>
  );
}

export function filterSyncItems(items, filter) {
  if (filter === "all") return items;
  if (filter === "action") {
    return items.filter((item) => item.status !== ZATCA_QUEUE_STATUS.SYNCED);
  }
  return items.filter((item) => item.status === filter);
}

export { ZATCA_QUEUE_STATUS_LABELS };
