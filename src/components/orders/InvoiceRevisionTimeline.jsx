import { History } from "lucide-react";
import { formatCurrency, formatOrderDateTime } from "../../utils/format";
import { revisionLabel } from "../../utils/invoiceRevisions";
import "./InvoiceRevisionTimeline.css";

export default function InvoiceRevisionTimeline({
  revisions = [],
  currentRevision = 1,
  selectedRevision = 1,
  currency,
  onSelect,
}) {
  if (!revisions.length) return null;

  return (
    <section className="invoice-revisions">
      <div className="invoice-revisions-head">
        <span className="invoice-revisions-icon" aria-hidden="true">
          <History size={16} />
        </span>
        <div>
          <h4>Invoice revisions</h4>
          <p>
            {revisions.length} version{revisions.length === 1 ? "" : "s"} · tap any card to preview
            that invoice
          </p>
        </div>
      </div>

      <div className="invoice-revisions-track" role="list">
        {revisions.map((revision, index) => {
          const n = Number(revision.revision) || 1;
          const selected = n === Number(selectedRevision);
          const current = n === Number(currentRevision);
          return (
            <button
              key={revision.id || n}
              type="button"
              role="listitem"
              className={`invoice-revision-card ${selected ? "is-selected" : ""} ${
                current ? "is-current" : ""
              }`}
              onClick={() => onSelect?.(n)}
            >
              {index > 0 ? <span className="invoice-revision-connector" aria-hidden="true" /> : null}
              <span className="invoice-revision-num">{n}</span>
              <span className="invoice-revision-copy">
                <strong>{revisionLabel(n)}</strong>
                <em>{formatOrderDateTime(revision.created_at)}</em>
                <span>
                  {formatCurrency(revision.total ?? 0, currency)} · {(revision.items || []).length}{" "}
                  {(revision.items || []).length === 1 ? "item" : "items"}
                </span>
                <small>by {revision.created_by_name || "Staff"}</small>
              </span>
              {current ? <span className="invoice-revision-now">Latest</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
