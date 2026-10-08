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
  MOCK_DEVICES,
  MOCK_USERS,
  PRODUCTS,
  getUserProducts,
  normalizeProductType,
} from "../data/mockData";
import * as authApi from "../api/authApi";
import * as gammaApi from "../api/gammaApi";
import { probeBackend } from "../api/client";
import {
  clearMockSession,
  OTP_LENGTH,
  readMockAccounts,
  readMockSession,
  writeMockAccounts,
  writeMockSession,
} from "../config/auth";
import { formatPlateValue, isCompletePlate, normalizePlateValue } from "../components/PlateInput";
import { normalizeDigits } from "../utils/validation";
import { jalaliToIso } from "../utils/jalali.mjs";
import { coordinates, isTelemetryFresh, normalizeTelemetryHistory } from "../utils/telemetry.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let mockConnectionState = structuredClone(mockConnection);
let mockNegahbanState = structuredClone(mockNegahbanStatus);

function legacyMockSnapshot() {
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

function mockAccounts() {
  return [...MOCK_USERS, ...readMockAccounts()];
}

function findMockUser(mobile) {
  return mockAccounts().find((user) => user.mobile === mobile);
}

function findMockDevice(serial) {
  return MOCK_DEVICES.find((device) => device.serial.toLowerCase() === serial.trim().toLowerCase());
}

function mockSnapshot(session = readMockSession()) {
  const user = session?.user || {};
  const devices = session?.devices || [];
  const vehicles = session?.vehicles || [];
  const activeProduct = normalizeProductType(session?.activeProduct || devices[0]?.product_type);
  const activeDevice = devices.find((device) => normalizeProductType(device.product_type) === activeProduct) || devices[0];
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === activeDevice?.vehicle_id) || vehicles[0];

  return {
    user: {
      ...user,
      firstName: user.first_name || user.firstName || "کاربر",
      lastName: user.last_name || user.lastName || "گاما",
      mobile: user.mobile || "",
    },
    vehicles,
    devices,
    allowedProducts: getUserProducts({ devices }),
    activeProduct,
    vehicle: activeVehicle && activeDevice ? { ...mockVehicle, id: activeVehicle.id, vin: activeVehicle.vin, model: activeVehicle.model, year: String(activeVehicle.production_year), plate: activeVehicle.plate_number, deviceSerial: activeDevice.serial } : mockVehicle,
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

function normalizeVehicle(raw, _fallback = {}) {
  if (!raw) return null;

  return {
    id: pick(raw, "id", "vehicle_id"),
    name:
      pick(raw, "name", "display_name", "vehicle_name") ||
      pick(raw, "model") ||
      "خودرو",
    model: pick(raw, "model", "trim") || "—",
    year: String(pick(raw, "production_year", "year", "model_year") || "—"),
    vin: pick(raw, "vin", "VIN") || "—",
    deviceSerial:
      pick(raw, "device_serial", "deviceSerial", "serial") ||
      raw?.device?.serial ||
      "—",
    deviceCode: pick(raw, "device_code") || raw?.device?.device_code || "—",
    deviceId:
      pick(raw, "device_id", "deviceId") ||
      raw?.device?.id ||
      undefined,
    plate:
      pick(raw, "plate", "license_plate", "plate_number") ||
      "—",
    color: pick(raw, "color") || "—",
    production_year: pick(raw, "production_year") || null,
    raw: raw,
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
  if (!telemetry) return [];

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

  return mapped;
}

function telemetryToMetrics(telemetry) {
  if (!telemetry) {
    return {
      luminenMetrics: [],
      negahbanMetrics: [],
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
      ["سرعت", pick(telemetry, "speed", "vehicle_speed"), "km/h", "gauge"],
      ["ولتاژ باتری", pick(telemetry, "battery_voltage", "voltage"), "V", "battery"],
      ["کیلومترشمار", pick(telemetry, "odometer"), "km", "route"],
      ["کدهای خطا", pick(telemetry, "dtc_count"), "مورد", "activity"],
    ].filter(([, value]) => value != null).map(([label, value, unit, icon]) => ({
      label, value: String(value), unit, icon,
    })),
  };
}

function normalizeRoutes(rawRoutes) {
  if (!rawRoutes?.length) return { routePoints: [], routeHistory: [] };

  const points = [];
  const history = rawRoutes.map((route, index) => {
    const rawPoints = route?.points || route?.coordinates || (route?.latitude != null && route?.longitude != null ? [[route.latitude, route.longitude]] : []);
    rawPoints.forEach((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        points.push([Number(point[0]), Number(point[1])]);
      } else if (point?.lat !== undefined && point?.lng !== undefined) {
        points.push([Number(point.lat), Number(point.lng)]);
      }
    });

    return {
      id: route.id ?? index + 1,
      date: pick(route, "date", "display_date", "recorded_at") || "—",
      start: pick(route, "start", "start_time") || "—",
      end: pick(route, "end", "end_time") || "—",
      distance: String(pick(route, "distance", "distance_km") ?? "—"),
      duration: String(pick(route, "duration", "duration_text") ?? "—"),
    };
  });

  return {
    routePoints: points,
    routeHistory: history,
  };
}

function normalizeMpuEvents(items) {
  if (!items?.length) return [];

  return items.map((event, index) => ({
    id: event.id ?? index + 1,
    type: pick(event, "type", "event_type") || "رویداد",
    level: pick(event, "level", "severity") || "نامشخص",
    time: pick(event, "time", "created_at", "timestamp") || "—",
  }));
}

function assertMobile(mobile) {
  if (!/^09\d{9}$/.test(mobile)) throw new Error("شماره موبایل باید ۱۱ رقم و با 09 شروع شود.");
}

function assertOtp(code) {
  if (!/^\d+$/.test(code) || code.length !== OTP_LENGTH) {
    throw new Error(`کد تأیید باید ${OTP_LENGTH} رقمی باشد.`);
  }
}

export function validateVehicle(vehicle = {}) {
  const vin = String(vehicle.vin || "").toUpperCase();
  const plateValue = normalizePlateValue(vehicle.plate_number);
  const plate = formatPlateValue(plateValue);
  const productionYear = String(vehicle.production_year || "");
  return {
    valid: Boolean(isCompletePlate(plateValue) && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) && !/\s/.test(vin) && String(vehicle.model || "").trim() && String(vehicle.color || "").trim() && /^\d{4}$/.test(productionYear) && Number(productionYear) >= 1300 && Number(productionYear) <= 1500),
    normalized: { plate_number: plate, plate: plateValue, vin, model: String(vehicle.model || "").trim(), color: String(vehicle.color || "").trim(), production_year: Number(productionYear) },
  };
}

export async function validateDeviceSerial(serial) {
  if (!runtime.useMockApi) {
    try {
      const result = await gammaApi.validateDeviceCode(serial);
      return { state: result.available ? "valid" : "already_assigned", serial: result.device_code, productType: result.product_type, device: result };
    } catch (error) {
      return { state: error?.status === 409 ? "already_assigned" : "invalid", serial };
    }
  }
  await sleep(250);
  const device = findMockDevice(serial || "");
  if (!device) return { state: "invalid", serial };
  if (device.assigned_mobile) return { state: "already_assigned", serial: device.serial, productType: device.product_type, device };
  return { state: "valid", serial: device.serial, productType: device.product_type, device };
}

export async function bindDevice(payload) {
  if (runtime.useMockApi) {
    throw new Error("فعال‌سازی دستگاه در حالت آزمایشی در دسترس نیست.");
  }
  const deviceCode = normalizeDeviceCode(payload.deviceCode);
  if (!deviceCode) throw new Error("کد عمومی دستگاه معتبر نیست.");
  return gammaApi.activateDevice({ device_code: deviceCode });
}

export function normalizeDeviceCode(value) {
  const match = /^(NG|RH|LM)-(\d{1,4})$/.exec(normalizeDigits(value).trim().toUpperCase().replaceAll("_", "-"));
  return match ? `${match[1]}-${match[2].padStart(4, "0")}` : "";
}

export async function requestLoginOtp(mobile) {
  assertMobile(mobile);
  if (runtime.useMockApi) {
    await sleep(350);
    if (!findMockUser(mobile)) throw new Error("حسابی با این شماره موبایل پیدا نشد.");
    return { ok: true };
  }
  return authApi.requestOtp(mobile, undefined, "login");
}

export function requestOtp(mobile) {
  return requestLoginOtp(mobile);
}

export async function requestRegistrationOtp(registration) {
  assertMobile(registration.mobile);
  const birthDate = jalaliToIso(registration.birthDate);
  if (!birthDate) throw new Error("تاریخ تولد شمسی معتبر نیست.");
  if (!registration.firstName?.trim() || !registration.lastName?.trim()) throw new Error("نام و نام خانوادگی را وارد کنید.");
  if (!["NEGAHBAN", "RAHBAN", "LUMINEN"].includes(registration.deviceModel)) throw new Error("مدل دستگاه را انتخاب کنید.");
  if (runtime.useMockApi && findMockUser(registration.mobile)) throw new Error("این شماره موبایل قبلاً ثبت شده است.");
  if (runtime.useMockApi) {
    await sleep(350);
    return { ok: true, productType: registration.deviceModel };
  }
  return authApi.requestOtp(registration.mobile, {
    firstName: registration.firstName.trim(),
    lastName: registration.lastName.trim(),
    birthDate,
    deviceModel: registration.deviceModel,
  });
}

export function registerUser(registration) {
  const user = {
    id: `mock-${registration.mobile}`,
    mobile: registration.mobile,
    first_name: registration.firstName,
    last_name: registration.lastName,
    birth_date: jalaliToIso(registration.birthDate),
    preferred_product: registration.deviceModel,
    vehicles: [],
    devices: [],
  };
  const accounts = readMockAccounts().filter((item) => item.mobile !== user.mobile);
  writeMockAccounts([...accounts, user]);
  return user;
}

export async function verifyOtp({ mobile, code, flow = "login", registration, rememberMe = false }) {
  if (runtime.useMockApi) {
    await sleep(350);
    assertOtp(code);
    const account = flow === "registration" ? registerUser(registration) : findMockUser(mobile);
    const { devices, vehicles, ...user } = account || {};
    if (!account) throw new Error("حسابی با این شماره موبایل پیدا نشد.");
    if (!user) throw new Error("حسابی با این شماره موبایل پیدا نشد.");
    const sessionDevices = (devices || []).map(({ assigned_mobile: _assignedMobile, ...device }) => device);
    writeMockSession({ access: "mock-access-token", user, vehicles: vehicles || [], devices: sessionDevices, activeProduct: sessionDevices[0]?.product_type }, rememberMe);
    return { ok: true };
  }
  return authApi.verifyOtp(mobile, code);
}

export function hasSession() {
  return Boolean(runtime.useMockApi ? readMockSession() : authApi.getAccessToken());
}

export async function resendOtp({ flow = "login", mobile, registration }) {
  if (runtime.useMockApi) {
    await sleep(250);
    return { ok: true, mobile };
  }
  return flow === "registration" ? requestRegistrationOtp(registration) : authApi.requestOtp(mobile, undefined, "login");
}

export function logout() {
  authApi.logout();
  clearMockSession();
}

async function legacyRequestOtp(mobile) {
  if (runtime.useMockApi) {
    await sleep(350);
    return { ok: true };
  }

  return authApi.requestOtp(mobile);
}

async function legacyVerifyOtp(mobile, code) {
  if (runtime.useMockApi) {
    await sleep(350);
    if (!/^\d+$/.test(code) || code.length !== OTP_LENGTH) {
      throw new Error(`کد تأیید باید ${OTP_LENGTH} رقمی باشد.`);
    }
    writeMockSession({ mobile, access: "mock-access-token" }, true);
    return { ok: true };
  }

  return authApi.verifyOtp(mobile, code);
}

function legacyHasSession() {
  return Boolean(runtime.useMockApi ? readMockSession() : authApi.getAccessToken());
}

async function legacyResendOtp(mobile) {
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
  if (!runtime.useMockApi) throw new Error("عملیات اتصال دستگاه از API واقعی پشتیبانی نمی‌شود.");
  await sleep(400);
  mockConnectionState = { ...mockConnectionState, [type]: { status: "دستگاه پیدا شد", quality: "سیگنال خوب" } };
  return mockConnectionState[type];
}

export async function connectConnection(type) {
  if (!runtime.useMockApi) throw new Error("عملیات اتصال دستگاه از API واقعی پشتیبانی نمی‌شود.");
  await sleep(450);
  mockConnectionState = { ...mockConnectionState, [type]: { ...mockConnectionState[type], status: "متصل" } };
  return mockConnectionState[type];
}

export async function disconnectConnection(type) {
  if (!runtime.useMockApi) throw new Error("عملیات اتصال دستگاه از API واقعی پشتیبانی نمی‌شود.");
  await sleep(200);
  mockConnectionState = { ...mockConnectionState, [type]: { status: "قطع‌شده" } };
  return mockConnectionState[type];
}

export async function retryConnection(type) {
  return connectConnection(type);
}

export async function syncNegahban() {
  if (!runtime.useMockApi) return getBootstrapData();
  await sleep(400);
  mockNegahbanState = { ...mockNegahbanState, sync: { status: "همگام‌سازی شد", lastSync: "همین حالا", pendingRecords: 0 } };
  return mockNegahbanState;
}

export async function getBootstrapData() {
  if (runtime.useMockApi) {
    await sleep(250);
    return mockSnapshot();
  }

  const [vehiclesResult, devices, meResult] = await Promise.all([
    gammaApi.listVehicles().catch(() => []),
    gammaApi.listDevices(),
    authApi.getMe(),
  ]);
  const vehicles = vehiclesResult;
  const firstDeviceRaw = devices[0] || null;
  const firstVehicleRaw = vehicles.find((item) => item.id === firstDeviceRaw?.vehicle_id) || vehicles[0] || null;
  const deviceCode = firstDeviceRaw?.device_code || null;
  const negahban = normalizeProductType(firstDeviceRaw?.product_type) === PRODUCTS.NEGAHBAN;
  const user = {
    firstName: pick(meResult, "first_name", "firstName") || "",
    lastName: pick(meResult, "last_name", "lastName") || "",
    mobile: pick(meResult, "mobile", "phone") || "",
    nationalId: pick(meResult, "national_id", "nationalId") || "",
    birthDate: pick(meResult, "birth_date", "birthDate") || "",
  };

  if (!firstDeviceRaw && !firstVehicleRaw) {
    return {
      user, vehicle: null, vehicles, devices, allowedProducts: [],
      luminenMetrics: [], negahbanMetrics: [], dtcs: [], ecuParameters: [],
      routePoints: [], routeHistory: [], mpuEvents: [], connection: {}, negahbanStatus: {},
    };
  }

  const vehicle = firstVehicleRaw ? normalizeVehicle(firstVehicleRaw) : {};
  const telemetryRequests = deviceCode
    ? [
        gammaApi.getLatestDeviceTelemetry(deviceCode),
        gammaApi.getDeviceTelemetryHistory(deviceCode),
      ]
    : firstVehicleRaw && !negahban ? [
        gammaApi.getLatestTelemetry(firstVehicleRaw.id),
        gammaApi.getTelemetryHistory(firstVehicleRaw.id),
      ] : [Promise.resolve(null), Promise.resolve([])];

  const [telemetry, history] = await Promise.allSettled(telemetryRequests);

  const latestTelemetry =
    telemetry.status === "fulfilled" ? telemetry.value : null;

  const historyItems =
    history.status === "fulfilled" ? history.value : [];

  const routes = deviceCode ? normalizeTelemetryHistory(historyItems) : normalizeRoutes(historyItems);
  const dtcs = [];
  const mpuEvents = [];
  const metrics = telemetryToMetrics(latestTelemetry);
  const online = isTelemetryFresh(latestTelemetry);
  const lastLocation = coordinates(latestTelemetry) || routes.routeHistory[0]?.coordinates || null;
  const gnssStatus = isTelemetryFresh({ recorded_at: latestTelemetry?.recorded_at }) && coordinates(latestTelemetry)
    ? "موقعیت تازه دریافت شد"
    : lastLocation ? "فقط موقعیت ثبت‌شده" : "موقعیتی ثبت نشده";

  return {
    user,
    vehicle: { ...vehicle, deviceSerial: deviceCode || vehicle.deviceSerial, deviceCode, productType: firstDeviceRaw?.product_type, deviceStatus: firstDeviceRaw?.status, lastSeen: firstDeviceRaw?.last_seen },
    vehicles,
    devices,
    allowedProducts: [...new Set(devices.map((device) => normalizeProductType(device.product_type)))],
    ...metrics,
    latestTelemetry,
    lastLocation,
    telemetryError: telemetry.status === "rejected" ? "آخرین دادهٔ دستگاه دریافت نشد." : "",
    historyError: history.status === "rejected" ? "تاریخچهٔ موقعیت دریافت نشد." : "",
    dtcs,
    ecuParameters: telemetryToEcuParameters(latestTelemetry),
    routePoints: routes.routePoints,
    routeHistory: routes.routeHistory,
    mpuEvents,
    connection: {
      server: { status: online ? "داده تازه" : "بدون داده تازه" },
      gnss: { status: gnssStatus },
    },
    negahbanStatus: {
      online,
      sync: { status: "تاریخچهٔ ثبت‌شده" },
    },
  };
}

export async function testBackendConnection() {
  if (runtime.useMockApi) {
    return { reachable: true, status: 200, mock: true };
  }
  return probeBackend();
}

export async function updateProfile(changes) {
  return authApi.updateMe(changes);
}

export async function updateVehicle(vehicleId, changes) {
  return gammaApi.updateVehicle(vehicleId, changes);
}

export async function checkOta(_deviceId) {
  if (!runtime.useMockApi) throw new Error("بررسی OTA هنوز API واقعی ندارد.");
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

function legacyLogout() {
  authApi.logout();
  clearMockSession();
}

void legacyMockSnapshot;
void normalizeDtc;
void normalizeMpuEvents;
void legacyRequestOtp;
void legacyVerifyOtp;
void legacyHasSession;
void legacyResendOtp;
void legacyLogout;

export { runtime };
