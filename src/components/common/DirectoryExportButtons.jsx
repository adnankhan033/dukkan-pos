import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import Button from "./Button";
import { Alert } from "./Loading";
import { directoryExportService } from "../../services/DirectoryExportService";
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

  async function runExport(format) {
    setDownloading(format);
    setMessage("");
    setError("");
    try {
      const result =
        format === "pdf"
          ? await directoryExportService.exportPdf(type, { search })
          : await directoryExportService.exportExcel(type, { search });

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
        <Download size={13} /> Letterhead includes your store name, address, CR/VAT, date, and summary — ready to share on WhatsApp.
      </p>
      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
