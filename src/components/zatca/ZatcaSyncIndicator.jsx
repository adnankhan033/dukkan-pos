import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudUpload, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { zatcaService } from "../../services/ZatcaService";
import { useSettingsStore } from "../../contexts/store";
import { resolveActivePhase } from "../../zatca/core/config";
import { ZATCA_PHASES } from "../../zatca/core/constants";
import { getBusinessDateISO } from "../../utils/businessDate";
import "./ZatcaSyncIndicator.css";

export default function ZatcaSyncIndicator() {
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const activePhase = resolveActivePhase(settings);
  const businessDate = useMemo(() => getBusinessDateISO(settings), [settings]);

  const [pageData, setPageData] = useState(null);
  const [online, setOnline] = useState(true);

  const load = useCallback(async () => {
    try {
      const [data, queueStats] = await Promise.all([
        zatcaService.getSyncPageDashboard(businessDate),
        zatcaService.getQueueStats(),
      ]);
      setPageData(data);
      setOnline(Boolean(queueStats?.online));
    } catch {
      setPageData(null);
    }
  }, [businessDate]);

  useEffect(() => {
    if (activePhase !== ZATCA_PHASES.PHASE2) return undefined;
    load();
    const unsubscribe = zatcaService.subscribeSyncEvents(load);
    const intervalId = setInterval(load, 30000);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [activePhase, load]);

  if (activePhase !== ZATCA_PHASES.PHASE2) {
    return null;
  }

  const globalNeeds = pageData?.global?.needsAction ?? 0;
  const globalPending = pageData?.global?.pending ?? 0;
  const globalFailed = pageData?.global?.failed ?? 0;
  const todayTotal = pageData?.today?.stats?.total ?? 0;
  const todaySynced = pageData?.today?.stats?.synced ?? 0;
  const outstandingCount = pageData?.outstanding?.count ?? 0;

  let tone = "idle";
  let label = "ZATCA Sync — view invoices and sync manually";

  if (globalNeeds > 0) {
    tone = globalFailed > 0 ? "failed" : "pending";
    const older = Math.max(0, outstandingCount - (pageData?.today?.stats?.needsAction ?? 0));
    label =
      older > 0
        ? `${globalNeeds} invoice(s) need sync (${older} from previous day(s))`
        : `${globalNeeds} invoice(s) need ZATCA sync`;
  } else if (todayTotal > 0) {
    tone = "synced";
    label = `Today: ${todayTotal} sale${todayTotal !== 1 ? "s" : ""} — all synced to ZATCA`;
  } else if (pageData?.global?.total > 0) {
    tone = "synced";
    label = "All invoices synced — open to view history";
  }

  return (
    <button
      type="button"
      className={`zatca-sync-indicator ${tone}`}
      onClick={() => navigate("/zatca-sync")}
    >
      <CloudUpload size={16} />
      <span className="zatca-sync-indicator-text">{label}</span>
      <span className="zatca-sync-indicator-meta">
        {online ? <Wifi size={14} /> : <WifiOff size={14} />}
        {globalNeeds > 0
          ? `${globalPending + globalFailed} waiting`
          : todayTotal > 0
            ? `${todaySynced}/${todayTotal} today`
            : "Manual sync"}
      </span>
      <ChevronRight size={16} className="zatca-sync-indicator-chevron" />
    </button>
  );
}
