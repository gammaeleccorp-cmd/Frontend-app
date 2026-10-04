import { apiRequest, clearTokens, setTokens } from "./client";
import { endpoints } from "../config/endpoints";

export async function requestOtp(mobile, registration) {
  return apiRequest(endpoints.auth.requestOtp, {
    method: "POST",
    auth: false,
    body: registration ? { mobile, registration } : { mobile },
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

export function logout() {
  clearTokens();
}

export function getAccessToken() {
  return localStorage.getItem("gamma_access_token");
}
