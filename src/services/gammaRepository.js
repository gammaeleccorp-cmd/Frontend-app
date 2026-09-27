import { runtime } from "../config/runtime";
import {
  dtcs as mockDtcs,
  ecuParameters as mockEcuParameters,
  luminenMetrics as mockLuminenMetrics,
  mpuEvents as mockMpuEvents,
  negahbanMetrics as mockNegahbanMetrics,
  routeHistory as mockRouteHistory,
  routePoints as mockRoutePoints,
  vehicle as mockVehicle,
  mockConnection,
  mockNegahbanStatus,
} from "../data/mockData";
import * as authApi from "../api/authApi";
import * as gammaApi from "../api/gammaApi";
import { probeBackend } from "../api/client";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SESSION_KEY = "gamma_mock_session";
let mockConnectionState = structuredClone(mockConnection);
let mockNegahbanState = structuredClone(mockNegahbanStatus);

function mockSnapshot() {
  return {
    user: {
      firstName: "کاربر",
      lastName: "گاما",
      mobile: "0912•••••••",
    },
    vehicle: mockVehicle,
    luminenMetrics: mockLuminenMetrics,
    negahbanMetrics: mockNegahbanMetrics,
    dtcs: mockDtcs,
    ecuParameters: mockEcuParameters,
    routePoints: mockRoutePoints,
    routeHistory: mockRouteHistory,
    mpuEvents: mockMpuEvents,
    connection: {
      ...mockConnectionState,
      server: { status: "متصل" },
      gnss: mockNegahbanState.gnss,
    },
    negahbanStatus: mockNegahbanState,
  };
}

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
  }
  return undefined;
}

function normalizeVehicle(raw, fallback = mockVehicle) {
  if (!raw) return fallback;

  return {
    id: pick(raw, "id", "vehicle_id"),
    name:
      pick(raw, "name", "display_name", "vehicle_name") ||
      pick(raw, "model") ||
      fallback.name,
    model: pick(raw, "model", "trim") || fallback.model,
    year: String(pick(raw, "year", "model_year") || fallback.year),
    vin: pick(raw, "vin", "VIN") || fallback.vin,
    deviceSerial:
      pick(raw, "device_serial", "deviceSerial", "serial") ||
      raw?.device?.serial ||
      fallback.deviceSerial,
    deviceId:
      pick(raw, "device_id", "deviceId") ||
      raw?.device?.id ||
      fallback.deviceId,
    plate:
      pick(raw, "plate", "license_plate", "plate_number") ||
      fallback.plate,
  };
}

function normalizeDtc(raw) {
  return {
    code: pick(raw, "code", "dtc_code") || "UNKNOWN",
    title: pick(raw, "title", "name", "fa_title") || "کد خطا",
    severity: pick(raw, "severity", "level") || "نامشخص",
    description:
      pick(raw, "description", "interpretation", "message") ||
      "توضیحی از سرور دریافت نشده است.",
    symptoms: pick(raw, "symptoms") || [],
    causes: pick(raw, "causes", "possible_causes") || [],
    recommendation:
      pick(raw, "recommendation", "suggestion") ||
      "برای بررسی دقیق‌تر به تعمیرکار متخصص مراجعه شود.",
    status: pick(raw, "status") || "ذخیره‌شده",
  };
}

function telemetryToEcuParameters(telemetry) {
  if (!telemetry) return mockEcuParameters;

  const candidates = [
    ["Engine RPM", pick(telemetry, "rpm", "engine_rpm"), "rpm"],
    ["Vehicle Speed", pick(telemetry, "speed", "vehicle_speed"), "km/h"],
    ["Coolant Temp", pick(telemetry, "coolant_temp", "engine_temp"), "°C"],
    ["Throttle Position", pick(telemetry, "throttle", "throttle_position"), "%"],
    ["Intake Temp", pick(telemetry, "intake_temp"), "°C"],
    ["Battery Voltage", pick(telemetry, "voltage", "battery_voltage"), "V"],
    ["Engine Load", pick(telemetry, "engine_load"), "%"],
    ["Fuel Trim", pick(telemetry, "fuel_trim"), "%"],
  ];

  const mapped = candidates
    .filter(([, value]) => value !== undefined)
    .map(([label, value, unit]) => ({
      label,
      value: String(value),
      unit,
    }));

  return mapped.length ? mapped : mockEcuParameters;
}

