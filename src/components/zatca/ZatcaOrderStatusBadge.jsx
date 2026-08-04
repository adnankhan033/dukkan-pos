import Badge from "../common/Badge";
import { ZATCA_QUEUE_STATUS, ZATCA_QUEUE_STATUS_LABELS } from "../../zatca/core/constants";

export function zatcaStatusVariant(status) {
  switch (status) {
    case ZATCA_QUEUE_STATUS.SYNCED:
      return "success";
    case ZATCA_QUEUE_STATUS.FAILED:
      return "danger";
    case ZATCA_QUEUE_STATUS.SENDING:
      return "info";
    case ZATCA_QUEUE_STATUS.PENDING:
      return "warning";
    default:
      return "neutral";
  }
}

export default function ZatcaOrderStatusBadge({ status, compact = false }) {
  if (!status) {
    return compact ? null : <span className="zatca-order-status-muted">—</span>;
  }

  const label = ZATCA_QUEUE_STATUS_LABELS[status] || status;
  return <Badge variant={zatcaStatusVariant(status)}>{label}</Badge>;
}
