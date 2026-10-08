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
import { asciiDigits, normalizeDeviceCode } from "../utils/deviceCode";
import { parseJalaliBirthDate } from "../utils/jalaliDate";

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
  const vin = String(vehicle.vin || "").replace(/\s/g, "").toUpperCase();
  const plateValue = normalizePlateValue(vehicle.plate_number);
  const plate = formatPlateValue(plateValue);
  const productionYear = String(vehicle.production_year || "");
  return {
    valid: Boolean(isCompletePlate(plateValue) && (!vin || /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) && String(vehicle.model || "").trim() && String(vehicle.color || "").trim() && /^\d{4}$/.test(productionYear) && Number(productionYear) >= 1300 && Number(productionYear) <= 1500),
    normalized: { plate_number: plate, plate: plateValue, ...(vin ? { vin } : {}), model: String(vehicle.model || "").trim(), color: String(vehicle.color || "").trim(), production_year: Number(productionYear) },
  };
}

export async function validateDeviceSerial(serial) {
  if (!runtime.useMockApi) {
    try {
      const result = await gammaApi.validateDeviceCode(serial);
      if (!result || result.device_code !== serial || typeof result.available !== "boolean") {
        return { state: "error", serial, message: "پاسخ اعتبارسنجی سرور معتبر نیست. دوباره تلاش کنید." };
      }
      return { state: result.available ? "valid" : "already_assigned", serial: result.device_code, productType: result.product_type, device: result };
    } catch (error) {
      if (error?.status === 409) return { state: "already_assigned", serial };
      if (error?.status === 400 || error?.status === 404 || error?.status === 422) return { state: "invalid", serial };
      return { state: "error", serial, message: error?.status === 0 ? "ارتباط با سرور برقرار نشد. دوباره تلاش کنید." : "خطای سرور در بررسی دستگاه. دوباره تلاش کنید." };
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
  const code = normalizeDeviceCode(payload.deviceCode);
  if (!code) throw new Error('کد عمومی دستگاه معتبر نیست.');
  return gammaApi.activateDevice({ device_code: code });
}

export async function requestLoginOtp(mobile) {
  mobile = asciiDigits(mobile);
  assertMobile(mobile);
  if (runtime.useMockApi) {
    await sleep(350);
    if (!findMockUser(mobile)) throw new Error("حسابی با این شماره موبایل پیدا نشد.");
    return { ok: true };
  }
  return authApi.requestOtp(mobile, undefined, 'login');
}

export function requestOtp(mobile) {
  return requestLoginOtp(mobile);
}

export async function requestRegistrationOtp(registration) {
  const mobile = asciiDigits(registration.mobile);
  assertMobile(mobile);
  const birthDate = parseJalaliBirthDate(registration.birthDate);
  if (!birthDate) throw new Error('تاریخ تولد شمسی معتبر نیست.');
  const profile = { firstName: registration.firstName.trim(), lastName: registration.lastName.trim(), birthDate, deviceModel: registration.deviceModel };
  if (runtime.useMockApi) return { ok: true };
  return authApi.requestOtp(mobile, profile);
}

export function registerUser(registration) {
  const user = { id: 'mock-' + registration.mobile, mobile: registration.mobile, first_name: registration.firstName, last_name: registration.lastName, birth_date: parseJalaliBirthDate(registration.birthDate), preferred_product: registration.deviceModel, devices: [], vehicles: [] };
  writeMockAccounts([...readMockAccounts().filter(item => item.mobile !== user.mobile), user]);
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
  return authApi.verifyOtp(asciiDigits(mobile), asciiDigits(code));
}

export function hasSession() {
  return Boolean(runtime.useMockApi ? readMockSession() : authApi.getAccessToken());
}

export async function resendOtp({ flow = "login", mobile, registration }) {
  if (runtime.useMockApi) {
    await sleep(250);
    return { ok: true, mobile };
  }
  return flow === "registration" ? requestRegistrationOtp(registration) : authApi.requestOtp(mobile);
}

export async function logout() {
  clearMockSession();
  await authApi.logout();
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

  const [devices, meResult] = await Promise.all([
    gammaApi.listDevices(),
    authApi.getMe(),
  ]);
  return buildSnapshot(meResult, devices);
}

function normalizeUser(me) {
  return {
    firstName: pick(me, "first_name", "firstName") || "",
    lastName: pick(me, "last_name", "lastName") || "",
    mobile: pick(me, "mobile", "phone") || "",
    nationalId: pick(me, "national_id", "nationalId") || "",
    birthDate: pick(me, "birth_date", "birthDate") || "",
    emergencyPhone: pick(me, "emergency_phone") || "",
  };
}

export function normalizeVehicleDetails(raw) {
  if (!raw) return null;
  const details = {
    id: raw.id,
    make: raw.make || "",
    model: raw.model || "",
    productionYear: raw.production_year ? String(raw.production_year) : "",
    color: raw.color || "",
    plate: raw.license_plate || "",
  };
  details.hasDetails = Boolean(details.make || details.model || details.productionYear || details.color || details.plate);
  return details;
}

// The dashboard is keyed by the bound device, not by vehicle data: a device
// activated without vehicle details must still show its real state.
export function buildSnapshot(me, devices = []) {
  const vehicleDetails = normalizeVehicleDetails(me?.vehicle);
  const primary = devices[0];
  return {
    user: normalizeUser(me),
    devices,
    vehicleDetails,
    vehicle: primary
      ? {
          id: vehicleDetails?.id,
          deviceCode: primary.device_code,
          productType: normalizeProductType(primary.product_type),
          deviceStatus: primary.status,
          online: Boolean(primary.online),
          lastSeen: primary.last_seen || null,
          model: vehicleDetails?.model || "",
          plate: vehicleDetails?.plate || "",
        }
      : null,
    allowedProducts: [...new Set(devices.map((device) => normalizeProductType(device.product_type)))],
    onboardingRequired: false,
    vehicles: vehicleDetails ? [vehicleDetails] : [],
    luminenMetrics: [],
    negahbanMetrics: [],
    dtcs: [],
    ecuParameters: [],
    routePoints: [],
    routeHistory: [],
    mpuEvents: [],
    connection: {},
    negahbanStatus: {},
  };
}

export function deviceForProduct(data, product) {
  const devices = data?.devices || [];
  return devices.find((device) => normalizeProductType(device.product_type) === product) || devices[0] || null;
}

export async function getDeviceStatus(deviceCode, signal) {
  if (runtime.useMockApi || !deviceCode) return null;
  return gammaApi.getDeviceStatus(deviceCode, signal);
}

export async function getDeviceRoute(deviceCode, signal) {
  if (runtime.useMockApi || !deviceCode) return [];
  return gammaApi.getDeviceTelemetry(deviceCode, signal);
}

export async function sendDeviceCommand(deviceCode, commandType) {
  if (runtime.useMockApi) throw new Error("ارسال فرمان در حالت آزمایشی در دسترس نیست.");
  return gammaApi.createDeviceCommand(deviceCode, commandType);
}

export async function getCommand(commandId, signal) {
  return gammaApi.getCommand(commandId, signal);
}

export async function listNotifications(signal) {
  if (runtime.useMockApi) return { unread_count: 0, items: [] };
  return gammaApi.listNotifications(signal);
}

export async function markNotificationsRead() {
  if (runtime.useMockApi) return { unread_count: 0 };
  return gammaApi.markNotificationsRead();
}

export async function listSessions() {
  if (runtime.useMockApi) return [];
  const sessions = await authApi.listSessions();
  const current = authApi.currentRefreshJti();
  return (Array.isArray(sessions) ? sessions : []).map((item) => ({ ...item, current: Boolean(current) && item.jti === current }));
}

export async function revokeOtherSessions() {
  return authApi.revokeOtherSessions();
}

void telemetryToMetrics;
void telemetryToEcuParameters;
void normalizeRoutes;
void normalizeVehicle;

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
