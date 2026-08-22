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
        let settings = await settingsService.getAll();

        const { activationService } = await import("../services/ActivationService.js");
        settings = await activationService.ensureSystemActivation(settings);
        settings = await activationService.repairRegistrationIfShopAlreadyInUse(settings);

        if (mounted) {
          setSettings(settings);
          setDbReady(true);
          window.setTimeout(() => {
            zatcaService.startBackgroundSync();
            backupSyncService.startBackgroundSync();
          }, 2500);
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
