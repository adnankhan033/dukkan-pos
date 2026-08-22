import { MODULE_LIFECYCLE, MODULE_STATUS } from "./catalog.js";

export class ModuleLifecycleError extends Error {
  constructor(message, code = "MODULE_ERROR") {
    super(message);
    this.name = "ModuleLifecycleError";
    this.code = code;
  }
}

export function getDirectDependents(catalog, moduleId) {
  return catalog.filter((mod) => (mod.dependencies || []).includes(moduleId)).map((mod) => mod.id);
}

export function getTransitiveDependents(catalog, moduleId) {
  const result = [];
  const seen = new Set();
  const queue = [...getDirectDependents(catalog, moduleId)];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    queue.push(...getDirectDependents(catalog, id));
  }
  return result;
}

function byId(catalog) {
  return new Map(catalog.map((mod) => [mod.id, mod]));
}

function requireModule(catalog, moduleId) {
  const def = byId(catalog).get(moduleId);
  if (!def) {
    throw new ModuleLifecycleError(`Unknown module "${moduleId}".`, "UNKNOWN_MODULE");
  }
  return def;
}

function isInstalled(state) {
  return state?.status === MODULE_STATUS.INSTALLED;
}

function isEnabled(state) {
  return isInstalled(state) && Boolean(state?.enabled);
}

export function validateInstall(catalog, states, moduleId) {
  const def = requireModule(catalog, moduleId);
  if (def.lifecycle === MODULE_LIFECYCLE.CORE) {
    throw new ModuleLifecycleError(`${def.name} is part of the core system and is always installed.`, "CORE_MODULE");
  }
  if (isInstalled(states[moduleId])) {
    throw new ModuleLifecycleError(`${def.name} is already installed.`, "ALREADY_INSTALLED");
  }

  const missing = (def.dependencies || []).filter((depId) => !isInstalled(states[depId]));
  if (missing.length) {
    const names = missing.map((id) => byId(catalog).get(id)?.name || id);
    throw new ModuleLifecycleError(
      `Cannot install ${def.name} because these dependencies are not installed: ${names.join(", ")}.`,
      "MISSING_DEPENDENCIES"
    );
  }

  return def;
}

export function validateEnable(catalog, states, moduleId) {
  const def = requireModule(catalog, moduleId);
  if (def.disableable === false) {
    throw new ModuleLifecycleError(`${def.name} cannot be disabled or re-enabled.`, "NOT_TOGGLEABLE");
  }
  if (!isInstalled(states[moduleId])) {
    throw new ModuleLifecycleError(`Install ${def.name} before enabling it.`, "NOT_INSTALLED");
  }
  if (isEnabled(states[moduleId])) {
    throw new ModuleLifecycleError(`${def.name} is already enabled.`, "ALREADY_ENABLED");
  }

  const missing = (def.dependencies || []).filter((depId) => {
    const dep = byId(catalog).get(depId);
    if (dep?.lifecycle === MODULE_LIFECYCLE.CORE) return false;
    return !isEnabled(states[depId]);
  });
  if (missing.length) {
    const names = missing.map((id) => byId(catalog).get(id)?.name || id);
    throw new ModuleLifecycleError(
      `Cannot enable ${def.name} because these modules must be enabled first: ${names.join(", ")}.`,
      "DEPENDENCY_DISABLED"
    );
  }
  return def;
}

export function validateDisable(catalog, states, moduleId) {
  const def = requireModule(catalog, moduleId);
  if (def.disableable === false || def.lifecycle === MODULE_LIFECYCLE.CORE) {
    throw new ModuleLifecycleError(`${def.name} cannot be disabled.`, "NOT_DISABLEABLE");
  }
  if (!isInstalled(states[moduleId])) {
    throw new ModuleLifecycleError(`${def.name} is not installed.`, "NOT_INSTALLED");
  }
  if (!isEnabled(states[moduleId])) {
    throw new ModuleLifecycleError(`${def.name} is already disabled.`, "ALREADY_DISABLED");
  }

  const blocking = getDirectDependents(catalog, moduleId).filter((depId) => isEnabled(states[depId]));
  if (blocking.length) {
    const names = blocking.map((id) => byId(catalog).get(id)?.name || id);
    throw new ModuleLifecycleError(
      `Cannot disable ${def.name}. Disable these dependent modules first: ${names.join(", ")}.`,
      "HAS_ENABLED_DEPENDENTS"
    );
  }
  return def;
}

export function validateUninstall(catalog, states, moduleId) {
  const def = requireModule(catalog, moduleId);
  if (def.lifecycle === MODULE_LIFECYCLE.CORE || def.lifecycle === MODULE_LIFECYCLE.BUNDLED) {
    throw new ModuleLifecycleError(
      `Cannot uninstall ${def.name}. It is required by the POS. Disable it instead.`,
      "NOT_UNINSTALLABLE"
    );
  }
  if (def.uninstallable === false || def.hasFinancialData) {
    throw new ModuleLifecycleError(
      `Cannot uninstall ${def.name}. It contains historical financial data. Archive / Disable it instead.`,
      "FINANCIAL_DATA"
    );
  }
  if (!isInstalled(states[moduleId]) && states[moduleId]?.status !== MODULE_STATUS.ARCHIVED) {
    throw new ModuleLifecycleError(`${def.name} is not installed.`, "NOT_INSTALLED");
  }

  const blocking = getDirectDependents(catalog, moduleId).filter((depId) => isInstalled(states[depId]));
  if (blocking.length) {
    const names = blocking.map((id) => byId(catalog).get(id)?.name || id);
    throw new ModuleLifecycleError(
      `Cannot uninstall ${def.name}. The following modules depend on it:\n\n${names.join("\n")}\n\nDisable dependent modules first.`,
      "HAS_INSTALLED_DEPENDENTS"
    );
  }
  return def;
}
