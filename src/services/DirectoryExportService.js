import { customerService } from "./CustomerService";
import { supplierService } from "./SupplierService";
import { settingsService } from "./SettingsService";
import { paymentMethodService } from "./PaymentMethodService";
import { buildCompanyProfile } from "../utils/directoryExport/companyProfile";
import {
  getDirectoryDefinition,
  getCustomerExportDefinition,
  DIRECTORY_EXPORT_TYPES,
  CUSTOMER_EXPORT_SCOPES,
} from "../utils/directoryExport/definitions";
import { exportDirectoryExcel } from "../utils/directoryExport/exportDirectoryExcel";
import { exportDirectoryPdf } from "../utils/directoryExport/exportDirectoryPdf";
import { exportCustomersPdf } from "../utils/customersExport/exportCustomersPdf";
import { exportCustomerStatementPdf } from "../utils/customersExport/exportCustomerStatementPdf";

class DirectoryExportService {
  async getExportContext(type, { filters = {}, settings = {}, scope = null, customerId = null, filterSummary = "" } = {}) {
    const resolvedSettings = Object.keys(settings || {}).length
      ? settings
      : await settingsService.getAll();

    const definition =
      type === DIRECTORY_EXPORT_TYPES.CUSTOMERS
        ? getCustomerExportDefinition(scope || CUSTOMER_EXPORT_SCOPES.ACCOUNTS)
        : getDirectoryDefinition(type);

    const search = filters.search || "";

    let rows =
      type === DIRECTORY_EXPORT_TYPES.SUPPLIERS
        ? await supplierService.getAllForExport({ search })
        : await customerService.getAllForExport({
            filters,
            settings: resolvedSettings,
            includeBalances: Boolean(definition.includesBalances),
            balanceOnly: Boolean(definition.balanceOnly),
          });

    if (type === DIRECTORY_EXPORT_TYPES.CUSTOMERS && customerId) {
      rows = rows.filter((row) => Number(row.id) === Number(customerId));
    }

    return {
      definition,
      company: buildCompanyProfile(resolvedSettings),
      settings: resolvedSettings,
      currency: resolvedSettings.currency || "SAR",
      rows,
      filterSummary,
    };
  }

  async exportExcel(type, options = {}) {
    const context = await this.getExportContext(type, options);
    return exportDirectoryExcel(context);
  }

  async exportPdf(type, options = {}) {
    const scope = options.scope || CUSTOMER_EXPORT_SCOPES.ACCOUNTS;

    if (type === DIRECTORY_EXPORT_TYPES.CUSTOMERS && scope === CUSTOMER_EXPORT_SCOPES.FULL_STATEMENT) {
      if (!options.customerId) {
        throw new Error("Select a customer to generate the full account statement.");
      }

      const resolvedSettings = Object.keys(options.settings || {}).length
        ? options.settings
        : await settingsService.getAll();

      const [statement, paymentMethods] = await Promise.all([
        customerService.getStatementForExport(options.customerId, {
          filters: options.filters || {},
          settings: resolvedSettings,
        }),
        paymentMethodService.getAll({ includeInactive: true }),
      ]);

      return exportCustomerStatementPdf({
        statement,
        settings: resolvedSettings,
        currency: resolvedSettings.currency || "SAR",
        paymentMethods,
        includeFullDetail: options.includeFullDetail !== false,
      });
    }

    const context = await this.getExportContext(type, options);

    if (type === DIRECTORY_EXPORT_TYPES.CUSTOMERS) {
      return exportCustomersPdf({
        rows: context.rows,
        definition: context.definition,
        settings: context.settings,
        currency: context.currency,
        search: options.filters?.search || "",
        filterSummary: options.filterSummary || context.filterSummary || "",
        totalMatched: context.rows.length,
      });
    }

    return exportDirectoryPdf(context);
  }
}

export const directoryExportService = new DirectoryExportService();
