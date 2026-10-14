import { normalizeDigits } from "./validation.js";

// Same fields as the existing vehicle edit form. VIN is intentionally absent.
export const VEHICLE_FIELDS = ["model", "color", "production_year", "license_plate"];
const MAX_LENGTH = { model: 100, color: 50, license_plate: 20 };

/** Build the API payload for optional vehicle details; returns { payload, errors }. */
export function vehiclePayload(form = {}, { requireOne = true } = {}) {
  const errors = {};
  const payload = {};
  for (const key of ["model", "color", "license_plate"]) {
    const value = String(form[key] ?? "").trim();
    if (value.length > MAX_LENGTH[key]) errors[key] = `حداکثر ${MAX_LENGTH[key]} نویسه مجاز است.`;
    payload[key] = value;
  }
  const year = normalizeDigits(String(form.production_year ?? "")).trim();
  if (!year) payload.production_year = null;
  else if (!/^\d{4}$/.test(year) || Number(year) < 1300 || Number(year) > 1500) errors.production_year = "سال تولید را به شمسی و چهار رقمی وارد کنید (مثل ۱۴۰۲).";
  else payload.production_year = Number(year);
  if (requireOne && !Object.keys(errors).length && !payload.model && !payload.color && !payload.license_plate && payload.production_year == null) {
    errors.form = "دست‌کم یکی از مشخصات خودرو را وارد کنید.";
  }
  return { payload, errors };
}

/** Customer-facing text for a failed vehicle save (no raw HTTP codes). */
export function vehicleErrorMessage(error) {
  if (error?.fieldErrors) return error.message;
  switch (error?.status) {
    case 409: return "برای این دستگاه قبلاً اطلاعات خودرو ثبت شده است. صفحه را تازه کنید.";
    case 404: return "این دستگاه یا خودرو برای حساب شما پیدا نشد.";
    case 400: return "مشخصات واردشده معتبر نیست. مقادیر را بررسی کنید.";
    case 0: return "ارتباط با سرور برقرار نشد؛ اینترنت را بررسی کنید.";
    default: return error?.message && !/\d{3}/.test(error.message) ? error.message : "ذخیرهٔ اطلاعات خودرو ناموفق بود.";
  }
}
