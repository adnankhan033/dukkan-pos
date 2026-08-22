import { execute, query, queryOne } from "../database/connection";
import { MODULE_SCHEMA_STATEMENTS } from "../database/moduleSchema";
import {
  MODULE_CATALOG,
  MODULE_LIFECYCLE,
  MODULE_STATUS,
  getCatalogModule,
  getChildModules,
  getManagerModules,
} from "../modules/catalog";
import {
  ModuleLifecycleError,
  validateDisable,
  validateEnable,
  validateInstall,
  validateUninstall,
} from "../modules/dependencies";
import { moduleConfiguredKey, moduleInstalledKey, moduleSettingKey } from "../modules/keys";
import { isModuleEnabled } from "../utils/modules";
import { settingsService } from "./SettingsService";
import { ACCOUNTING_SETTING_KEYS } from "../utils/accounting";

function nowIso() {
  return new Date().toISOString();
}

function rowToState(row) {
  if (!row) return { status: MODULE_STATUS.AVAILABLE, enabled: false, configured: false };
  return {
    status: row.status || MODULE_STATUS.AVAILABLE,
    enabled: Number(row.enabled) === 1,
    configured: Number(row.configured) === 1,
    version: row.version,
    installedAt: row.installed_at,
    enabledAt: row.enabled_at,
    disabledAt: row.disabled_at,
    migrationStatus: row.migration_status,
    errorMessage: row.error_message,
  };
}

class ModuleService {
  async ensureSchema() {
    for (const statement of MODULE_SCHEMA_STATEMENTS) {
      await execute(statement);
    }
  }

  async ensureReady() {
    await this.ensureSchema();
    const count = await queryOne("SELECT COUNT(*) AS c FROM app_modules");
    if (!Number(count?.c || 0)) {
      await this.bootstrapFromSettings();
      return;
    }
    await this.ensureMissingCatalogRows();
  }

  async ensureMissingCatalogRows() {
    const settings = await settingsService.getAll();
    for (const def of MODULE_CATALOG) {
      const existing = await queryOne("SELECT id FROM app_modules WHERE id = $1", [def.id]);
      if (existing) continue;
      const bundled = def.lifecycle !== MODULE_LIFECYCLE.OPTIONAL;
      const enabledSetting = settings[moduleSettingKey(def.id)];
      const enabled =
        bundled && (enabledSetting === undefined || enabledSetting === "" || enabledSetting === "1" || enabledSetting === "true");
      await this.upsertRow(def, {
        status: bundled ? MODULE_STATUS.INSTALLED : MODULE_STATUS.AVAILABLE,
        enabled,
        configured: bundled,
        migrationStatus: bundled ? "applied" : "pending",
      });
      await this.syncSettingFlags(def.id, {
        status: bundled ? MODULE_STATUS.INSTALLED : MODULE_STATUS.AVAILABLE,
        enabled,
        configured: bundled,
      });
    }
  }

  async bootstrapFromSettings() {
    await this.ensureSchema();
    const settings = await settingsService.getAll();
    const booksOn = settings[ACCOUNTING_SETTING_KEYS.ENABLED] === "1";

    for (const def of MODULE_CATALOG) {
      const enabledSetting = settings[moduleSettingKey(def.id)];
      const legacyEnabled = enabledSetting === undefined || enabledSetting === "" || enabledSetting === "1" || enabledSetting === "true";

      let status = MODULE_STATUS.AVAILABLE;
      let enabled = false;
      let configured = false;

      if (def.lifecycle === MODULE_LIFECYCLE.CORE || def.lifecycle === MODULE_LIFECYCLE.BUNDLED) {
        status = MODULE_STATUS.INSTALLED;
        enabled = def.disableable === false ? true : legacyEnabled;
        configured = true;
      } else if (def.id === "accounting") {
        if (booksOn) {
          status = MODULE_STATUS.INSTALLED;
          enabled = true;
          configured = true;
        } else if (legacyEnabled && enabledSetting !== undefined) {
          status = MODULE_STATUS.INSTALLED;
          enabled = true;
          configured = false;
        }
      } else if (["expenses", "partners", "cash_bank"].includes(def.id)) {
        const accountingLegacy = settings[moduleSettingKey("accounting")];
        const accountingOn =
          booksOn || accountingLegacy === "1" || accountingLegacy === "true";
        if (accountingOn) {
          status = MODULE_STATUS.INSTALLED;
          enabled = true;
          configured = booksOn;
        }
      }

      await this.upsertRow(def, {
        status,
        enabled,
        configured,
        migrationStatus: status === MODULE_STATUS.INSTALLED ? "applied" : "pending",
      });
      await this.syncSettingFlags(def.id, { status, enabled, configured });
    }
  }

