import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Landmark,
  Plus,
  Trash2,
  Wallet,
  Users,
} from "lucide-react";
import { accountingService } from "../../services/AccountingService";
import { settingsService } from "../../services/SettingsService";
import { useSettingsStore } from "../../contexts/store";
import { Card } from "../common/Card";
import Button from "../common/Button";
import { Input } from "../common/Input";
import { Alert, LoadingSpinner } from "../common/Loading";
import { formatCurrency } from "../../utils/format";
import { todayISO } from "../../utils/format";
import "./AccountingSettingsPanel.css";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "year", label: "Fiscal year" },
  { id: "cash", label: "Cash & bank" },
  { id: "partners", label: "Partners" },
  { id: "review", label: "Review" },
];

function emptyPartner() {
  return { name: "", capital: "", ownership_percent: "" };
}

function emptyBank() {
  return { name: "", number: "", opening: "" };
}

export default function AccountingSettingsPanel() {
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const currency = settings.currency || "SAR";
  const [status, setStatus] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [startMode, setStartMode] = useState("snapshot");
  const [fiscalStart, setFiscalStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [hasCash, setHasCash] = useState(true);
  const [hasBank, setHasBank] = useState(false);
  const [cashOpening, setCashOpening] = useState("");
  const [banks, setBanks] = useState([emptyBank()]);
  const [partners, setPartners] = useState([emptyPartner()]);
  const [periods, setPeriods] = useState([]);

  async function reload() {
    setLoading(true);
    try {
      const [nextStatus, nextSnapshot, nextPeriods] = await Promise.all([
        accountingService.getStatus(),
        accountingService.getOpeningSnapshot(),
        accountingService.listPeriods().catch(() => []),
      ]);
      setStatus(nextStatus);
      setSnapshot(nextSnapshot);
      setPeriods(nextPeriods);
    } catch (err) {
      setError(err.message || "Could not load accounting");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const ownershipTotal = useMemo(
    () => partners.reduce((sum, p) => sum + (Number(p.ownership_percent) || 0), 0),
    [partners]
  );

  const capitalTotal = useMemo(
    () => partners.reduce((sum, p) => sum + (Number(p.capital) || 0), 0),
    [partners]
  );

  const cashAmount = hasCash ? Number(cashOpening) || 0 : 0;
  const bankRows = hasBank ? banks : [];
  const bankTotal = useMemo(
    () => bankRows.reduce((sum, bank) => sum + (Number(bank.opening) || 0), 0),
    [bankRows]
  );
  const liquidTotal = cashAmount + bankTotal;

  async function handleActivate() {
    setBusy(true);
    setError("");
    try {
      await accountingService.activate({
        fiscalStart,
        cashOpening: cashAmount,
        banks: bankRows.map((bank, index) => ({
          ...bank,
          name: String(bank.name || "").trim() || (index === 0 ? "Main bank" : `Bank ${index + 1}`),
        })),
        partners: partners.filter((p) => String(p.name || "").trim()),
        startMode,
      });
      setSettings(await settingsService.getAll());
      setWizard(false);
      await reload();
    } catch (err) {
      setError(err.message || "Could not activate accounting");
    } finally {
      setBusy(false);
    }
  }

  async function handleClosePeriod(id) {
    setBusy(true);
    setError("");
    try {
      await accountingService.closePeriod(id);
      await reload();
    } catch (err) {
      setError(err.message || "Could not close period");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading accounting..." />;

  if (status?.enabled && !wizard) {
    return (
      <div className="acct-settings">
        {error ? <Alert type="error">{error}</Alert> : null}
        <Card className="settings-card">
          <div className="acct-status-head">
            <div>
              <h3 className="settings-section-title">
                <CheckCircle2 size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Accounting is active
              </h3>
              <p className="settings-section-desc">
                Sales, purchases, expenses, payments, and partner capital now post to the general ledger.
                POS, inventory, and ZATCA keep working as before.
              </p>
            </div>
            <Button onClick={() => navigate("/accounting/receive")}>Receive cash</Button>
          </div>
          <div className="acct-status-grid">
            <div>
              <span>Fiscal year</span>
              <strong>{status.period ? `${status.period.start_date} → ${status.period.end_date}` : "—"}</strong>
            </div>
            <div>
              <span>Accounts</span>
              <strong>{status.accountCount}</strong>
            </div>
            <div>
              <span>Partners</span>
              <strong>{status.partnerCount}</strong>
            </div>
            <div>
              <span>Journal entries</span>
              <strong>{status.journalCount}</strong>
            </div>
          </div>
        </Card>

        <Card className="settings-card">
          <h3 className="settings-section-title">Fiscal periods</h3>
          <div className="acct-period-list">
            {periods.map((period) => (
              <div key={period.id} className="acct-period-row">
                <div>
                  <strong>{period.name}</strong>
                  <span>
                    {period.start_date} → {period.end_date} · {period.status}
                    {period.is_current ? " · current" : ""}
                  </span>
                </div>
                {period.status === "open" ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleClosePeriod(period.id)}>
                    Close period
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="acct-settings">
      {error ? <Alert type="error">{error}</Alert> : null}

      {!wizard ? (
        <Card className="settings-card acct-hero">
          <Landmark size={28} />
          <h3 className="settings-section-title">Set up business accounting</h3>
          <p className="settings-section-desc">
            A short wizard turns this POS into a complete books system: chart of accounts, partners,
            cash and bank, customer/supplier ledgers, and financial reports. Existing sales and ZATCA
            stay untouched. New transactions post automatically after you finish.
          </p>
          <ul className="acct-hero-list">
            <li>Double-entry journals (debit always equals credit)</li>
            <li>Partners with unequal capital and profit share</li>
            <li>Profit &amp; loss, balance sheet, trial balance, cash flow</li>
          </ul>
          <Button onClick={() => setWizard(true)}>Start configuration</Button>
        </Card>
      ) : (
        <>
          <div className="acct-steps">
            {STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`acct-step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`}
                onClick={() => setStep(index)}
              >
                <span>{index + 1}</span>
                {item.label}
              </button>
            ))}
          </div>

          {current.id === "welcome" && (
            <Card className="settings-card">
              <h3 className="settings-section-title">How should we start the books?</h3>
              <p className="settings-section-desc">
                Recommended for a live store: take a snapshot of cash, stock, customers, and suppliers as of today.
                From then on every POS sale and purchase posts to the ledger.
              </p>
              <label className={`acct-choice ${startMode === "snapshot" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="startMode"
                  checked={startMode === "snapshot"}
                  onChange={() => setStartMode("snapshot")}
                />
                <div>
                  <strong>Snapshot today (recommended)</strong>
                  <p>Opening balances from current inventory, receivables, and payables. Future transactions post automatically.</p>
                </div>
              </label>
              <label className={`acct-choice ${startMode === "zero" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="startMode"
                  checked={startMode === "zero"}
                  onChange={() => setStartMode("zero")}
                />
                <div>
                  <strong>Start from zero</strong>
                  <p>Empty books except cash and partner capital you enter. Use this only for a brand-new store.</p>
                </div>
              </label>
            </Card>
          )}

          {current.id === "year" && (
            <Card className="settings-card">
              <h3 className="settings-section-title">Fiscal year</h3>
              <p className="settings-section-desc">
                Saudi stores often use the calendar year. You can start mid-year; closed periods cannot be edited later.
              </p>
              <Input
                label="Fiscal year start"
                type="date"
                value={fiscalStart}
                onChange={(e) => setFiscalStart(e.target.value)}
              />
            </Card>
          )}

          {current.id === "cash" && (
            <Card className="settings-card">
              <h3 className="settings-section-title">
                <Wallet size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Where is the store money today?
              </h3>
              <p className="settings-section-desc">
                Count what you actually have right now. Use cash, bank, or both. Leave a box off if that place is empty.
                You can move money between cash and bank later from Accounting → Journals → Transfer.
              </p>

              <div className="acct-money-choices">
                <label className={`acct-choice ${hasCash ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={hasCash}
                    onChange={(e) => {
                      setHasCash(e.target.checked);
                      if (!e.target.checked) setCashOpening("");
                    }}
                  />
                  <div>
                    <strong>Cash in the till / drawer</strong>
                    <p>Physical cash in the store today. Turn off if the drawer is empty and money is in the bank.</p>
                  </div>
                </label>
                <label className={`acct-choice ${hasBank ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={hasBank}
                    onChange={(e) => {
                      setHasBank(e.target.checked);
                      if (e.target.checked && banks.length === 0) setBanks([emptyBank()]);
                    }}
                  />
                  <div>
                    <strong>Money in the bank</strong>
                    <p>Alinma, Al Rajhi, SNB, mada settlement — whatever the store uses. Add more than one if needed.</p>
                  </div>
                </label>
              </div>

              {hasCash ? (
                <div className="acct-money-block">
                  <Input
                    label={`Cash in the till (${currency})`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={cashOpening}
                    onChange={(e) => setCashOpening(e.target.value)}
                  />
                </div>
              ) : null}

              {hasBank ? (
                <div className="acct-money-block">
                  <div className="acct-repeat">
                    {banks.map((bank, index) => (
                      <div key={index} className="acct-repeat-row">
                        <Input
                          label="Bank name"
                          placeholder="Al Rajhi, Alinma, SNB..."
                          value={bank.name}
                          onChange={(e) => {
                            const next = [...banks];
                            next[index] = { ...bank, name: e.target.value };
                            setBanks(next);
                          }}
                        />
                        <Input
                          label="Account / IBAN (optional)"
                          value={bank.number}
                          onChange={(e) => {
                            const next = [...banks];
                            next[index] = { ...bank, number: e.target.value };
                            setBanks(next);
                          }}
                        />
                        <Input
                          label={`Balance today (${currency})`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={bank.opening}
                          onChange={(e) => {
                            const next = [...banks];
                            next[index] = { ...bank, opening: e.target.value };
                            setBanks(next);
                          }}
                        />
                        {banks.length > 1 ? (
                          <Button variant="ghost" onClick={() => setBanks(banks.filter((_, i) => i !== index))}>
                            <Trash2 size={16} />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={() => setBanks([...banks, emptyBank()])}>
                      <Plus size={14} /> Add another bank
                    </Button>
                  </div>
                </div>
              ) : null}

              {!hasCash && !hasBank ? (
                <p className="acct-hint">No cash or bank entered. Opening money will be 0. That is fine if the store starts empty.</p>
              ) : (
                <div className="acct-money-total">
                  <div>
                    <span>Cash</span>
                    <strong>{formatCurrency(cashAmount, currency)}</strong>
                  </div>
                  <div>
                    <span>Bank</span>
                    <strong>{formatCurrency(bankTotal, currency)}</strong>
                  </div>
                  <div>
                    <span>Total money today</span>
                    <strong>{formatCurrency(liquidTotal, currency)}</strong>
                  </div>
                </div>
              )}
            </Card>
          )}

          {current.id === "partners" && (
            <Card className="settings-card">
              <h3 className="settings-section-title">
                <Users size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Partners / owners
              </h3>
              <p className="settings-section-desc">
                Capital does not need to be equal. Ownership % is used for profit share unless you set a different share later.
              </p>
              <div className="acct-repeat">
                {partners.map((partner, index) => (
                  <div key={index} className="acct-repeat-row">
                    <Input
                      label="Partner name"
                      value={partner.name}
                      onChange={(e) => {
                        const next = [...partners];
                        next[index] = { ...partner, name: e.target.value };
                        setPartners(next);
                      }}
                    />
                    <Input
                      label={`Capital (${currency})`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={partner.capital}
                      onChange={(e) => {
                        const next = [...partners];
                        next[index] = { ...partner, capital: e.target.value };
                        setPartners(next);
                      }}
                    />
                    <Input
                      label="Ownership %"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={partner.ownership_percent}
                      onChange={(e) => {
                        const next = [...partners];
                        next[index] = { ...partner, ownership_percent: e.target.value };
                        setPartners(next);
                      }}
                    />
                    {partners.length > 1 ? (
                      <Button variant="ghost" onClick={() => setPartners(partners.filter((_, i) => i !== index))}>
                        <Trash2 size={16} />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setPartners([...partners, emptyPartner()])}>
                  <Plus size={14} /> Add partner
                </Button>
              </div>
              <p className="acct-hint">
                Ownership total: {ownershipTotal.toFixed(2)}% · Capital: {formatCurrency(capitalTotal, currency)}
                {Math.abs(ownershipTotal - 100) > 0.01 && ownershipTotal > 0 ? " — should add to 100%." : ""}
              </p>
            </Card>
          )}

          {current.id === "review" && (
            <Card className="settings-card">
              <h3 className="settings-section-title">
                <BookOpen size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Review and activate
              </h3>
              {startMode === "snapshot" && snapshot ? (
                <div className="acct-review-grid">
                  <div>
                    <span>Inventory value</span>
                    <strong>{formatCurrency(snapshot.inventoryValue, currency)}</strong>
                  </div>
                  <div>
                    <span>Customer outstanding</span>
                    <strong>{formatCurrency(snapshot.accountsReceivable, currency)}</strong>
                  </div>
                  <div>
                    <span>Supplier outstanding</span>
                    <strong>{formatCurrency(snapshot.accountsPayable, currency)}</strong>
                  </div>
                  <div>
                    <span>Cash in till</span>
                    <strong>{formatCurrency(cashAmount, currency)}</strong>
                  </div>
                  <div>
                    <span>Bank</span>
                    <strong>{formatCurrency(bankTotal, currency)}</strong>
                  </div>
                  <div>
                    <span>Total money</span>
                    <strong>{formatCurrency(liquidTotal, currency)}</strong>
                  </div>
                  <div>
                    <span>Partner capital</span>
                    <strong>{formatCurrency(capitalTotal, currency)}</strong>
                  </div>
                  <div>
                    <span>Go-live date</span>
                    <strong>{todayISO()}</strong>
                  </div>
                </div>
              ) : (
                <p className="settings-section-desc">
                  Books start empty except cash {formatCurrency(cashAmount, currency)}, bank {formatCurrency(bankTotal, currency)}, and partner capital {formatCurrency(capitalTotal, currency)}.
                </p>
              )}
              <p className="settings-section-desc">
                After activate, cashiers keep using POS as usual. Journals are created in the background.
              </p>
              <Button disabled={busy} onClick={handleActivate}>
                {busy ? "Activating..." : "Activate accounting"}
              </Button>
            </Card>
          )}

          <div className="acct-wizard-nav">
            <Button variant="secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={busy} onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
