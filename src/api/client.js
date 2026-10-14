import { runtime } from "../config/runtime";
import { endpoints } from "../config/endpoints";

const ACCESS_KEY = "gamma_access_token";
const REFRESH_KEY = "gamma_refresh_token";
const REFRESH_PATH = "/api/v1/auth/otp/refresh/";
let sessionVersion = 0;
let refreshTask = null;

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens(tokens) {
  clearTokens();
  storeTokens(tokens);
}

function storeTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  sessionVersion += 1;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function expireSession(version) {
  if (version !== sessionVersion) return;
  clearTokens();
  window.location.replace("/login");
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return false;
  const version = sessionVersion;
  if (!refreshTask || refreshTask.version !== version) {
    const task = { version };
    task.promise = apiRequest(REFRESH_PATH, {
      method: "POST",
      auth: false,
      body: { refresh },
    }).then((payload) => {
      // A response from the previous login must not restore a logged-out session.
      if (version !== sessionVersion) return false;
      if (typeof payload?.access !== "string" || !payload.access.trim()) {
        throw new ApiError("نشست ورود معتبر نیست. دوباره وارد شوید.", 401);
      }
      storeTokens({ access: payload.access, refresh: payload.refresh });
      return true;
    }).finally(() => {
      if (refreshTask === task) refreshTask = null;
    });
    refreshTask = task;
  }
  return refreshTask.promise;
}

export async function apiRequest(path, options = {}) {
  return request(path, options, true, sessionVersion);
}

async function request(path, options, canRefresh, version) {
  const {
    method = "GET",
    body,
    auth = true,
    signal,
    headers: customHeaders = {},
  } = options;

  const headers = {
    Accept: "application/json",
    ...customHeaders,
  };

  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const token = getAccessToken();
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${runtime.apiBaseUrl}${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw new ApiError(
      "ارتباط با سرور برقرار نشد. آدرس API، شبکه و CORS را بررسی کنید.",
      0,
      error,
    );
  }

  if (auth && response.status === 401) {
    if (canRefresh && token && version === sessionVersion) {
      try {
        // Another request may already have replaced this rejected access token.
        const refreshed = getAccessToken() !== token || await refreshAccessToken();
        if (refreshed && version === sessionVersion) {
          return request(path, options, false, version);
        }
      } catch (error) {
        // A temporary network/server failure must not log the user out.
        if (![400, 401, 403].includes(error.status)) throw error;
      }
    }
    expireSession(version);
    throw new ApiError("نشست ورود معتبر نیست. دوباره وارد شوید.", 401);
  }

  const contentType = response.headers.get("content-type") || "";
  let payload = null;

  if (response.status !== 204) {
    payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
  }

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      payload?.error ||
      `خطای سرور (${response.status})`;

    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export const HEALTH_CHECK_TIMEOUT_MS = 8000;

/**
 * Checks the backend readiness endpoint.
 * Success only when the response is 2xx AND its body is JSON with status "healthy".
 * Any 404/5xx, HTML page, unhealthy status, network failure or timeout is a failure.
 * `reason` is for UI wording; `status` is kept for debugging and must not be shown to customers.
 */
export async function probeBackend({ timeoutMs = HEALTH_CHECK_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(`${runtime.apiBaseUrl}${endpoints.health.ready}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { healthy: false, reason: "unavailable", status: response.status };
    let payload = null;
    try {
      payload = JSON.parse(await response.text());
    } catch {
      return { healthy: false, reason: "invalid_response", status: response.status };
    }
    if (payload?.status !== "healthy") return { healthy: false, reason: "unhealthy", status: response.status };
    return { healthy: true, reason: "healthy", status: response.status };
  } catch {
    return { healthy: false, reason: timedOut ? "timeout" : "network", status: 0 };
  } finally {
    clearTimeout(timer);
  }
}