  async list() {
    await this.ensureReady();
    const settings = await settingsService.getAll();
    const rows = await query("SELECT * FROM app_modules");
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    const states = await this.stateMap(settings);

    return getManagerModules().map((def) => this.hydrate(def, byId[def.id], states));
  }

  async get(moduleId) {
    const all = await this.list();
    const found = all.find((mod) => mod.id === moduleId);
    if (!found) {
      throw new ModuleLifecycleError(`Unknown module "${moduleId}".`, "UNKNOWN_MODULE");
    }
    return found;
  }

  async install(moduleId) {
    await this.ensureReady();
    const catalog = MODULE_CATALOG;
    const states = await this.stateMap();
    const def = validateInstall(catalog, states, moduleId);
    const children = getChildModules(moduleId)
      .map((id) => getCatalogModule(id))
      .filter(Boolean);

    try {
      await this.runInstallHandler(def);
      for (const child of children) {
        if (!this.isInstalledState(states[child.id])) {
          await this.runInstallHandler(child);
        }
      }

      const stamp = nowIso();
      await this.upsertRow(def, {
        status: MODULE_STATUS.INSTALLED,
        enabled: true,
        configured: def.id !== "accounting",
        migrationStatus: "applied",
        installedAt: stamp,
        enabledAt: stamp,
        errorMessage: "",
      });
      await this.syncSettingFlags(def.id, {
        status: MODULE_STATUS.INSTALLED,
        enabled: true,
        configured: def.id !== "accounting",
      });

      for (const child of children) {
        await this.upsertRow(child, {
          status: MODULE_STATUS.INSTALLED,
          enabled: true,
          configured: def.id !== "accounting",
          migrationStatus: "applied",
          installedAt: stamp,
          enabledAt: stamp,
          errorMessage: "",
        });
        await this.syncSettingFlags(child.id, {
          status: MODULE_STATUS.INSTALLED,
          enabled: true,
          configured: def.id !== "accounting",
        });
      }

      return this.get(moduleId);
    } catch (err) {
      await this.upsertRow(def, {
        status: MODULE_STATUS.AVAILABLE,
        enabled: false,
        configured: false,
        migrationStatus: "failed",
        errorMessage: err.message || String(err),
      });
      await this.syncSettingFlags(def.id, {
        status: MODULE_STATUS.AVAILABLE,
        enabled: false,
        configured: false,
      });
      throw new ModuleLifecycleError(
        err.message || `Could not install ${def.name}. The installation was rolled back.`,
        err.code || "INSTALL_FAILED"
      );
    }
  }

  async enable(moduleId) {
    await this.ensureReady();
    const states = await this.stateMap();
    const def = validateEnable(MODULE_CATALOG, states, moduleId);
    const stamp = nowIso();
    await this.upsertRow(def, {
      ...states[moduleId],
      status: MODULE_STATUS.INSTALLED,
      enabled: true,
      enabledAt: stamp,
      disabledAt: null,
      errorMessage: "",
    });
    await this.syncSettingFlags(def.id, {
      status: MODULE_STATUS.INSTALLED,
      enabled: true,
      configured: Boolean(states[moduleId]?.configured),
    });

    if (def.id === "accounting" && states[moduleId]?.configured) {
      await settingsService.set(ACCOUNTING_SETTING_KEYS.ENABLED, "1");
    }

    return this.get(moduleId);
  }

