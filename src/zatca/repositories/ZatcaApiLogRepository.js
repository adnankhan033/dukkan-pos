import { insert, query, execute } from "../../database/connection";

class ZatcaApiLogRepository {
  async log({
    endpoint,
    method,
    requestBody,
    responseBody,
    httpStatus,
    success,
    errorMessage,
    durationMs,
  }) {
    return insert(
      `INSERT INTO zatca_api_logs (
         endpoint, method, request_body, response_body,
         http_status, success, error_message, duration_ms
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        endpoint,
        method,
        requestBody ?? null,
        responseBody ?? null,
        httpStatus ?? null,
        success ? 1 : 0,
        errorMessage ?? null,
        durationMs ?? null,
      ]
    );
  }

  async getRecent(limit = 100) {
    return query(
      `SELECT * FROM zatca_api_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
  }

  async clearAll() {
    await execute("DELETE FROM zatca_api_logs");
  }
}

export const zatcaApiLogRepository = new ZatcaApiLogRepository();
