import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  ScanLine,
  Sparkles,
} from "lucide-react";
import Button from "../common/Button";
import { barcodeLookupService, isValidBarcodeLength, normalizeBarcode } from "../../services/BarcodeLookupService";
import "./ProductBarcodeScanner.css";

const SCAN_DEBOUNCE_MS = 350;

export default function ProductBarcodeScanner({
  active = true,
  categories = [],
  units = [],
  onApply,
  onDuplicate,
  onTranslate,
  translating = false,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const lastLookupRef = useRef("");
  const loadingRef = useRef(false);
  const [value, setValue] = useState("");
  const [lookupState, setLookupState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (active && !disabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [active, disabled]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runLookup = useCallback(
    async (rawValue) => {
      const barcode = normalizeBarcode(rawValue);
      if (!barcode || !isValidBarcodeLength(barcode)) return;
      if (lastLookupRef.current === barcode && loadingRef.current) return;

      lastLookupRef.current = barcode;
      loadingRef.current = true;
      setLookupState("loading");
      setError("");
      setResult(null);

      try {
        const lookup = await barcodeLookupService.lookup(barcode, { categories, units });
        setResult(lookup);

        if (lookup.status === "duplicate") {
          setLookupState("duplicate");
          return;
        }

        if (lookup.status === "found") {
          setLookupState("found");
          onApply?.(lookup.formPatch, lookup);
          if (lookup.formPatch?.name && onTranslate && !lookup.formPatch?.name_ar) {
            onTranslate(lookup.formPatch.name);
          }
          return;
        }

        if (lookup.status === "not_found") {
          setLookupState("not_found");
          onApply?.(lookup.formPatch, lookup);
          return;
        }

        setLookupState("error");
        setError(lookup.message);
      } catch (err) {
        setLookupState("error");
        setError(err.message || "Barcode lookup failed.");
      } finally {
        loadingRef.current = false;
      }
    },
    [categories, units, onApply, onTranslate]
  );

  function scheduleLookup(nextValue) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const barcode = normalizeBarcode(nextValue);
    if (!isValidBarcodeLength(barcode)) return;

    debounceRef.current = setTimeout(() => {
      runLookup(nextValue);
    }, SCAN_DEBOUNCE_MS);
  }

  function handleChange(e) {
    const nextValue = e.target.value;
    setValue(nextValue);
    setError("");
    if (lookupState !== "idle" && lookupState !== "loading") {
      setLookupState("idle");
      setResult(null);
      lastLookupRef.current = "";
    }
    scheduleLookup(nextValue);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runLookup(value);
  }

  function handleClear() {
    setValue("");
    setResult(null);
    setError("");
    setLookupState("idle");
    lastLookupRef.current = "";
    inputRef.current?.focus();
  }

  const normalized = normalizeBarcode(value);
  const showPreview = result && lookupState !== "loading";

  return (
    <div className={`product-barcode-scanner state-${lookupState}`}>
      <div className="product-barcode-scanner-head">
        <div className="product-barcode-scanner-icon">
          <ScanLine size={22} />
        </div>
        <div>
          <h4>Scan or enter barcode</h4>
          <p>
            Use your barcode scanner or type the number — product details fill in automatically when found.
          </p>
        </div>
      </div>

      <div className="product-barcode-input-wrap">
        <Barcode size={18} className="product-barcode-input-icon" />
        <input
          ref={inputRef}
          className="product-barcode-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Scan barcode here..."
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled || lookupState === "loading"}
        />
        {lookupState === "loading" && (
          <Loader2 size={18} className="product-barcode-input-spinner spin" />
        )}
        {value && lookupState !== "loading" && (
          <button type="button" className="product-barcode-clear" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      {normalized && (
        <div className="product-barcode-digits">
          <span>Barcode:</span>
          <code>{normalized}</code>
        </div>
      )}

      {error && (
        <div className="product-barcode-alert error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {lookupState === "duplicate" && result?.localProduct && (
        <div className="product-barcode-result duplicate">
          <div className="product-barcode-result-icon">
            <Package size={20} />
          </div>
          <div className="product-barcode-result-body">
            <strong>Already in your catalog</strong>
            <p>{result.message}</p>
            <div className="product-barcode-result-meta">
              <span>{result.localProduct.name}</span>
              {result.localProduct.category_name && <span>{result.localProduct.category_name}</span>}
              {result.localProduct.selling_price != null && (
                <span>SAR {Number(result.localProduct.selling_price).toFixed(2)}</span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onDuplicate?.(result.localProduct)}
          >
            <Pencil size={14} /> Edit product
          </Button>
        </div>
      )}

      {lookupState === "found" && showPreview && (
        <div className="product-barcode-result found">
          <div className="product-barcode-result-icon success">
            <CheckCircle2 size={20} />
          </div>
          <div className="product-barcode-preview">
            {(result.preview?.imageUrl || result.formPatch?.image) && (
              <img
                src={result.formPatch?.image || result.preview.imageUrl}
                alt=""
                className="product-barcode-preview-image"
              />
            )}
            <div className="product-barcode-preview-text">
              <div className="product-barcode-preview-badges">
                <span className="product-barcode-badge success">Matched</span>
                <span className="product-barcode-badge source">{result.source}</span>
              </div>
              <strong>{result.preview?.name}</strong>
              {result.preview?.brand && <span className="product-barcode-brand">{result.preview.brand}</span>}
              <div className="product-barcode-preview-hints">
                {result.preview?.categoryHint && <span>Category hint: {result.preview.categoryHint}</span>}
                {result.preview?.quantityHint && <span>Pack size: {result.preview.quantityHint}</span>}
              </div>
              <p className="product-barcode-applied-note">
                <Sparkles size={14} /> Details applied below — review price and stock, then save.
              </p>
              {!result.formPatch?.name_ar && onTranslate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={translating}
                  onClick={() => onTranslate(result.formPatch?.name)}
                >
                  {translating ? "Translating..." : "Auto-translate Arabic name"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {lookupState === "not_found" && showPreview && (
        <div className="product-barcode-result not-found">
          <div className="product-barcode-result-icon">
            <AlertCircle size={20} />
          </div>
          <div className="product-barcode-result-body">
            <strong>Barcode saved — fill in details</strong>
            <p>{result.message}</p>
            <p className="product-barcode-tip">
              Enter the product name, price, and category below, then save.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