  async disable(moduleId) {
    await this.ensureReady();
    const states = await this.stateMap();
    const def = validateDisable(MODULE_CATALOG, states, moduleId);
    const stamp = nowIso();
    await this.upsertRow(def, {
      ...states[moduleId],
      status: MODULE_STATUS.INSTALLED,
      enabled: false,
      disabledAt: stamp,
    });
    await this.syncSettingFlags(def.id, {
      status: MODULE_STATUS.INSTALLED,
      enabled: false,
      configured: Boolean(states[moduleId]?.configured),
    });

    if (def.id === "accounting") {
      await settingsService.set(ACCOUNTING_SETTING_KEYS.ENABLED, "0");
    }

    return this.get(moduleId);
  }

  async getUninstallPreview(moduleId) {
    await this.ensureReady();
    const def = getCatalogModule(moduleId);
    if (!def) {
      throw new ModuleLifecycleError(`Unknown module "${moduleId}".`, "UNKNOWN_MODULE");
    }
    const states = await this.stateMap();
    const dependents = MODULE_CATALOG.filter(
      (mod) => (mod.dependencies || []).includes(moduleId) && this.isInstalledState(states[mod.id])
    ).map((mod) => ({ id: mod.id, name: mod.name, version: mod.version }));

    const tables = [];
    for (const table of def.dataTables || []) {
      try {
        const row = await queryOne(`SELECT COUNT(*) AS c FROM ${table}`);
        tables.push({ table, count: Number(row?.c || 0) });
      } catch {
        tables.push({ table, count: 0 });
      }
    }

    const totalRecords = tables.reduce((sum, item) => sum + item.count, 0);
    let blockedReason = null;
    try {
      validateUninstall(MODULE_CATALOG, states, moduleId);
    } catch (err) {
      blockedReason = err.message;
    }

    return {
      id: def.id,
      name: def.name,
      version: def.version,
      dependencies: (def.dependencies || []).map((id) => getCatalogModule(id)?.name || id),
      dependents,
      tables,
      totalRecords,
      hasFinancialData: Boolean(def.hasFinancialData),
      uninstallable: def.uninstallable !== false && !def.hasFinancialData && !blockedReason,
      blockedReason,
      preferArchive: Boolean(def.hasFinancialData) || def.uninstallable === false,
    };
  }

  async uninstall(moduleId) {
    await this.ensureReady();
    const states = await this.stateMap();
    const def = validateUninstall(MODULE_CATALOG, states, moduleId);
    const preview = await this.getUninstallPreview(moduleId);
    if (!preview.uninstallable) {
      throw new ModuleLifecycleError(preview.blockedReason || `Cannot uninstall ${def.name}.`, "NOT_UNINSTALLABLE");
    }

    await this.upsertRow(def, {
      status: MODULE_STATUS.ARCHIVED,
      enabled: false,
      configured: Boolean(states[moduleId]?.configured),
      migrationStatus: "applied",
      disabledAt: nowIso(),
      errorMessage: "",
    });
    await this.syncSettingFlags(def.id, {
      status: MODULE_STATUS.ARCHIVED,
      enabled: false,
      configured: Boolean(states[moduleId]?.configured),
    });

    return this.get(moduleId);
  }

  async markConfigured(moduleId, configured = true) {
    await this.ensureReady();
    const def = getCatalogModule(moduleId);
    if (!def) return null;
    const states = await this.stateMap();
    const current = states[moduleId] || { status: MODULE_STATUS.INSTALLED, enabled: true };
    await this.upsertRow(def, {
      ...current,
      status: MODULE_STATUS.INSTALLED,
      enabled: current.enabled !== false,
      configured,
    });
    await this.syncSettingFlags(def.id, {
      status: MODULE_STATUS.INSTALLED,
      enabled: current.enabled !== false,
      configured,
    });
    for (const childId of getChildModules(moduleId)) {
      const child = getCatalogModule(childId);
      if (!child) continue;
      const childState = states[childId] || { status: MODULE_STATUS.INSTALLED, enabled: true };
      await this.upsertRow(child, { ...childState, status: MODULE_STATUS.INSTALLED, configured });
      await this.syncSettingFlags(childId, {
        status: MODULE_STATUS.INSTALLED,
        enabled: childState.enabled !== false,
        configured,
      });
    }
    return this.get(moduleId);
  }

  async isEnabled(moduleId) {
    const settings = await settingsService.getAll();
    return isModuleEnabled(settings, moduleId);
  }

