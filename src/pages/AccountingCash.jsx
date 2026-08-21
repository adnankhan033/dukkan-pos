import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { customerService } from "../services/CustomerService";
import { supplierService } from "../services/SupplierService";
import { useSettingsStore } from "../contexts/store";
import { useSubmitGuard } from "../hooks/useSubmitGuard";
import { PAYMENT_METHODS } from "../utils/constants";
import { getBusinessDateISO } from "../utils/businessDate";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input, Textarea } from "../components/common/Input";
import SearchableSelect from "../components/common/SearchableSelect";
import { Alert, LoadingSpinner } from "../components/common/Loading";
import { formatCurrency, formatSignedCurrency, todayISO } from "../utils/format";
import "./AccountingHub.css";
import "./AccountingCash.css";

function emptyRow() {
  return { partyId: "", amount: "", remarks: "Cash", error: "" };
}

export default function AccountingCash({ mode = "receive" }) {
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency || "SAR";
  const { submitting, guard } = useSubmitGuard();
  const isReceive = mode === "receive";
  const [parties, setParties] = useState([]);
  const [rows, setRows] = useState([emptyRow()]);
  const [date, setDate] = useState(getBusinessDateISO(settings) || todayISO());
  const [notes, setNotes] = useState("");
  const [owingOnly, setOwingOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadParties() {
    return isReceive
      ? customerService.getAllForExport({ includeBalances: true })
      : supplierService.getAllForExport();
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await loadParties();
        if (alive) setParties(list);
      } catch (err) {
        if (alive) setError(err.message || "Could not load accounts");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isReceive]);

  const visibleParties = useMemo(() => {
    if (!owingOnly) return parties;
    return parties.filter((party) => Number(party.balance_pending || 0) > 0.01);
  }, [parties, owingOnly]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [rows]
  );

  const partyOptions = useMemo(
    () =>
      visibleParties.map((party) => {
        const name = isReceive ? party.name : party.company;
        const due = Number(party.balance_pending || 0);
        let hint;
        if (isReceive) {
          if (due > 0.01) hint = formatSignedCurrency(due, currency, "in");
        } else if (due > 0.01) {
          hint = `${formatSignedCurrency(due, currency, "out")} still to pay`;
        } else if (due < -0.01) {
          hint = `${formatSignedCurrency(Math.abs(due), currency, "in")} extra paid`;
        }
        return {
          value: String(party.id),
          label: name,
          hint,
          meta: [party.phone, party.email, party.contact_person].filter(Boolean).join(" "),
        };
      }),
    [visibleParties, isReceive, currency]
  );

  function updateRow(index, patch) {
    setRows((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch, error: patch.error ?? "" };
      return next;
    });
  }

  function selectParty(index, partyId) {
    const party = parties.find((item) => String(item.id) === String(partyId));
    const due = Number(party?.balance_pending || 0);
    const row = rows[index];
    updateRow(index, {
      partyId,
      amount: row.amount || (due > 0 ? String(due) : ""),
    });
  }

  async function save() {
    setError("");
    setMessage("");
    const filled = rows.filter((row) => row.partyId && Number(row.amount) > 0);
    if (!filled.length) {
      setError("Add at least one line with a name and amount.");
      return;
    }

    await guard(async () => {
      const leftover = [];
      let posted = 0;
      let postedAmount = 0;

      for (const row of rows) {
        if (!row.partyId || !(Number(row.amount) > 0)) {
          if (row.partyId || row.amount) leftover.push({ ...row, error: "" });
          continue;
        }
        try {
          if (isReceive) {
            await customerService.recordPayment({
              customerId: Number(row.partyId),
              amount: Number(row.amount),
              notes: row.remarks || notes || "Cash receive",
              paymentMethod: PAYMENT_METHODS.CASH,
              paymentDate: date,
            });
          } else {
            await supplierService.recordPayment({
              supplierId: Number(row.partyId),
              amount: Number(row.amount),
              notes: row.remarks || notes || "Cash payment",
              paymentDate: date,
            });
          }
          posted += 1;
          postedAmount += Number(row.amount);
        } catch (err) {
          leftover.push({ ...row, error: err.message || "Could not save this line" });
        }
      }

      setParties(await loadParties());
      setRows(leftover.length ? leftover : [emptyRow()]);
      if (posted) {
        setNotes("");
        setMessage(
          isReceive
            ? `Received ${formatCurrency(postedAmount, currency)} from ${posted} customer${posted === 1 ? "" : "s"}.`
            : `Paid ${formatCurrency(postedAmount, currency)} to ${posted} supplier${posted === 1 ? "" : "s"}.`
        );
      }
      if (leftover.some((row) => row.error)) {
        setError("Some lines could not be saved. Fix the amounts and try again.");
      }
    });
  }

  return (
    <div className="acct-hub">
      <PageHeader
        title={isReceive ? "Receive cash" : "Pay cash"}
        subtitle={
          isReceive
            ? "Collect money from one or more customers who bought on credit — one voucher, many names."
            : "Pay one or more suppliers from the till — one voucher, many names."
        }
      />

      {error ? <Alert type="error">{error}</Alert> : null}
      {message ? <Alert type="success">{message}</Alert> : null}

      {loading ? (
        <LoadingSpinner message="Loading accounts..." />
      ) : (
        <Card className="acct-voucher">
          <div className="acct-voucher-head">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <label className="acct-voucher-toggle">
              <input
                type="checkbox"
                checked={owingOnly}
                onChange={(e) => setOwingOnly(e.target.checked)}
              />
              {isReceive ? "Only customers who owe" : "Only suppliers to pay"}
            </label>
            <div className="acct-voucher-total">
              <span>Total</span>
              <strong>{formatCurrency(total, currency)}</strong>
            </div>
          </div>

          <div className="acct-voucher-table">
            <div className="acct-voucher-row head">
              <span>#</span>
              <span>{isReceive ? "Customer" : "Supplier"}</span>
              <span>Remarks</span>
              <span>Amount</span>
              <span />
            </div>
            {rows.map((row, index) => (
              <div key={index} className="acct-voucher-row-wrap">
                <div className="acct-voucher-row">
                  <span>{index + 1}</span>
                  <SearchableSelect
                    className="acct-voucher-party"
                    value={row.partyId}
                    onChange={(partyId) => selectParty(index, partyId)}
                    options={partyOptions}
                    placeholder={isReceive ? "Search customer…" : "Search supplier…"}
                    noneLabel={isReceive ? "Select customer" : "Select supplier"}
                    menuPortal
                  />
                  <Input
                    value={row.remarks}
                    onChange={(e) => updateRow(index, { remarks: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(index, { amount: e.target.value })}
                  />
                  {rows.length > 1 ? (
                    <Button variant="ghost" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                      <Trash2 size={16} />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
                {row.error ? <p className="acct-voucher-row-error">{row.error}</p> : null}
              </div>
            ))}
          </div>

          {!visibleParties.length ? (
            <Alert type="info">
              {isReceive
                ? "No customers currently owe money. Uncheck “Only customers who owe” to pick any customer."
                : "No suppliers currently have a balance. Uncheck “Only suppliers to pay” to pick any supplier."}
            </Alert>
          ) : null}

          <div className="acct-voucher-actions">
            <Button variant="secondary" onClick={() => setRows([...rows, emptyRow()])}>
              <Plus size={16} /> Add line
            </Button>
            <Button disabled={submitting} onClick={() => save().catch((err) => setError(err.message || "Could not save"))}>
              {submitting ? "Saving..." : isReceive ? "Save receipt" : "Save payment"}
            </Button>
          </div>

          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Card>
      )}
    </div>
  );
}
