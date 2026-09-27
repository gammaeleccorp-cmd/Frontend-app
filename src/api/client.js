import { runtime } from "../config/runtime";

const ACCESS_KEY = "gamma_access_token";
const REFRESH_KEY = "gamma_refresh_token";

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

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function apiRequest(path, options = {}) {
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
