import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import Button from "./Button";
import { Select } from "./Input";
import { Alert } from "./Loading";
import { directoryExportService } from "../../services/DirectoryExportService";
import {
  CUSTOMER_EXPORT_SCOPE_OPTIONS,
  CUSTOMER_EXPORT_SCOPES,
  DIRECTORY_EXPORT_TYPES,
} from "../../utils/directoryExport/definitions";
import { downloadArrayBuffer } from "../../utils/productImport/download";
import "./DirectoryExportButtons.css";

export default function DirectoryExportButtons({
  type,
  search = "",
  label = "Export",
}) {
  const [downloading, setDownloading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [customerScope, setCustomerScope] = useState(CUSTOMER_EXPORT_SCOPES.ACCOUNTS);

  const isCustomerExport = type === DIRECTORY_EXPORT_TYPES.CUSTOMERS;

  const selectedScope = useMemo(
    () => CUSTOMER_EXPORT_SCOPE_OPTIONS.find((option) => option.id === customerScope),
    [customerScope]
  );

  async function runExport(format) {
    setDownloading(format);
    setMessage("");
    setError("");
    try {
      const options = { search };
      if (isCustomerExport) {
        options.scope = customerScope;
      }

      const result =
        format === "pdf"
          ? await directoryExportService.exportPdf(type, options)
          : await directoryExportService.exportExcel(type, options);

      downloadArrayBuffer(result.buffer, result.filename, result.mimeType);
      setMessage(
        `${label} ${format.toUpperCase()} downloaded — ${result.count} record(s) · ${result.filename}`
      );
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="directory-export-wrap">
      {isCustomerExport && (
        <div className="directory-export-panel">
          <div className="directory-export-panel-head">
            <div>
              <strong>Export report</strong>
              <p>Choose what to include, then download PDF or Excel.</p>
            </div>
          </div>
          <Select
            label="Report type"
            className="directory-export-scope-select"
            value={customerScope}
            onChange={(e) => setCustomerScope(e.target.value)}
            disabled={Boolean(downloading)}
          >
            {CUSTOMER_EXPORT_SCOPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          {selectedScope?.hint && (
            <p className="directory-export-scope-hint">{selectedScope.hint}</p>
          )}
        </div>
      )}

      <div className="directory-export-actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={Boolean(downloading)}
          onClick={() => runExport("pdf")}
        >
          {downloading === "pdf" ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
          {downloading === "pdf" ? "Preparing PDF..." : "Download PDF"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={Boolean(downloading)}
          onClick={() => runExport("excel")}
        >
          {downloading === "excel" ? <Loader2 size={15} className="spin" /> : <FileSpreadsheet size={15} />}
          {downloading === "excel" ? "Preparing Excel..." : "Download Excel"}
        </Button>
      </div>
      <p className="directory-export-note">
        <Download size={13} />
        {isCustomerExport
          ? "PDF uses the same professional layout as Invoices export — cover summary plus detailed table."
          : "Letterhead includes your store name, address, CR/VAT, date, and summary — ready to share on WhatsApp."}
      </p>
      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
