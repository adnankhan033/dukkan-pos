import { ZATCA_PHASES } from "./core/constants";
import { resolveActivePhase, parseZatcaConfig } from "./core/config";
import { disabledZatcaModule } from "./modules/DisabledModule";
import { phase1ZatcaModule } from "./modules/Phase1Module";
import { phase2ZatcaModule } from "./modules/Phase2Module";

const MODULE_REGISTRY = {
  [ZATCA_PHASES.DISABLED]: disabledZatcaModule,
  [ZATCA_PHASES.PHASE1]: phase1ZatcaModule,
  [ZATCA_PHASES.PHASE2]: phase2ZatcaModule,
};

/** Factory — resolves the active ZATCA module from settings (dependency injection point). */
export function createZatcaModule(settings) {
  const phase = resolveActivePhase(settings);
  return MODULE_REGISTRY[phase] || disabledZatcaModule;
}

export function getZatcaModuleForPhase(phase) {
  return MODULE_REGISTRY[phase] || disabledZatcaModule;
}

export { parseZatcaConfig, resolveActivePhase };
