import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, User } from "lucide-react";
import Button from "../common/Button";
import { Select } from "../common/Input";
import SearchableSelect from "../common/SearchableSelect";
import { Alert } from "../common/Loading";
import { directoryExportService } from "../../services/DirectoryExportService";
import {
  CUSTOMER_EXPORT_SCOPE_OPTIONS,
  CUSTOMER_EXPORT_SCOPES,
} from "../../utils/directoryExport/definitions";
import { describeCustomerFilters } from "../../utils/customerFilters";
import { formatCurrency } from "../../utils/format";
import { downloadArrayBuffer } from "../../utils/productImport/download";
import "../common/DirectoryExportButtons.css";

export default function CustomerExportPanel({
  customers = [],
  filters = {},
  settings = {},
  currency = "SAR",
  label = "Customer report",
}) {
  const [downloading, setDownloading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [customerScope, setCustomerScope] = useState(CUSTOMER_EXPORT_SCOPES.ACCOUNTS);
  const [statementCustomerId, setStatementCustomerId] = useState("");
  const [includeFullDetail, setIncludeFullDetail] = useState(true);

  const selectedScope = useMemo(
    () => CUSTOMER_EXPORT_SCOPE_OPTIONS.find((option) => option.id === customerScope),
    [customerScope]
  );

  const isFullStatement = customerScope === CUSTOMER_EXPORT_SCOPES.FULL_STATEMENT;
  const requiresCustomer = Boolean(selectedScope?.requiresCustomer);
  const effectiveCustomerId = filters.customerId || statementCustomerId;

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.name,
        hint: customer.phone || customer.email || undefined,
        meta: Number(customer.balance_pending) > 0
          ? `Due ${formatCurrency(customer.balance_pending, currency)}`
          : "Paid up",
      })),
    [customers, currency]
  );

  const selectedCustomer = useMemo(
    () => customers.find((entry) => String(entry.id) === String(effectiveCustomerId)),
    [customers, effectiveCustomerId]
  );

  const filterSummary = describeCustomerFilters(filters, customers);

  useEffect(() => {
    if (filters.customerId) {
      setStatementCustomerId(String(filters.customerId));
    }
  }, [filters.customerId]);

  async function runExport(format) {
    setDownloading(format);
    setMessage("");
    setError("");

    const customerId = effectiveCustomerId ? Number(effectiveCustomerId) : null;

    if (requiresCustomer && !customerId) {
      setError("Select a customer for the full account statement.");
      setDownloading("");
      return;
    }

    if (isFullStatement && format === "excel") {
      setError("Full account statement is available as PDF — use Download PDF to share with your customer.");
      setDownloading("");
      return;
    }

    try {
      const options = {
        filters,
        settings,
        scope: customerScope,
        customerId,
        includeFullDetail,
        filterSummary,
      };

      const result =
        format === "pdf"
          ? await directoryExportService.exportPdf("customers", options)
          : await directoryExportService.exportExcel("customers", options);

      downloadArrayBuffer(result.buffer, result.filename, result.mimeType);
      setMessage(
        `${label} ${format.toUpperCase()} downloaded — ${result.count ?? 0} record(s) · ${result.filename}`
      );
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="directory-export-wrap customer-export-wrap">
      <div className="directory-export-panel customer-export-panel">
        <div className="directory-export-panel-head">
          <div>
            <strong>Generate &amp; share report</strong>
            <p>
              Uses the same filters above — {customers.length} customer{customers.length === 1 ? "" : "s"} in this view.
            </p>
          </div>
        </div>

        <div className="customer-export-fields">
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

          {isFullStatement && !filters.customerId && (
            <SearchableSelect
              label="Statement customer"
              className="customer-export-customer-select"
              value={statementCustomerId}
              onChange={setStatementCustomerId}
              options={customerOptions}
              placeholder="Pick customer for statement…"
              noneLabel="Select customer"
              clearable={false}
              menuPortal
              disabled={Boolean(downloading)}
            />
          )}
        </div>

        {selectedScope?.hint && (
          <p className="directory-export-scope-hint">{selectedScope.hint}</p>
        )}

        <p className="customer-export-filter-note">
          <Download size={13} />
          Filter: {filterSummary}
        </p>

        {requiresCustomer && !effectiveCustomerId && (
          <p className="customer-export-required-hint">
            <User size={14} /> Pick a customer in the filter bar above, or choose one here for the statement.
          </p>
        )}

        {selectedCustomer && (
          <div className="customer-export-preview">
            <strong>{selectedCustomer.name}</strong>
            <span>
              Invoiced {formatCurrency(selectedCustomer.total_invoiced || 0, currency)}
              {" · "}
              Paid {formatCurrency(selectedCustomer.total_paid || 0, currency)}
              {" · "}
              Due {formatCurrency(selectedCustomer.balance_pending || 0, currency)}
            </span>
          </div>
        )}

        {isFullStatement && (
          <label className="customer-export-checkbox">
            <input
              type="checkbox"
              checked={includeFullDetail}
              onChange={(e) => setIncludeFullDetail(e.target.checked)}
              disabled={Boolean(downloading)}
            />
            <span>
              Include full invoice details — every product line, qty, price, paid amount, and balance
            </span>
          </label>
        )}
      </div>

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
        {!isFullStatement && (
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(downloading)}
            onClick={() => runExport("excel")}
          >
            {downloading === "excel" ? <Loader2 size={15} className="spin" /> : <FileSpreadsheet size={15} />}
            {downloading === "excel" ? "Preparing Excel..." : "Download Excel"}
          </Button>
        )}
      </div>

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
