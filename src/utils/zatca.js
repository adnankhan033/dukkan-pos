/**
 * @deprecated Import from `../zatca` or `../services/ZatcaService` instead.
 * Kept for backward compatibility.
 */
export {
  buildZatcaQrPayload,
  formatZatcaTimestamp,
} from "../zatca/phase1/qrGenerator";

import { zatcaService } from "../services/ZatcaService";

export function canGenerateZatcaQr(settings) {
  return zatcaService.canGenerateReceiptQr({ sale: { total: 0, vat: 0 }, settings });
}

export async function generateZatcaQrDataUrl({ sale, settings }) {
  return zatcaService.generateReceiptQr({ sale, settings });
}
