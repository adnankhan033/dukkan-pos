import { useSettingsStore } from "../contexts/store";
import { ZatcaIntegrationService } from "../zatca";

function getSettingsSnapshot() {
  return useSettingsStore.getState().settings;
}

/** Singleton facade — inject settings via store. */
export const zatcaService = new ZatcaIntegrationService(getSettingsSnapshot);

export { ZatcaIntegrationService };
