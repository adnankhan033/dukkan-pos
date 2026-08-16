import { invoke, isTauri } from "@tauri-apps/api/core";
import { zatcaLogger } from "./logger";
import { zatcaApiLogRepository } from "../repositories/ZatcaApiLogRepository";

/**
 * HTTP transport for ZATCA APIs — uses Tauri native HTTP (no CORS) in desktop app.
 */
export async function zatcaHttpRequest({ method, url, headers = {}, body = null, skipLog = false }) {
  zatcaLogger.debug("ZATCA HTTP request", { method, url });

  if (!isTauri()) {
    throw new Error("ZATCA API calls require the Dukkan POS desktop app.");
  }

  const start = performance.now();
  let response;

  try {
    response = await invoke("zatca_http_request", {
      method,
      url,
      headers,
      body: body ?? null,
    });
  } catch (err) {
    if (!skipLog) {
      await zatcaApiLogRepository.log({
        endpoint: url,
        method,
        requestBody: body,
        responseBody: null,
        httpStatus: 0,
        success: false,
        errorMessage: err.message,
        durationMs: Math.round(performance.now() - start),
      });
    }
    throw err;
  }

  const durationMs = Math.round(performance.now() - start);

  let parsedBody = response.body;
  try {
    parsedBody = JSON.parse(response.body);
  } catch {
    /* keep raw text */
  }

  const result = {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    rawBody: response.body,
    body: parsedBody,
    durationMs,
  };

  if (!skipLog) {
    await zatcaApiLogRepository.log({
      endpoint: url,
      method,
      requestBody: body,
      responseBody: response.body,
      httpStatus: response.status,
      success: result.ok,
      errorMessage: result.ok ? null : formatZatcaApiError(result),
      durationMs,
    });
  }

  return result;
}

export function formatZatcaApiError(response) {
  const body = response?.body;
  const validation = body?.validationResults;

  if (validation?.errorMessages?.length) {
    return validation.errorMessages
      .map((e) => `${e.code || "ERROR"}: ${e.message}`)
      .join("; ");
  }

  if (validation?.warningMessages?.length && !validation?.errorMessages?.length) {
    const warnings = validation.warningMessages
      .map((e) => `${e.code || "WARN"}: ${e.message}`)
      .join("; ");
    if (warnings) return warnings;
  }

  if (body?.errors?.length) {
    return body.errors.map((e) => `${e.code || "Error"}: ${e.message}`).join("; ");
  }
  if (body?.code && body?.message) {
    return `${body.code}: ${body.message}`;
  }
  if (body?.message) return body.message;
  if (typeof body === "string" && body.trim()) return body;
  return `HTTP ${response?.status || "error"}`;
}

export function buildBasicAuthHeader(token, secret) {
  const value = btoa(`${token}:${secret}`);
  return `Basic ${value}`;
}
