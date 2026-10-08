import { createContext, useContext } from "react";
import { formatAge, formatDateTime } from "../utils/time.js";

export const LiveDeviceContext = createContext({ status: null, route: [], loading: false, error: "", refresh: async () => null, deviceCode: "" });

export function useLiveDevice() {
  return useContext(LiveDeviceContext);
}

// One interpretation of the server state, shared by header, home, routes and
// vehicle pages so they can never disagree.
export function describeConnection({ status, loading, error, deviceCode }) {
  if (!deviceCode) return { tone: "unknown", label: "بدون دستگاه", detail: "هنوز دستگاهی به حساب متصل نشده است." };
  if (!status) {
    if (error) return { tone: "unknown", label: "وضعیت نامشخص", detail: error };
    return { tone: "unknown", label: loading ? "در حال بررسی" : "وضعیت نامشخص", detail: "در حال دریافت وضعیت از سرور..." };
  }
  if (status.online) {
    return { tone: "online", label: "آنلاین", detail: `آخرین ارتباط ${formatAge(ageOf(status.server_time, status.last_seen))}` };
  }
  if (status.last_seen) {
    return { tone: "offline", label: "آفلاین", detail: `آخرین ارتباط ${formatAge(ageOf(status.server_time, status.last_seen))} (${formatDateTime(status.last_seen)})` };
  }
  return { tone: "offline", label: "بدون داده", detail: "هنوز هیچ داده‌ای از این دستگاه به سرور نرسیده است." };
}

export function describeLocation(status) {
  if (!status) return { state: "unknown", label: "نامشخص", detail: "" };
  const location = status.location;
  if (location) {
    const when = `${formatAge(location.age_seconds)} · ${formatDateTime(location.recorded_at)}`;
    return location.stale
      ? { state: "stale", label: "موقعیت قدیمی", detail: `آخرین موقعیت ثبت‌شده مربوط به ${when} است.` }
      : { state: "fresh", label: "موقعیت به‌روز", detail: `ثبت‌شده ${when}` };
  }
  if (status.latest_telemetry && !status.latest_telemetry.has_location) {
    return { state: "no_gps", label: "بدون GPS", detail: "دستگاه داده ارسال کرده اما هنوز موقعیت GPS معتبری گزارش نکرده است." };
  }
  return { state: "none", label: "بدون موقعیت", detail: "هنوز موقعیت واقعی از دستگاه دریافت نشده است." };
}

function ageOf(now, then) {
  const a = Date.parse(now);
  const b = Date.parse(then);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, (a - b) / 1000);
}
