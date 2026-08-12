import { settingsService } from "./SettingsService";
import { backupService } from "./BackupService";
import { BACKUP_SETTING_KEYS, isDailyBackupDue } from "../utils/backupSettings";
import { getDateTimePartsInTimezone, resolveBusinessTimezone, toTimezoneDateISO } from "../utils/timezones";

const CHECK_INTERVAL_MS = 60 * 1000;

class BackupSyncService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.syncInProgress = false;
  }

  startBackgroundSync() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.tryDailyBackup().catch((err) => {
        console.warn("Scheduled backup check failed:", err);
      });
    }, CHECK_INTERVAL_MS);

    this.tryDailyBackup().catch((err) => {
      console.warn("Initial backup check failed:", err);
    });
  }

  stopBackgroundSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  restartBackgroundSync() {
    this.stopBackgroundSync();
    this.startBackgroundSync();
  }

  async tryDailyBackup() {
    if (this.syncInProgress) return;

    const settings = await settingsService.getAll();
    if (!isDailyBackupDue(settings)) return;

    this.syncInProgress = true;
    try {
      const result = await backupService.runDailyBackup();
      const tz = resolveBusinessTimezone(settings);
      const parts = getDateTimePartsInTimezone(new Date(), tz);
      const todayKey = toTimezoneDateISO(parts);
      await settingsService.set(BACKUP_SETTING_KEYS.LAST_AUTO_DATE, todayKey);
      if (result.localPath) {
        console.info("Daily local backup saved:", result.localPath);
      }
      if (result.email) {
        console.info("Daily Gmail backup sent:", result.email.recipient);
      }
    } catch (err) {
      console.warn("Daily backup failed:", err);
    } finally {
      this.syncInProgress = false;
    }
  }
}

export const backupSyncService = new BackupSyncService();