function telemetryToMetrics(telemetry) {
  if (!telemetry) {
    return {
      luminenMetrics: mockLuminenMetrics,
      negahbanMetrics: mockNegahbanMetrics,
    };
  }

  return {
    luminenMetrics: [
      {
        label: "سرعت",
        value: String(pick(telemetry, "speed", "vehicle_speed") ?? "—"),
        unit: "km/h",
        icon: "gauge",
      },
      {
        label: "دور موتور",
        value: String(pick(telemetry, "rpm", "engine_rpm") ?? "—"),
        unit: "rpm",
        icon: "activity",
      },
      {
        label: "دمای موتور",
        value: String(pick(telemetry, "coolant_temp", "engine_temp") ?? "—"),
        unit: "°C",
        icon: "cpu",
      },
      {
        label: "ولتاژ",
        value: String(pick(telemetry, "voltage", "battery_voltage") ?? "—"),
        unit: "V",
        icon: "battery",
      },
    ],
    negahbanMetrics: [
      {
        label: "سرعت",
        value: String(pick(telemetry, "speed", "vehicle_speed") ?? "—"),
        unit: "km/h",
        icon: "gauge",
      },
      {
        label: "مسافت امروز",
        value: String(pick(telemetry, "distance_today", "daily_distance") ?? "—"),
        unit: "km",
        icon: "route",
      },
      {
        label: "توقف‌ها",
        value: String(pick(telemetry, "stops", "stop_count") ?? "—"),
        unit: "مورد",
        icon: "pin",
      },
      {
        label: "MPU",
        value: String(pick(telemetry, "mpu_status", "imu_status") ?? "عادی"),
        unit: "",
        icon: "activity",
      },
    ],
  };
}

function normalizeRoutes(rawRoutes) {
  if (!rawRoutes?.length) {
    return {
      routePoints: mockRoutePoints,
      routeHistory: mockRouteHistory,
    };
  }

  const points = [];
  const history = rawRoutes.map((route, index) => {
    const rawPoints = route?.points || route?.coordinates || [];
    rawPoints.forEach((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        points.push([Number(point[0]), Number(point[1])]);
      } else if (point?.lat !== undefined && point?.lng !== undefined) {
        points.push([Number(point.lat), Number(point.lng)]);
      }
    });

    return {
      id: route.id ?? index + 1,
      date: pick(route, "date", "display_date") || "—",
      start: pick(route, "start", "start_time") || "—",
      end: pick(route, "end", "end_time") || "—",
      distance: String(pick(route, "distance", "distance_km") ?? "—"),
      duration: String(pick(route, "duration", "duration_text") ?? "—"),
    };
  });

  return {
    routePoints: points.length ? points : mockRoutePoints,
    routeHistory: history,
  };
}

function normalizeMpuEvents(items) {
  if (!items?.length) return mockMpuEvents;

  return items.map((event, index) => ({
    id: event.id ?? index + 1,
    type: pick(event, "type", "event_type") || "رویداد",
    level: pick(event, "level", "severity") || "نامشخص",
    time: pick(event, "time", "created_at", "timestamp") || "—",
  }));
}

export async function requestOtp(mobile) {
  if (runtime.useMockApi) {
    await sleep(350);
    return { ok: true };
  }

  return authApi.requestOtp(mobile);
}

export async function verifyOtp(mobile, code) {
  if (runtime.useMockApi) {
    await sleep(350);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ mobile, access: "mock-access-token" }));
    return { ok: true };
  }

  return authApi.verifyOtp(mobile, code);
}

