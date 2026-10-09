import { runtime } from "../config/runtime";

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

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
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
  const refresh = getRefreshToken();
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

export async function probeBackend() {
  try {
    const response = await fetch(runtime.apiBaseUrl, {
      method: "GET",
      headers: { Accept: "text/html,application/json" },
    });
    return {
      reachable: true,
      status: response.status,
    };
  } catch {
    return {
      reachable: false,
      status: 0,
    };
  }
}
