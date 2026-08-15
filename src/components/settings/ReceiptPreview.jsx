import { useEffect, useMemo, useState } from "react";
import { Printer, Star } from "lucide-react";
import Button from "../common/Button";
import { Card } from "../common/Card";
import { LoadingSpinner } from "../common/Loading";
import { buildReceiptHtml, printHtml } from "../../utils/receipt";
import {
  RECEIPT_TEMPLATES,
  SAMPLE_RECEIPT_ITEMS,
  SAMPLE_RECEIPT_SALE,
  getReceiptTemplate,
} from "../../utils/receiptTemplates";

function formToPreviewSettings(form) {
  return {
    store_name: form.store_name,
    store_name_ar: form.store_name_ar,
    store_address: form.store_address,
    store_phone: form.store_phone,
    cr_number: form.cr_number,
    vat_registration: form.vat_registration,
    vat_percent: form.vat_percent,
    currency: form.currency,
    receipt_footer: form.receipt_footer,
    receipt_footer_ar: form.receipt_footer_ar,
    receipt_branding: form.receipt_branding,
    receipt_show_qr: form.receipt_show_qr ? "1" : "0",
    receipt_show_bilingual: form.receipt_show_bilingual ? "1" : "0",
    receipt_show_tax_info: form.receipt_show_tax_info ? "1" : "0",
    receipt_paper_width: form.receipt_paper_width,
    receipt_header_note: form.receipt_header_note,
    receipt_template: form.receipt_template,
  };
}

export default function ReceiptPreview({ form, onSelectTemplate }) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const previewSettings = useMemo(() => formToPreviewSettings(form), [form]);
  const selectedTemplate = getReceiptTemplate(form.receipt_template);
  const paperWidth = Number(form.receipt_paper_width) || 80;

  useEffect(() => {
    let active = true;
    setLoading(true);

    buildReceiptHtml({
      sale: SAMPLE_RECEIPT_SALE,
      items: SAMPLE_RECEIPT_ITEMS,
      settings: previewSettings,
      currency: form.currency || "SAR",
    })
      .then((html) => {
        if (active) setPreviewHtml(html);
      })
      .catch(() => {
        if (active) setPreviewHtml("");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [previewSettings, form.currency]);

  async function handleTestPrint() {
    if (!previewHtml) return;
    setPrinting(true);
    try {
      await printHtml(previewHtml);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Card className="receipt-preview-card">
      <div className="receipt-preview-header">
        <div>
          <h3 className="settings-section-title">Live Preview</h3>
          <p className="settings-section-desc">
            Sample baqala sale — updates as you change settings.
          </p>
        </div>
        <Button variant="secondary" onClick={handleTestPrint} disabled={loading || printing || !previewHtml}>
          <Printer size={16} />
          {printing ? "Printing..." : "Test Print"}
        </Button>
      </div>

      <div className="receipt-template-picker">
        {RECEIPT_TEMPLATES.map((tpl) => {
          const selected = form.receipt_template === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              className={`receipt-template-option ${selected ? "selected" : ""}`}
              onClick={() => onSelectTemplate(tpl.id)}
            >
              <span className="receipt-template-option-head">
                <strong>{tpl.label}</strong>
                {tpl.recommended && (
                  <span className="receipt-template-badge">
                    <Star size={12} /> Default
                  </span>
                )}
              </span>
              {tpl.labelAr && (
                <span className="receipt-template-ar" dir="rtl">
                  {tpl.labelAr}
                </span>
              )}
              <small>{tpl.description}</small>
            </button>
          );
        })}
      </div>

      <p className="receipt-preview-meta">
        Selected: <strong>{selectedTemplate.label}</strong> · {paperWidth}mm paper
      </p>

      <div
        className="receipt-preview-frame-wrap"
        style={{ maxWidth: `${Math.min(paperWidth + 40, 360)}px` }}
      >
        {loading ? (
          <LoadingSpinner message="Building preview..." />
        ) : (
          <iframe
            title="Receipt preview"
            className="receipt-preview-frame"
            srcDoc={previewHtml}
            sandbox="allow-same-origin"
          />
        )}
      </div>
    </Card>
  );
}
