import { useState } from "react";
import { Printer } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import ReceiptPreviewFrame from "../receipt/ReceiptPreviewFrame";
import { LoadingSpinner } from "../common/Loading";
import { printReceipt } from "../../utils/receipt";
import { formatCurrency, formatOrderDateTime } from "../../utils/format";
import { notify } from "../../utils/notify";
import "./LastOrderReprintModal.css";

export default function LastOrderReprintModal({
  isOpen,
  loading = false,
  sale,
  settings,
  currency,
  onClose,
}) {
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (!sale || printing) return;
    setPrinting(true);
    try {
      await printReceipt({
        sale,
        items: sale.items || [],
        settings,
        currency,
      });
      notify.success(`Last order ${sale.sale_number} sent to printer.`, {
        title: "Receipt printed",
      });
    } catch (err) {
      notify.error(err.message || "Print failed", { title: "Print failed" });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!printing) onClose?.();
      }}
      closeOnOverlay={!printing}
      title="Last order"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={printing}>
            Close
          </Button>
          <Button onClick={handlePrint} disabled={loading || printing || !sale}>
            <Printer size={16} /> {printing ? "Printing…" : "Print receipt"}
          </Button>
        </>
      }
    >
      <div className="last-order-reprint">
        {loading ? (
          <LoadingSpinner message="Loading last order…" />
        ) : !sale ? (
          <p className="last-order-reprint-empty">No completed order to reprint.</p>
        ) : (
          <>
            <div className="last-order-reprint-meta">
              <div>
                <span>Invoice</span>
                <strong>{sale.sale_number}</strong>
              </div>
              <div>
                <span>When</span>
                <strong>{formatOrderDateTime(sale.created_at || sale.updated_at)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatCurrency(sale.total, currency)}</strong>
              </div>
            </div>
            <ReceiptPreviewFrame
              sale={sale}
              items={sale.items}
              settings={settings}
              currency={currency}
              label="Check the receipt, then print"
              compact
            />
          </>
        )}
      </div>
    </Modal>
  );
}
