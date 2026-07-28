import { useEffect } from "react";
import { initializeDatabase, ensureReturnSchema } from "../database/connection";
import { settingsService } from "../services/SettingsService";
import { useAppStore, useSettingsStore } from "../contexts/store";

export function useDatabaseInit() {
  const { dbReady, dbError, setDbReady, setDbError } = useAppStore();
  const setSettings = useSettingsStore((s) => s.setSettings);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeDatabase();
        await ensureReturnSchema();
        const settings = await settingsService.getAll();
        if (mounted) {
          setSettings(settings);
          setDbReady(true);
        }
      } catch (err) {
        if (mounted) {
          setDbError(err.message || "Failed to initialize database");
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