export function hasSession() {
  return Boolean(runtime.useMockApi ? localStorage.getItem(SESSION_KEY) : authApi.getAccessToken());
}

export async function resendOtp(mobile) {
  if (runtime.useMockApi) {
    await sleep(250);
    return { ok: true, mobile };
  }
  return authApi.requestOtp(mobile);
}

export async function refreshLiveData() {
  if (runtime.useMockApi) {
    await sleep(350);
    return mockSnapshot();
  }
  return getBootstrapData();
}

export async function scanConnection(type) {
  await sleep(400);
  mockConnectionState = { ...mockConnectionState, [type]: { status: "دستگاه پیدا شد", quality: "سیگنال خوب" } };
  return mockConnectionState[type];
}

export async function connectConnection(type) {
  await sleep(450);
  mockConnectionState = { ...mockConnectionState, [type]: { ...mockConnectionState[type], status: "متصل" } };
  return mockConnectionState[type];
}

export async function disconnectConnection(type) {
  await sleep(200);
  mockConnectionState = { ...mockConnectionState, [type]: { status: "قطع‌شده" } };
  return mockConnectionState[type];
}

export async function retryConnection(type) {
  return connectConnection(type);
}

export async function syncNegahban() {
  await sleep(400);
  mockNegahbanState = { ...mockNegahbanState, sync: { status: "همگام‌سازی شد", lastSync: "همین حالا", pendingRecords: 0 } };
  return mockNegahbanState;
}

export async function getBootstrapData() {
  if (runtime.useMockApi) {
    await sleep(250);
    return mockSnapshot();
  }

  const vehicles = await gammaApi.listVehicles();
  const firstVehicleRaw = vehicles[0];

  if (!firstVehicleRaw) {
    throw new Error("هیچ خودرویی برای این حساب ثبت نشده است.");
  }

  const vehicle = normalizeVehicle(firstVehicleRaw);

  const [meResult] = await Promise.allSettled([authApi.getMe()]);

  // Optional resources are not all implemented by the backend yet. Authentication
  // failures still stop bootstrap; a missing GPS/telemetry record must not do so.
  const failed = [meResult].filter(
    (item) => item.status === "rejected" && [401, 403].includes(item.reason?.status),
  );
  if (failed.length) {
    throw new Error("بخشی از اطلاعات خودرو دریافت نشد. لطفاً دوباره تلاش کنید.");
  }

  const telemetry = null;
  const dtcs = mockDtcs.map(normalizeDtc);
  const routes = normalizeRoutes(null);
  const mpuEvents = normalizeMpuEvents(null);
  const me =
    meResult.status === "fulfilled" ? meResult.value : {};

  const metrics = telemetryToMetrics(telemetry);

  return {
    user: {
      firstName: pick(me, "first_name", "firstName") || "کاربر",
      lastName: pick(me, "last_name", "lastName") || "گاما",
      mobile: pick(me, "mobile", "phone") || "",
    },
    vehicle,
    ...metrics,
    dtcs,
    ecuParameters: telemetryToEcuParameters(telemetry),
    routePoints: routes.routePoints,
    routeHistory: routes.routeHistory,
    mpuEvents,
    connection: {
      bluetooth: { status: "نامشخص", quality: "" },
      wifi: { status: "نامشخص" },
      server: { status: "متصل" },
      gnss: { status: "نامشخص" },
    },
  };
}

export async function testBackendConnection() {
  if (runtime.useMockApi) {
    return { reachable: true, status: 200, mock: true };
  }
  return probeBackend();
}

export async function checkOta(_deviceId) {
  await sleep(600);
  return {
    upToDate: true,
    currentVersion: "1.4.2",
  };
}

export async function getLatestLocation(vehicleId, signal) {
  if (runtime.useMockApi || !vehicleId) return null;
  return gammaApi.getLatestLocation(vehicleId, signal);
}

export function logout() {
  authApi.logout();
  localStorage.removeItem(SESSION_KEY);
}

export { runtime };
