import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODULE_LIFECYCLE, MODULE_STATUS } from "./catalog.js";
import {
  getDirectDependents,
  getTransitiveDependents,
  validateDisable,
  validateEnable,
  validateInstall,
  validateUninstall,
  ModuleLifecycleError,
} from "./dependencies.js";

const catalog = [
  { id: "sales", name: "Sales", lifecycle: MODULE_LIFECYCLE.BUNDLED, dependencies: [], uninstallable: false, disableable: true },
  { id: "inventory", name: "Inventory", lifecycle: MODULE_LIFECYCLE.BUNDLED, dependencies: [], uninstallable: false, disableable: true },
  { id: "purchasing", name: "Purchasing", lifecycle: MODULE_LIFECYCLE.BUNDLED, dependencies: ["inventory"], uninstallable: false, disableable: true },
  {
    id: "accounting",
    name: "Accounting",
    lifecycle: MODULE_LIFECYCLE.OPTIONAL,
    dependencies: ["sales", "purchasing"],
    uninstallable: false,
    disableable: true,
    hasFinancialData: true,
  },
  {
    id: "expenses",
    name: "Expenses",
    lifecycle: MODULE_LIFECYCLE.OPTIONAL,
    dependencies: ["accounting"],
    uninstallable: false,
    disableable: true,
    hasFinancialData: true,
  },
  {
    id: "wholesale",
    name: "Wholesale",
    lifecycle: MODULE_LIFECYCLE.OPTIONAL,
    dependencies: ["sales", "inventory"],
    uninstallable: true,
    disableable: true,
  },
];

function installed(enabled = true) {
  return { status: MODULE_STATUS.INSTALLED, enabled };
}

describe("module dependency graph", () => {
  it("lists modules that depend on accounting", () => {
    assert.deepEqual(getDirectDependents(catalog, "accounting"), ["expenses"]);
  });

  it("walks transitive dependents", () => {
    const states = {};
    void states;
    assert.deepEqual(getTransitiveDependents(catalog, "sales").sort(), ["accounting", "expenses", "wholesale"]);
  });
});

describe("install validation", () => {
  it("blocks install when a dependency is missing", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      purchasing: installed(),
    };
    assert.throws(
      () => validateInstall(catalog, states, "expenses"),
      (err) => err instanceof ModuleLifecycleError && err.code === "MISSING_DEPENDENCIES"
    );
  });

  it("allows install when dependencies are installed", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      purchasing: installed(),
    };
    const def = validateInstall(catalog, states, "accounting");
    assert.equal(def.id, "accounting");
  });

  it("blocks installing a module twice", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      purchasing: installed(),
      accounting: installed(),
    };
    assert.throws(() => validateInstall(catalog, states, "accounting"), /already installed/);
  });
});

describe("enable / disable validation", () => {
  it("blocks enabling when a dependency is disabled", () => {
    const states = {
      sales: installed(false),
      inventory: installed(),
      purchasing: installed(),
      accounting: installed(false),
    };
    assert.throws(
      () => validateEnable(catalog, states, "accounting"),
      (err) => err.code === "DEPENDENCY_DISABLED"
    );
  });

  it("blocks disabling a module that others still use", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      purchasing: installed(),
      accounting: installed(),
      expenses: installed(),
    };
    assert.throws(
      () => validateDisable(catalog, states, "accounting"),
      (err) => err.code === "HAS_ENABLED_DEPENDENTS" && /Expenses/.test(err.message)
    );
  });

  it("allows disabling after dependents are disabled", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      purchasing: installed(),
      accounting: installed(),
      expenses: installed(false),
    };
    const def = validateDisable(catalog, states, "accounting");
    assert.equal(def.id, "accounting");
  });
});

describe("uninstall validation", () => {
  it("refuses to uninstall accounting because of financial data", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      purchasing: installed(),
      accounting: installed(false),
      expenses: { status: MODULE_STATUS.AVAILABLE, enabled: false },
    };
    assert.throws(
      () => validateUninstall(catalog, states, "accounting"),
      (err) => err.code === "FINANCIAL_DATA"
    );
  });

  it("blocks uninstall when another installed module depends on it", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      wholesale: installed(false),
    };
    assert.throws(
      () => validateUninstall(catalog, states, "sales"),
      (err) => err.code === "NOT_UNINSTALLABLE"
    );
  });

  it("allows uninstalling wholesale when nothing depends on it", () => {
    const states = {
      sales: installed(),
      inventory: installed(),
      wholesale: installed(false),
    };
    const def = validateUninstall(catalog, states, "wholesale");
    assert.equal(def.id, "wholesale");
  });
});
