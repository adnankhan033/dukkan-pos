import { ZATCA_PHASES, ZATCA_PHASE_LABELS } from "../core/constants";
import { BaseZatcaModule } from "./BaseZatcaModule";

export class DisabledZatcaModule extends BaseZatcaModule {
  constructor() {
    super(ZATCA_PHASES.DISABLED);
  }

  getStatus() {
    return {
      phase: ZATCA_PHASES.DISABLED,
      enabled: false,
      label: ZATCA_PHASE_LABELS[ZATCA_PHASES.DISABLED],
      ready: true,
      messages: ["ZATCA integration is disabled."],
    };
  }

  validateConfiguration() {
    return { valid: true, errors: [], warnings: [] };
  }
}

export const disabledZatcaModule = new DisabledZatcaModule();
