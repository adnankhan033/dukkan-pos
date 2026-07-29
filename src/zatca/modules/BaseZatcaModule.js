import { ZATCA_PHASES } from "../core/constants";

/**
 * Common ZATCA service contract.
 * All phase modules implement this interface so the POS stays phase-agnostic.
 */
export class BaseZatcaModule {
  constructor(phase) {
    this.phase = phase;
  }

  getPhase() {
    return this.phase;
  }

  isEnabled() {
    return this.phase !== ZATCA_PHASES.DISABLED;
  }

  validateConfiguration(_config) {
    return { valid: true, errors: [], warnings: [] };
  }

  getStatus(_config) {
    return {
      phase: this.phase,
      enabled: this.isEnabled(),
      label: this.phase,
      ready: false,
      messages: [],
    };
  }

  canGenerateReceiptQr(_context) {
    return false;
  }

  async generateReceiptQr(_context) {
    return null;
  }

  async processSale(_context) {
    return { success: true, phase: this.phase, skipped: true };
  }
}
