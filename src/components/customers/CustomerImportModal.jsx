import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2 } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Alert } from "../common/Loading";
import { customerImportService } from "../../services/CustomerImportService";
import {
  ACCEPTED_MIME,
  CUSTOMER_IMPORT_MODES,
  CUSTOMER_IMPORT_MODE_LABELS,
  isAcceptedCustomerImportFile,
  previewRows,
  readCustomerImportFile,
  sheetToCustomers,
  validateCustomerImportRows,
} from "../../utils/customerImport/parse";
import { CUSTOMER_IMPORT_COLUMNS } from "../../utils/customerImport/columns";
import { downloadArrayBuffer, downloadText, formatFileSize } from "../../utils/productImport/download";
import "../products/ProductImportExportModal.css";

export default function CustomerImportModal({ isOpen, onClose, onComplete }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parseError, setParseError] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [validation, setValidation] = useState(null);
  const [mode, setMode] = useState(CUSTOMER_IMPORT_MODES.NEW_ONLY);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");

  function resetState() {
    setFile(null);
    setParseError("");
    setParsedRows([]);
    setValidation(null);
    setProgress(null);
    setSummary(null);
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (importing) return;
    resetState();
    onClose();
  }

  async function handleFileSelected(nextFile) {
    if (!nextFile) return;
    setSummary(null);
    setMessage("");
    if (!isAcceptedCustomerImportFile(nextFile)) {
      setParseError("Use a CSV (.csv) or Excel (.xlsx) file.");
      setFile(null);
      setParsedRows([]);
      setValidation(null);
      return;
    }

    setFile(nextFile);
    setParsing(true);
    setParseError("");
    try {
      const rawRows = await readCustomerImportFile(nextFile);
      const parsed = sheetToCustomers(rawRows);
      if (parsed.error) {
        setParseError(parsed.error);
        setParsedRows([]);
        setValidation(null);
        return;
      }
      setParsedRows(parsed.rows);
      setValidation(validateCustomerImportRows(parsed.rows));
    } catch (err) {
      setParseError(err.message || "Could not read this file.");
      setParsedRows([]);
      setValidation(null);
    } finally {
      setParsing(false);
    }
  }

  async function handleStartImport() {
    const validRows = validation?.validated || [];
    if (!validRows.length || importing) return;
    setImporting(true);
    setProgress({ phase: "importing", processed: 0, total: validRows.filter((row) => row.valid).length, percent: 0 });
    try {
      const result = await customerImportService.runImport(validRows, {
        mode,
        onProgress: setProgress,
      });
      setSummary(result);
      setMessage(
        `Imported ${result.imported} customer${result.imported === 1 ? "" : "s"}${
          result.updated ? `, updated ${result.updated}` : ""
        }${result.skipped ? `, skipped ${result.skipped}` : ""}.`
      );
      onComplete?.();
    } catch (err) {
      setParseError(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function handleTemplateCsv() {
    const template = customerImportService.getTemplateCsv();
    downloadText(template.content, template.filename);
  }

  function handleTemplateExcel() {
    const template = customerImportService.getTemplateExcel();
    downloadArrayBuffer(
      template.buffer,
      template.filename,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  const preview = previewRows(parsedRows);
  const validCount = validation?.validated?.filter((row) => row.valid).length ?? 0;
  const errorCount = validation?.errors?.length ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={importing ? undefined : handleClose}
      title="Import customers"
      size="xl"
      closeOnOverlay={!importing}
      footer={
        importing ? (
          <Button variant="secondary" disabled>
            Importing…
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={handleStartImport} disabled={!validCount || parsing}>
              Import {validCount ? `${validCount} customer${validCount === 1 ? "" : "s"}` : ""}
            </Button>
          </>
        )
      }
    >
      <div className="pie-modal">
        {message && <Alert type="success">{message}</Alert>}

        {!importing && !summary && (
          <>
            <p className="pie-help">
              Import a CSV or Excel file with columns <strong>name</strong>, <strong>phone</strong>,{" "}
              <strong>email</strong>, <strong>address</strong>, and <strong>notes</strong>. Name is required.
            </p>

            <div
              className={`pie-dropzone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                handleFileSelected(event.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME}
                className="pie-file-input"
                onChange={(event) => handleFileSelected(event.target.files?.[0])}
              />
              <Upload size={28} />
              <p className="pie-dropzone-title">Drag & drop your customer file here</p>
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
                    {Object.entries(CUSTOMER_IMPORT_MODE_LABELS).map(([id, label]) => (
                      <label key={id} className={`pie-mode-option ${mode === id ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="customer-import-mode"
                          value={id}
                          checked={mode === id}
                          onChange={() => setMode(id)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pie-preview">
                  <h4>
                    Preview · {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} · {validCount} ready
                    {errorCount ? ` · ${errorCount} with errors` : ""}
                  </h4>
                  <div className="pie-preview-table-wrap">
                    <table className="pie-preview-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr key={row.rowNumber}>
                            <td>{row.data.name || "—"}</td>
                            <td>{row.data.phone || "—"}</td>
                            <td>{row.data.address || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="pie-template-section">
              <h4>Need a blank template?</h4>
              <p>Headers match the Add Customer form. Fill name, then optional phone, email, address, and notes.</p>
              <div className="pie-export-actions">
                <Button variant="ghost" size="sm" onClick={handleTemplateCsv}>
                  <Download size={14} /> CSV template
                </Button>
                <Button variant="ghost" size="sm" onClick={handleTemplateExcel}>
                  <Download size={14} /> Excel template
                </Button>
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
                      </tr>
                    </thead>
                    <tbody>
                      {CUSTOMER_IMPORT_COLUMNS.map((col) => (
                        <tr key={col.key}>
                          <td>
                            <code>{col.label}</code>
                          </td>
                          <td>{col.required ? "Yes" : "No"}</td>
                          <td>{col.hint}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {importing && progress && (
          <div className="pie-status">
            <Loader2 size={16} className="spin" /> Importing {progress.processed} of {progress.total}…
          </div>
        )}

        {summary && !importing && (
          <div className="pie-summary">
            <h4>
              <CheckCircle2 size={18} /> Import complete
            </h4>
            <div className="pie-summary-grid">
              <div>
                <span>Imported</span>
                <strong>{summary.imported}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{summary.updated}</strong>
              </div>
              <div>
                <span>Skipped</span>
                <strong>{summary.skipped}</strong>
              </div>
              <div>
                <span>Failed</span>
                <strong>{summary.failed}</strong>
              </div>
            </div>
            {summary.errors?.length > 0 && (
              <div className="pie-summary-errors">
                {summary.errors.slice(0, 8).map((error) => (
                  <p key={error.rowNumber}>
                    Row {error.rowNumber}: {error.messages.join("; ")}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
