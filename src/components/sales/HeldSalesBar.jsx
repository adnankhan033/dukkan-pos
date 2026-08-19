import { Pause, Play, Trash2, User, Package } from "lucide-react";
import { formatCurrency, formatOrderDateTime } from "../../utils/format";
import "./HeldSalesBar.css";

export default function HeldSalesBar({
  holds = [],
  currency,
  busy = false,
  onResume,
  onDiscard,
}) {
  if (!holds.length) return null;

  const parkedTotal = holds.reduce((sum, hold) => sum + (Number(hold.total) || 0), 0);

  return (
    <section className="pos-holds" aria-label="Held tickets">
      <header className="pos-holds-head">
        <div className="pos-holds-title">
          <span className="pos-holds-badge" aria-hidden="true">
            <Pause size={15} />
          </span>
          <div>
            <h2>Held tickets</h2>
            <p>Tap Resume to bring a ticket back. An open cart is held first.</p>
          </div>
          <span className="pos-holds-count">{holds.length}</span>
        </div>
        <div className="pos-holds-sum">
          <span>Parked</span>
          <strong>{formatCurrency(parkedTotal, currency)}</strong>
        </div>
      </header>

      <div className="pos-holds-track">
        {holds.map((hold) => {
          const qty = Number(hold.item_qty || hold.item_count || 0);
          const lines = Number(hold.item_count || 0);
          return (
            <article key={hold.id} className="pos-hold-card">
              <div className="pos-hold-card-top">
                <div>
                  <p className="pos-hold-number">{hold.sale_number}</p>
                  <p className="pos-hold-time">{formatOrderDateTime(hold.updated_at || hold.created_at)}</p>
                </div>
                <button
                  type="button"
                  className="pos-hold-discard"
                  disabled={busy}
                  aria-label={`Discard ${hold.sale_number}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscard(hold);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="pos-hold-meta">
                <span>
                  <User size={13} />
                  {hold.customer_name || "Walk-in"}
                </span>
                <span>
                  <Package size={13} />
                  {qty} {qty === 1 ? "item" : "items"}
                  {lines > 0 && lines !== qty ? ` · ${lines} lines` : ""}
                </span>
              </div>

              <p className="pos-hold-total">{formatCurrency(hold.total, currency)}</p>

              <button
                type="button"
                className="pos-hold-resume"
                disabled={busy}
                onClick={() => onResume(hold)}
              >
                <Play size={14} />
                Resume
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