  hydrate(def, row, states) {
    const state = rowToState(row);
    const dependents = MODULE_CATALOG.filter((mod) => (mod.dependencies || []).includes(def.id));
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      version: def.version,
      category: def.category,
      lifecycle: def.lifecycle,
      dependencies: (def.dependencies || []).map((id) => ({
        id,
        name: getCatalogModule(id)?.name || id,
        installed: this.isInstalledState(states[id]),
        enabled: Boolean(states[id]?.enabled) && this.isInstalledState(states[id]),
      })),
      dependents: dependents.map((mod) => ({ id: mod.id, name: mod.name })),
      status: state.status,
      enabled: state.enabled,
      configured: state.configured,
      installed: this.isInstalledState(state),
      uninstallable: def.uninstallable !== false && !def.hasFinancialData,
      disableable: def.disableable !== false,
      hasFinancialData: Boolean(def.hasFinancialData),
      settingsTab: def.settingsTab || null,
      migrationStatus: state.migrationStatus || (this.isInstalledState(state) ? "applied" : "pending"),
      errorMessage: state.errorMessage || "",
      installedAt: state.installedAt,
      configureAfterInstall: def.id === "accounting" && this.isInstalledState(state) && !state.configured,
    };
  }

  isInstalledState(state) {
    return state?.status === MODULE_STATUS.INSTALLED;
  }

  async stateMap(settingsOverride) {
    const settings = settingsOverride || (await settingsService.getAll());
    const rows = await query("SELECT * FROM app_modules");
    const states = Object.fromEntries(rows.map((row) => [row.id, rowToState(row)]));
    for (const def of MODULE_CATALOG) {
      if (!states[def.id]) {
        states[def.id] = {
          status: def.lifecycle === MODULE_LIFECYCLE.OPTIONAL ? MODULE_STATUS.AVAILABLE : MODULE_STATUS.INSTALLED,
          enabled: false,
          configured: def.lifecycle !== MODULE_LIFECYCLE.OPTIONAL,
        };
      }
      states[def.id] = {
        ...states[def.id],
        enabled: isModuleEnabled(settings, def.id),
      };
    }
    return states;
  }

  async upsertRow(def, state) {
    await execute(
      `INSERT INTO app_modules (
         id, version, status, enabled, configured, installed_at, enabled_at, disabled_at,
         migration_status, error_message, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         version = excluded.version,
         status = excluded.status,
         enabled = excluded.enabled,
         configured = excluded.configured,
         installed_at = COALESCE(excluded.installed_at, app_modules.installed_at),
         enabled_at = excluded.enabled_at,
         disabled_at = excluded.disabled_at,
         migration_status = excluded.migration_status,
         error_message = excluded.error_message,
         updated_at = datetime('now')`,
      [
        def.id,
        def.version,
        state.status || MODULE_STATUS.AVAILABLE,
        state.enabled ? 1 : 0,
        state.configured ? 1 : 0,
        state.installedAt || null,
        state.enabledAt || null,
        state.disabledAt || null,
        state.migrationStatus || "pending",
        state.errorMessage || "",
      ]
    );
  }

  async syncSettingFlags(moduleId, state) {
    const installed = state.status === MODULE_STATUS.INSTALLED;
    await settingsService.updateMany({
      [moduleSettingKey(moduleId)]: state.enabled && installed ? "1" : "0",
      [moduleInstalledKey(moduleId)]: installed ? "1" : "0",
      [moduleConfiguredKey(moduleId)]: state.configured ? "1" : "0",
    });
  }

  async runInstallHandler(def) {
    if (def.installHandler === "accounting") {
      const { accountingService } = await import("./AccountingService.js");
      await accountingService.ensureSchema();
      await accountingService.seedChartOfAccounts();
      return;
    }
    if (def.installHandler === "wholesale") {
      const { WHOLESALE_SCHEMA_STATEMENTS } = await import("../database/wholesaleSchema.js");
      for (const statement of WHOLESALE_SCHEMA_STATEMENTS) {
        await execute(statement);
      }
    }
  }
}

export const moduleService = new ModuleService();
export { ModuleLifecycleError };
