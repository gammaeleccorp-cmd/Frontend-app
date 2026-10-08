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

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

let refreshing = null;

// One shared refresh for concurrent 401s; the access token lives 15 minutes,
// so background polling must renew it instead of signing the user out.
async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = fetch(`${runtime.apiBaseUrl}/api/v1/auth/otp/refresh/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const payload = await response.json().catch(() => null);
        if (!payload?.access) return false;
        setTokens({ access: payload.access, refresh: payload.refresh });
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    auth = true,
    signal,
    headers: customHeaders = {},
    retried = false,
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
      "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.",
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

  if (auth && response.status === 401 && !retried && getRefreshToken()) {
    if (await refreshAccessToken()) return apiRequest(path, { ...options, retried: true });
  }

  if (!response.ok) {
    if (auth && response.status === 401) clearTokens();
    const known = {
      'Invalid OTP.': 'کد تأیید اشتباه است.',
      'No active OTP was found.': 'کد فعالی یافت نشد؛ دوباره درخواست کد کنید.',
      'OTP has expired.': 'کد تأیید منقضی شده است؛ کد جدید بگیرید.',
      'Device was not found.': 'دستگاهی با این کد پیدا نشد.',
      'Device is not production-ready.': 'دستگاه هنوز مراحل کارخانه را تکمیل نکرده است.',
    };
    const detail = payload?.detail || payload?.message;
    const fieldLabels = { mobile: 'شماره موبایل', code: 'کد تأیید', device_code: 'کد دستگاه', registration: 'اطلاعات ثبت‌نام', firstName: 'نام', lastName: 'نام خانوادگی', birthDate: 'تاریخ تولد', deviceModel: 'مدل دستگاه' };
    const fields = payload && typeof payload === 'object' ? Object.keys(payload).filter(key => fieldLabels[key]).map(key => fieldLabels[key]) : [];
    const message = known[detail] || (response.status === 409 ? 'این دستگاه قبلاً متصل شده یا در دسترس نیست.' : response.status === 401 ? 'نشست شما منقضی شده است؛ دوباره وارد شوید.' : response.status === 429 ? 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.' : fields.length ? 'این فیلدها را بررسی کنید: ' + fields.join('، ') : response.status >= 500 ? 'سرویس موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید.' : detail || 'درخواست پذیرفته نشد؛ اطلاعات را بررسی کنید.');

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
