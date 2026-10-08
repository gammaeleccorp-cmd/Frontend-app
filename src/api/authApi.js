import { apiRequest, clearTokens, getRefreshToken, setTokens } from "./client";
import { endpoints } from "../config/endpoints";

export async function requestOtp(mobile, registration, flow) {
  return apiRequest(endpoints.auth.requestOtp, {
    method: "POST",
    auth: false,
    body: { mobile, ...(registration ? { registration } : {}), ...(flow ? { flow } : {}) },
  });
}

export async function verifyOtp(mobile, code) {
  const payload = await apiRequest(endpoints.auth.verifyOtp, {
    method: "POST",
    auth: false,
    body: { mobile, code },
  });

  const access =
    payload?.access ||
    payload?.access_token ||
    payload?.tokens?.access;

  const refresh =
    payload?.refresh ||
    payload?.refresh_token ||
    payload?.tokens?.refresh;

  if (access) {
    setTokens({ access, refresh });
  }

  return payload;
}

export async function getMe() {
  return apiRequest(endpoints.auth.me);
}

export async function updateMe(changes) {
  return apiRequest(endpoints.auth.me, { method: "PATCH", body: changes });
}

export async function listSessions() {
  return apiRequest(endpoints.auth.sessions);
}

export async function revokeOtherSessions() {
  return apiRequest(endpoints.auth.revokeOtherSessions, { method: "POST", body: { refresh: getRefreshToken() } });
}

// Revoke this sign-in on the server, then always clear it locally.
export async function logout() {
  const refresh = getRefreshToken();
  try {
    if (refresh) await apiRequest(endpoints.auth.logout, { method: "POST", auth: false, body: { refresh } });
  } catch {
    // Local sign-out must still happen when the network is unavailable.
  } finally {
    clearTokens();
  }
}

export function currentRefreshJti() {
  const token = getRefreshToken();
  if (!token) return "";
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "="))).jti || "";
  } catch {
    return "";
  }
}

export function getAccessToken() {
  return localStorage.getItem("gamma_access_token");
}
