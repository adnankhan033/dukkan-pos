import { customerService } from "./CustomerService";
import { supplierService } from "./SupplierService";
import { settingsService } from "./SettingsService";
import { buildCompanyProfile } from "../utils/directoryExport/companyProfile";
import { getDirectoryDefinition, DIRECTORY_EXPORT_TYPES } from "../utils/directoryExport/definitions";
import { exportDirectoryExcel } from "../utils/directoryExport/exportDirectoryExcel";
import { exportDirectoryPdf } from "../utils/directoryExport/exportDirectoryPdf";

class DirectoryExportService {
  async getExportContext(type, { search = "" } = {}) {
    const [settings, rows] = await Promise.all([
      settingsService.getAll(),
      type === DIRECTORY_EXPORT_TYPES.SUPPLIERS
        ? supplierService.getAllForExport({ search })
        : customerService.getAllForExport({ search }),
    ]);

    return {
      definition: getDirectoryDefinition(type),
      company: buildCompanyProfile(settings),
      currency: settings.currency || "SAR",
      rows,
    };
  }

  async exportExcel(type, options = {}) {
    const context = await this.getExportContext(type, options);
    return exportDirectoryExcel(context);
  }

  async exportPdf(type, options = {}) {
    const context = await this.getExportContext(type, options);
    return exportDirectoryPdf(context);
  }
}

export const directoryExportService = new DirectoryExportService();
