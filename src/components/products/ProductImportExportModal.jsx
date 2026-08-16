import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Alert } from "../common/Loading";
import { productImportService } from "../../services/ProductImportService";
import {
  ACCEPTED_MIME,
  isAcceptedImportFile,
  readImportFile,
  sheetToProducts,
  previewRows,
} from "../../utils/productImport/parseFile";
import {
  IMPORT_MODES,
  IMPORT_MODE_LABELS,
  validateImportRows,
  buildErrorReportCsv,
} from "../../utils/productImport/validate";
import { downloadText, downloadArrayBuffer, formatFileSize, fileTypeLabel } from "../../utils/productImport/download";
import { PRODUCT_IMPORT_COLUMNS } from "../../utils/productImport/columns";
import { useConfirm } from "../../hooks/useConfirm";
import "./ProductImportExportModal.css";

function formatEta(seconds) {
  if (seconds == null || seconds <= 0) return "Calculating…";
  if (seconds < 60) return `~${seconds}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `~${mins}m ${secs}s remaining`;
}

function DownloadFeedbackBanner({ feedback, onDismiss }) {
  if (!feedback) return null;

  const isSuccess = feedback.type === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div className={`pie-download-feedback ${isSuccess ? "success" : "error"}`} role="status" aria-live="polite">
      <div className="pie-download-feedback-icon">
        <Icon size={22} />
      </div>
      <div className="pie-download-feedback-body">
        <strong>{feedback.title}</strong>
        {isSuccess ? (
          <>
            <p>
              <span className="pie-download-feedback-label">{feedback.label}</span> saved as{" "}
              <code>{feedback.filename}</code>
            </p>
            <div className="pie-download-feedback-meta">
              <span>{fileTypeLabel(feedback.filename)}</span>
              <span>{formatFileSize(feedback.size)}</span>
              {feedback.detail && <span>{feedback.detail}</span>}
            </div>
            <p className="pie-download-feedback-hint">
              Check your browser <strong>Downloads</strong> folder. If nothing appears, allow downloads for this app.
            </p>
          </>
        ) : (
          <p>{feedback.message || "Something went wrong. Please try again."}</p>
        )}
      </div>
      <button type="button" className="pie-download-feedback-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export default function ProductImportExportModal({ isOpen, onClose, onComplete }) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const fileInputRef = useRef(null);
  const cancelRef = useRef(false);

  const [tab, setTab] = useState("import");
  const [file, setFile] = useState(null);
  const [parseError, setParseError] = useState("");
  const [headers, setHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [validation, setValidation] = useState(null);
  const [mode, setMode] = useState(IMPORT_MODES.NEW_ONLY);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [downloadFeedback, setDownloadFeedback] = useState(null);
  const [message, setMessage] = useState("");
  const downloadFeedbackTimerRef = useRef(null);

  const clearDownloadFeedbackTimer = useCallback(() => {
    if (downloadFeedbackTimerRef.current) {
      clearTimeout(downloadFeedbackTimerRef.current);
      downloadFeedbackTimerRef.current = null;
    }
  }, []);

  const showDownloadFeedback = useCallback(
    (feedback) => {
      clearDownloadFeedbackTimer();
      setDownloadFeedback(feedback);
      if (feedback?.type === "success") {
        downloadFeedbackTimerRef.current = setTimeout(() => {
          setDownloadFeedback(null);
          downloadFeedbackTimerRef.current = null;
        }, 12000);
      }
    },
    [clearDownloadFeedbackTimer]
  );

  const dismissDownloadFeedback = useCallback(() => {
    clearDownloadFeedbackTimer();
    setDownloadFeedback(null);
  }, [clearDownloadFeedbackTimer]);

  const resetImportState = useCallback(() => {
    cancelRef.current = false;
    setFile(null);
    setParseError("");
    setHeaders([]);
    setParsedRows([]);
    setValidation(null);
    setProgress(null);
    setSummary(null);
    setParsing(false);
    setValidating(false);
    setImporting(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetImportState();
      setTab("import");
      setMessage("");
      setDownloading("");
      dismissDownloadFeedback();
    }
  }, [isOpen, resetImportState, dismissDownloadFeedback]);

  useEffect(() => () => clearDownloadFeedbackTimer(), [clearDownloadFeedbackTimer]);

  async function runDownloadAction(id, label, action) {
    setDownloading(id);
    dismissDownloadFeedback();
    setMessage("");
    try {
      const result = await action();
      showDownloadFeedback({
        type: "success",
        title: "Download ready",
        label,
        filename: result.filename,
        size: result.size,
        detail: result.detail || null,
      });
    } catch (err) {
      showDownloadFeedback({
        type: "error",
        title: "Download failed",
        label,
        message: err.message || "Could not download the file. Please try again.",
      });
    } finally {
      setDownloading(null);
    }
  }

  async function runValidation(rows, importMode) {
    setValidating(true);
    try {
      const { skuIndex, barcodeIndex, unitIndex, supplierIndex } =
        await productImportService.getValidationIndexes();
      const result = validateImportRows(rows, {
        skuIndex,
        barcodeIndex,
        unitIndex,
        supplierIndex,
        mode: importMode,
      });
      setValidation(result);
      return result;
    } finally {
      setValidating(false);
    }
  }

  async function handleFileSelected(selectedFile) {
    if (!selectedFile) return;
    setMessage("");
    setSummary(null);
    setValidation(null);

    if (!isAcceptedImportFile(selectedFile)) {
      setParseError("Invalid file format. Please upload a CSV (.csv) or Excel (.xlsx) file.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setParseError("");

    try {
      const raw = await readImportFile(selectedFile);
      const sheet = sheetToProducts(raw);

      if (sheet.error) {
        setParseError(sheet.error);
        setParsedRows([]);
        setHeaders(sheet.headers);
        return;
      }

      setHeaders(sheet.headers);
      setParsedRows(sheet.rows);
      await runValidation(sheet.rows, mode);
    } catch (err) {
      setParseError(err.message || "Failed to read file");
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  }

  async function handleModeChange(nextMode) {
    setMode(nextMode);
    if (parsedRows.length) {
      await runValidation(parsedRows, nextMode);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileSelected(dropped);
  }

  async function handleStartImport() {
    if (!parsedRows.length || importing) return;

    const latest = validation || (await runValidation(parsedRows, mode));
    const validCount = latest.validated.filter((r) => r.valid).length;

    if (validCount === 0) {
      setMessage("No valid rows to import. Fix validation errors or adjust import mode.");
      return;
    }

    if (mode === IMPORT_MODES.REPLACE_ALL) {
      const ok = await confirm({
        title: "Replace All Products",
        message:
          "This will permanently delete ALL existing products and replace them with the imported file. Sales history line items may be affected. This cannot be undone.",
        confirmLabel: "Replace All Products",
        variant: "danger",
      });
      if (!ok) return;
    } else {
      const ok = await confirm({
        title: "Start Import",
        message: `Import ${validCount} valid row(s) from "${file.name}" using "${IMPORT_MODE_LABELS[mode]}"?`,
        confirmLabel: "Start Import",
        variant: "primary",
      });
      if (!ok) return;
    }

    cancelRef.current = false;
    setImporting(true);
    setSummary(null);
    setProgress({ phase: "importing", processed: 0, total: latest.validated.length, percent: 0 });

    try {
      const result = await productImportService.runImport(latest.validated, {
        mode,
        fileName: file.name,
        isCancelled: () => cancelRef.current,
        onProgress: setProgress,
      });
      setSummary(result);
      onComplete?.(result);
    } catch (err) {
      setMessage(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleCancelImport() {
    cancelRef.current = true;
  }

  function downloadErrorReport() {
    const errors = summary?.errors || validation?.errors || [];
    if (!errors.length) return;
    const filename = `import-errors-${productImportService.timestamp()}.csv`;
    runDownloadAction("error-report", "Error report", async () => {
      const csv = buildErrorReportCsv(
        headers.length ? headers : PRODUCT_IMPORT_COLUMNS.map((c) => c.label),
        errors
      );
      const result = downloadText(csv, filename);
      return { ...result, detail: `${errors.length} error row(s)` };
    });
  }

  async function handleExportCsv() {
    await runDownloadAction("export-csv", "Product export", async () => {
      setExporting(true);
      try {
        const result = await productImportService.exportCsv();
        const downloaded = downloadText(result.content, result.filename);
        return {
          ...downloaded,
          detail: `${result.count} product(s)`,
        };
      } finally {
        setExporting(false);
      }
    });
  }

  async function handleExportExcel() {
    await runDownloadAction("export-xlsx", "Product export", async () => {
      setExporting(true);
      try {
        const result = await productImportService.exportExcel();
        const downloaded = downloadArrayBuffer(result.buffer, result.filename, result.mimeType);
        return {
          ...downloaded,
          detail: `${result.count} product(s)`,
        };
      } finally {
        setExporting(false);
      }
    });
  }

  async function handleTemplateCsv() {
    await runDownloadAction("template-csv", "CSV template", async () => {
      const result = productImportService.templateCsv();
      const downloaded = downloadText(result.content, result.filename);
      return {
        ...downloaded,
        detail: `3 example products · ${PRODUCT_IMPORT_COLUMNS.length} columns`,
      };
    });
  }

  async function handleTemplateExcel() {
    await runDownloadAction("template-xlsx", "Excel template", async () => {
      const result = productImportService.templateExcel();
      const downloaded = downloadArrayBuffer(result.buffer, result.filename, result.mimeType);
      return {
        ...downloaded,
        detail: "Products + Instructions sheets",
      };
    });
  }

  const preview = previewRows(parsedRows);
  const errorCount = validation?.errors?.length ?? 0;
  const validCount = validation?.validated?.filter((r) => r.valid).length ?? 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={importing ? undefined : onClose}
        title="Product Import & Export"
        size="xl"
        closeOnOverlay={!importing}
        footer={
          tab === "import" ? (
            <>
              {importing ? (
                <Button variant="danger" onClick={handleCancelImport}>
                  Cancel Import
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>
                  <Button
                    onClick={handleStartImport}
                    disabled={!file || parsing || validating || !parsedRows.length || importing}
                  >
                    Start Import
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </>
          )
        }
      >
        <div className="pie-modal">
          <div className="pie-tabs">
            <button
              type="button"
              className={`pie-tab ${tab === "import" ? "active" : ""}`}
              onClick={() => setTab("import")}
              disabled={importing}
            >
              <Upload size={16} /> Import
            </button>
            <button
              type="button"
              className={`pie-tab ${tab === "export" ? "active" : ""}`}
              onClick={() => setTab("export")}
              disabled={importing}
            >
              <Download size={16} /> Export
            </button>
          </div>

          {message && <Alert type="success">{message}</Alert>}

          <DownloadFeedbackBanner feedback={downloadFeedback} onDismiss={dismissDownloadFeedback} />

          {tab === "export" && (
            <div className="pie-export">
              <p className="pie-help">
                Export your full catalogue with all product fields — English &amp; Arabic names, SKU, barcode,
                category, unit, supplier, prices, VAT settings, stock, and published status (UTF-8).
              </p>
              <div className="pie-export-actions">
                <Button
                  variant="secondary"
                  disabled={exporting || Boolean(downloading)}
                  onClick={handleExportCsv}
                >
                  {downloading === "export-csv" ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  {downloading === "export-csv" ? "Preparing CSV…" : "Export CSV"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={exporting || Boolean(downloading)}
                  onClick={handleExportExcel}
                >
                  {downloading === "export-xlsx" ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  {downloading === "export-xlsx" ? "Preparing Excel…" : "Export Excel"}
                </Button>
              </div>
              <div className="pie-template-section">
                <h4>Download Template</h4>
                <p>
                  Templates match the Add Product form. Required columns: <strong>name</strong>,{" "}
                  <strong>selling_price</strong>. Excel includes 3 example rows plus an Instructions sheet.
                </p>
                <div className="pie-export-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(downloading)}
                    onClick={handleTemplateCsv}
                  >
                    {downloading === "template-csv" ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {downloading === "template-csv" ? "Downloading…" : "CSV Template"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(downloading)}
                    onClick={handleTemplateExcel}
                  >
                    {downloading === "template-xlsx" ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {downloading === "template-xlsx" ? "Downloading…" : "Excel Template"}
                  </Button>
                </div>
              </div>
              <div className="pie-field-reference">
                <h4>Column reference</h4>
                <div className="pie-field-reference-wrap">
                  <table className="pie-field-reference-table">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Required</th>
                        <th>Description</th>
                        <th>Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PRODUCT_IMPORT_COLUMNS.map((col) => (
                        <tr key={col.key}>
                          <td><code>{col.label}</code></td>
                          <td>{col.required ? "Yes" : "No"}</td>
                          <td>{col.hint}</td>
                          <td>{col.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "import" && (
            <div className="pie-import">
              {!importing && !summary && (
                <>
                  <div
                    className={`pie-dropzone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_MIME}
                      className="pie-file-input"
                      onChange={(e) => handleFileSelected(e.target.files?.[0])}
                    />
                    <Upload size={28} />
                    <p className="pie-dropzone-title">Drag & drop your file here</p>
                    <p className="pie-dropzone-sub">or click to browse — CSV (.csv) or Excel (.xlsx)</p>
                    {file && (
                      <div className="pie-file-meta">
                        <FileSpreadsheet size={16} />
                        <span>{file.name}</span>
                        <span className="pie-file-size">{formatFileSize(file.size)}</span>
                      </div>
                    )}
                  </div>

                  {parsing && (
                    <div className="pie-status">
                      <Loader2 size={16} className="spin" /> Reading file…
                    </div>
                  )}

                  {parseError && <Alert>{parseError}</Alert>}

                  {parsedRows.length > 0 && (
                    <>
                      <div className="pie-mode-section">
                        <h4>Import mode</h4>
                        <div className="pie-mode-options">
                          {Object.entries(IMPORT_MODE_LABELS).map(([id, label]) => (
                            <label key={id} className={`pie-mode-option ${mode === id ? "active" : ""}`}>
                              <input
                                type="radio"
                                name="import-mode"
                                value={id}
                                checked={mode === id}
                                onChange={() => handleModeChange(id)}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {validating && (
                        <div className="pie-status">
                          <Loader2 size={16} className="spin" /> Validating rows…
                        </div>
                      )}

                      {validation && (
                        <div className="pie-validation-summary">
                          <div className="pie-stat ok">
                            <CheckCircle2 size={16} /> {validCount} valid
                          </div>
                          <div className="pie-stat err">
                            <XCircle size={16} /> {errorCount} with errors
                          </div>
                          <div className="pie-stat">
                            Total rows: {parsedRows.length}
                          </div>
                          {errorCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={downloadErrorReport}>
                              <Download size={14} /> Download error report
                            </Button>
                          )}
                        </div>
                      )}

                      {validation?.errors?.length > 0 && (
                        <div className="pie-errors">
                          <h4>
                            <AlertTriangle size={16} /> Validation errors (first 20)
                          </h4>
                          <ul>
                            {validation.errors.slice(0, 20).map((err) => (
                              <li key={err.rowNumber}>
                                <strong>Row {err.rowNumber}:</strong> {err.messages.join("; ")}
                              </li>
                            ))}
                          </ul>
                          {validation.errors.length > 20 && (
                            <p className="pie-more-errors">
                              + {validation.errors.length - 20} more — download the full error report.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="pie-preview">
                        <h4>Preview (first {preview.length} rows)</h4>
                        <div className="pie-preview-table-wrap">
                          <table className="pie-preview-table">
                            <thead>
                              <tr>
                                <th>Row</th>
                                <th>Name</th>
                                <th>Arabic</th>
                                <th>SKU</th>
                                <th>Barcode</th>
                                <th>Category</th>
                                <th>Unit</th>
                                <th>Price</th>
                                <th>Qty</th>
                                <th>Published</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.map((row) => {
                                const v = validation?.validated?.find((r) => r.rowNumber === row.rowNumber);
                                return (
                                  <tr key={row.rowNumber} className={v && !v.valid ? "invalid" : ""}>
                                    <td>{row.rowNumber}</td>
                                    <td>{row.data.name}</td>
                                    <td dir="rtl">{row.data.name_ar}</td>
                                    <td>{row.data.sku}</td>
                                    <td>{row.data.barcode}</td>
                                    <td>{row.data.category}</td>
                                    <td>{row.data.unit}</td>
                                    <td>{row.data.selling_price}</td>
                                    <td>{row.data.quantity}</td>
                                    <td>{row.data.published || "yes"}</td>
                                    <td>{v?.valid ? "OK" : "Error"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="pie-template-inline">
                        <span>Need a template?</span>
                        <button
                          type="button"
                          className="pie-link"
                          disabled={Boolean(downloading)}
                          onClick={handleTemplateCsv}
                        >
                          {downloading === "template-csv" ? "Downloading CSV…" : "CSV"}
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          className="pie-link"
                          disabled={Boolean(downloading)}
                          onClick={handleTemplateExcel}
                        >
                          {downloading === "template-xlsx" ? "Downloading Excel…" : "Excel"}
                        </button>
                        <span>·</span>
                        <span>Includes 3 example products matching the Add Product form</span>
                      </div>
                    </>
                  )}
                </>
              )}

              {importing && progress && (
                <div className="pie-progress-section">
                  <h4>Importing products…</h4>
                  <div className="pie-progress-bar">
                    <div className="pie-progress-fill" style={{ width: `${progress.percent}%` }} />
                  </div>
                  <div className="pie-progress-meta">
                    <span>{progress.percent}%</span>
                    <span>
                      {progress.processed} / {progress.total} processed
                    </span>
                    <span>{formatEta(progress.etaSeconds)}</span>
                  </div>
                  <div className="pie-progress-stats">
                    <span>Imported: {progress.imported}</span>
                    <span>Updated: {progress.updated}</span>
                    <span>Skipped: {progress.skipped}</span>
                    <span>Failed: {progress.failed}</span>
                  </div>
                </div>
              )}

              {summary && !importing && (
                <div className="pie-summary">
                  <h4>
                    {summary.cancelled ? "Import cancelled" : "Import complete"}
                  </h4>
                  <div className="pie-summary-grid">
                    <div><span>Total rows</span><strong>{summary.totalRows}</strong></div>
                    <div><span>Imported</span><strong>{summary.imported}</strong></div>
                    <div><span>Updated</span><strong>{summary.updated}</strong></div>
                    <div><span>Skipped</span><strong>{summary.skipped}</strong></div>
                    <div><span>Failed</span><strong>{summary.failed}</strong></div>
                  </div>
                  {summary.errors?.length > 0 && (
                    <>
                      <Alert>
                        {summary.errors.length} row(s) failed. Download the error report for details.
                      </Alert>
                      <Button variant="secondary" size="sm" onClick={downloadErrorReport}>
                        <Download size={14} /> Download error report
                      </Button>
                      <ul className="pie-summary-errors">
                        {summary.errors.slice(0, 10).map((err) => (
                          <li key={`${err.rowNumber}-${err.messages[0]}`}>
                            Row {err.rowNumber}: {err.messages.join("; ")}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {!summary.cancelled && summary.failed === 0 && (
                    <Alert type="success">Import finished successfully.</Alert>
                  )}
                  <div className="pie-summary-actions">
                    <Button variant="secondary" onClick={resetImportState}>
                      Import another file
                    </Button>
                    <Button onClick={onClose}>Done</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
      {confirmDialog}
    </>
  );
}
