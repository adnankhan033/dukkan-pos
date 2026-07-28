import { Languages, Sparkles } from "lucide-react";
import Button from "../common/Button";
import "./ProductNameFields.css";

export default function ProductNameFields({
  name,
  nameAr,
  onNameChange,
  onNameArChange,
  onTranslate,
  translating = false,
  nameError,
  translateError,
}) {
  const canTranslate = Boolean(name?.trim()) && !translating;

  return (
    <div className="product-name-fields">
      <div className="product-name-fields-header">
        <div>
          <h4>Product Name</h4>
          <p>English is required. Arabic is optional for bilingual receipts and labels.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canTranslate}
          onClick={onTranslate}
          className="product-name-translate-btn"
        >
          {translating ? (
            <>Translating...</>
          ) : (
            <>
              <Languages size={15} />
              <Sparkles size={14} />
              Auto-translate
            </>
          )}
        </Button>
      </div>

      <div className="product-name-grid">
        <div className="product-name-field">
          <label className="product-name-label">
            <span className="lang-badge lang-en">EN</span>
            English Name *
          </label>
          <input
            className={`form-input product-name-input ${nameError ? "error" : ""}`}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Fresh Milk 1L"
            autoComplete="off"
          />
          {nameError && <span className="form-error">{nameError}</span>}
        </div>

        <div className="product-name-bridge" aria-hidden="true">
          <span>→</span>
        </div>

        <div className="product-name-field">
          <label className="product-name-label">
            <span className="lang-badge lang-ar">AR</span>
            Arabic Name
          </label>
          <input
            className="form-input product-name-input product-name-input-ar"
            value={nameAr}
            onChange={(e) => onNameArChange(e.target.value)}
            placeholder="مثال: حليب طازج ١ لتر"
            dir="rtl"
            lang="ar"
            autoComplete="off"
          />
        </div>
      </div>

      {translateError && <div className="form-error product-name-translate-error">{translateError}</div>}

      {(name?.trim() || nameAr?.trim()) && (
        <div className="product-name-preview">
          <span className="product-name-preview-label">Preview</span>
          <div className="product-name-preview-body">
            <div className="preview-line preview-en">{name?.trim() || "—"}</div>
            <div className="preview-line preview-ar" dir="rtl">
              {nameAr?.trim() || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
