import { useAuthStore } from "../contexts/store";
import { useSettingsStore } from "../contexts/store";
import { settingsService } from "../services/SettingsService";
import { API_PATH_PREFIX, normalizeApiBaseUrl, isDrupalConfigured, resolveApiBaseUrl, withResolvedApiUrl } from "./apiConfig";
import { fetchAllPages } from "./pagination";

class ApiClient {
  async getSettings() {
    const cached = useSettingsStore.getState().settings;
    if (cached && Object.keys(cached).length > 0) {
      return cached;
    }
    return settingsService.getAll();
  }

  buildUrl(settings, path) {
    const base = resolveApiBaseUrl(settings);
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  async request(path, { method = "GET", body, token, settings: settingsOverride } = {}) {
    const rawSettings = settingsOverride || (await this.getSettings());
    const settings = withResolvedApiUrl(rawSettings);
    if (!isDrupalConfigured(settings)) {
      throw new Error("Drupal API URL is not configured. Set it in Settings → Backend.");
    }

    const authToken = token ?? useAuthStore.getState().token;
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "1",
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(this.buildUrl(settings, path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        `API error ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    return data;
  }

  buildQuery(params = {}) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        qs.set(key, String(value));
      }
    }
    const q = qs.toString();
    return q ? `?${q}` : "";
  }

  async health(settings) {
    return this.request(`${API_PATH_PREFIX}/health`, { settings, token: null });
  }

  async login(username, password, settings) {
    const s = settings || (await this.getSettings());
    const body = {
      username,
      password,
      terminal_code: s.terminal_code || "REG1",
    };
    return this.request(`${API_PATH_PREFIX}/auth/login`, {
      method: "POST",
      body,
      token: null,
      settings: s,
    });
  }

  async getMe() {
    return this.request(`${API_PATH_PREFIX}/auth/me`);
  }

  async getSettingsRemote() {
    return this.request(`${API_PATH_PREFIX}/settings`);
  }

  async updateSettingsRemote(data) {
    return this.request(`${API_PATH_PREFIX}/settings`, { method: "PATCH", body: data });
  }

  // ——— Products ———

  async getProducts(params = {}) {
    return this.request(`${API_PATH_PREFIX}/products${this.buildQuery(params)}`);
  }

  async getInventorySummary(limit = 8) {
    return this.request(
      `${API_PATH_PREFIX}/products/inventory-summary${this.buildQuery({ limit })}`
    );
  }

  async getAllProducts(params = {}) {
    return fetchAllPages(
      (page) => this.getProducts({ ...params, page, limit: params.limit || 200 }),
      { pageSize: params.limit || 200 }
    );
  }

  async getProductCatalog(limit = 500) {
    return this.request(`${API_PATH_PREFIX}/products/catalog?limit=${limit}`);
  }

  async getProductCatalogMeta() {
    return this.request(`${API_PATH_PREFIX}/products/catalog-meta`);
  }

  async getProduct(id) {
    return this.request(`${API_PATH_PREFIX}/products/${id}`);
  }

  async createProduct(data) {
    return this.request(`${API_PATH_PREFIX}/products`, { method: "POST", body: data });
  }

  async updateProduct(id, data) {
    return this.request(`${API_PATH_PREFIX}/products/${id}`, { method: "PATCH", body: data });
  }

  async deleteProduct(id) {
    return this.request(`${API_PATH_PREFIX}/products/${id}`, { method: "DELETE" });
  }

  // ——— Categories ———

  async getCategories(params = {}) {
    return this.request(`${API_PATH_PREFIX}/categories${this.buildQuery({ limit: 500, ...params })}`);
  }

  async getCategory(id) {
    return this.request(`${API_PATH_PREFIX}/categories/${id}`);
  }

  async createCategory(data) {
    return this.request(`${API_PATH_PREFIX}/categories`, { method: "POST", body: data });
  }

  async updateCategory(id, data) {
    return this.request(`${API_PATH_PREFIX}/categories/${id}`, { method: "PATCH", body: data });
  }

  async deleteCategory(id) {
    return this.request(`${API_PATH_PREFIX}/categories/${id}`, { method: "DELETE" });
  }

  // ——— Units ———

  async getUnits(params = {}) {
    return this.request(`${API_PATH_PREFIX}/units${this.buildQuery({ limit: 500, ...params })}`);
  }

  async getUnit(id) {
    return this.request(`${API_PATH_PREFIX}/units/${id}`);
  }

  async createUnit(data) {
    return this.request(`${API_PATH_PREFIX}/units`, { method: "POST", body: data });
  }

  async updateUnit(id, data) {
    return this.request(`${API_PATH_PREFIX}/units/${id}`, { method: "PATCH", body: data });
  }

  async deleteUnit(id) {
    return this.request(`${API_PATH_PREFIX}/units/${id}`, { method: "DELETE" });
  }

  // ——— Users ———

  async getUsers(params = {}) {
    return this.request(`${API_PATH_PREFIX}/users${this.buildQuery(params)}`);
  }

  async getUser(id) {
    return this.request(`${API_PATH_PREFIX}/users/${id}`);
  }

  async createUser(data) {
    return this.request(`${API_PATH_PREFIX}/users`, { method: "POST", body: data });
  }

  async updateUser(id, data) {
    return this.request(`${API_PATH_PREFIX}/users/${id}`, { method: "PATCH", body: data });
  }

  // ——— Sales ———

  async getSales(params = {}) {
    return this.request(`${API_PATH_PREFIX}/sales${this.buildQuery(params)}`);
  }

  async getSale(id) {
    return this.request(`${API_PATH_PREFIX}/sales/${id}`);
  }

  async createSale(data) {
    return this.request(`${API_PATH_PREFIX}/sales`, { method: "POST", body: data });
  }

  async getSalesStats({ from, to } = {}) {
    const stats = await this.request(`${API_PATH_PREFIX}/sales/stats${this.buildQuery({ from, to })}`);
    return {
      orderCount: Number(stats.order_count ?? 0),
      heldCount: Number(stats.held_count ?? 0),
      salesTotal: Number(stats.sales_total ?? 0),
      returnsTotal: Number(stats.returns_total ?? 0),
      netTotal: Number(stats.net_total ?? 0),
    };
  }

  async getSaleByNumber(saleNumber) {
    return this.request(`${API_PATH_PREFIX}/sales/lookup${this.buildQuery({ number: saleNumber })}`);
  }

  async getReturnableItems(saleId) {
    const result = await this.request(`${API_PATH_PREFIX}/sales/${saleId}/returnable-items`);
    return result.items || [];
  }

  async getSaleReturns(saleId) {
    const result = await this.request(`${API_PATH_PREFIX}/sales/${saleId}/returns`);
    return result.items || [];
  }

  async processSaleReturn(saleId, data) {
    return this.request(`${API_PATH_PREFIX}/sales/${saleId}/returns`, { method: "POST", body: data });
  }
}

export const apiClient = new ApiClient();
