import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudUpload, Wifi, WifiOff } from "lucide-react";
import { zatcaService } from "../../services/ZatcaService";
import { useSettingsStore } from "../../contexts/store";
import { resolveActivePhase } from "../../zatca/core/config";
import { ZATCA_PHASES } from "../../zatca/core/constants";
import { getBusinessDateISO } from "../../utils/businessDate";
import { Card } from "../common/Card";
import Button from "../common/Button";
import { formatDateTime } from "../../utils/format";

export default function ZatcaSyncWidget() {
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const activePhase = resolveActivePhase(settings);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (activePhase !== ZATCA_PHASES.PHASE2) return undefined;

    let mounted = true;

    async function load() {
      const businessDate = getBusinessDateISO(settings);
      const [daily, queue] = await Promise.all([
        zatcaService.getDailySyncStats(businessDate),
        zatcaService.getQueueStats(),
      ]);
      if (mounted) {
        setStats({
          ...daily,
          online: queue?.online,
          lastSyncAt: queue?.lastSyncAt,
        });
      }
    }

    load();
    const unsubscribe = zatcaService.subscribeSyncEvents(load);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activePhase, settings]);

  if (activePhase !== ZATCA_PHASES.PHASE2) {
    return null;
  }

  return (
    <Card className="zatca-sync-widget dashboard-glass">
      <div className="card-header">
        <h3 className="card-title">Today&apos;s ZATCA Sync</h3>
        <CloudUpload size={18} />
      </div>

      <div className="zatca-sync-widget-grid">
        <div className="zatca-sync-stat">
          <span>Today</span>
          <strong>{stats?.total ?? 0}</strong>
        </div>
        <div className="zatca-sync-stat">
          <span>Pending</span>
          <strong>{(stats?.pending ?? 0) + (stats?.sending ?? 0)}</strong>
        </div>
        <div className="zatca-sync-stat">
          <span>Synced</span>
          <strong>{stats?.synced ?? 0}</strong>
        </div>
        <div className="zatca-sync-stat">
          <span>Failed</span>
          <strong>{stats?.failed ?? 0}</strong>
        </div>
        <div className="zatca-sync-stat">
          <span>Internet</span>
          <strong>{stats?.online ? "Online" : "Offline"}</strong>
        </div>
      </div>

      <div className="zatca-sync-footer">
        <span>
          Last sync: {stats?.lastSyncAt ? formatDateTime(stats.lastSyncAt) : "Never"}
        </span>
        <span className={`zatca-sync-online ${stats?.online ? "online" : "offline"}`}>
          {stats?.online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {stats?.online ? "Connected" : "Offline mode"}
        </span>
      </div>

      <Button
        variant="secondary"
        style={{ marginTop: "0.75rem", width: "100%" }}
        onClick={() => navigate("/zatca-sync")}
      >
        Open Daily ZATCA Sync
      </Button>
    </Card>
  );
}
