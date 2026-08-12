import { useEffect } from "react";
import { initializeDatabase } from "../database/connection";
import { settingsService } from "../services/SettingsService";
import { zatcaService } from "../services/ZatcaService";
import { backupSyncService } from "../services/BackupSyncService";
import { useAppStore, useSettingsStore } from "../contexts/store";

export function useDatabaseInit() {
  const { dbReady, dbError, setDbReady, setDbError } = useAppStore();
  const setSettings = useSettingsStore((s) => s.setSettings);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeDatabase();
        const settings = await settingsService.getAll();
        if (mounted) {
          setSettings(settings);
          setDbReady(true);
          zatcaService.startBackgroundSync();
          backupSyncService.startBackgroundSync();
        }
      } catch (err) {
        if (mounted) {
          const message =
            err?.message ||
            (typeof err === "string" ? err : null) ||
            "Failed to initialize database";
          console.error("Database initialization failed:", err);
          setDbError(message);
        }
      }
    }

    if (!dbReady && !dbError) init();
    return () => {
      mounted = false;
    };
  }, [dbReady, dbError, setDbReady, setDbError, setSettings]);

  return { dbReady, dbError };
}
