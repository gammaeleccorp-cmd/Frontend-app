export const PRODUCTS = {
  RAHBAN: "RAHBAN",
  NEGAHBAN: "NEGAHBAN",
  // Compatibility alias for existing telematics/diagnostics code.
  LUMINEN: "RAHBAN",
};

export const MOCK_VEHICLES = [
  { id: "vehicle-ng-01", plate_number: "12الف345-67", vin: "WVWZZZ1JZXW000001", model: "پژو ۲۰۶", color: "سفید", production_year: 1402 },
  { id: "vehicle-rh-01", plate_number: "34ب567-89", vin: "IR206GAMMA0241VIN", model: "پژو ۲۰۶", color: "خاکستری", production_year: 1403 },
  { id: "vehicle-both-01", plate_number: "56ج789-01", vin: "WVWZZZ1JZXW000002", model: "دنا", color: "مشکی", production_year: 1404 },
];

export const MOCK_DEVICES = [
  { device_code: "NG-04", serial: "NG-04-0001", product_type: PRODUCTS.NEGAHBAN, vehicle_id: MOCK_VEHICLES[0].id, assigned_mobile: "09120000001" },
  { device_code: "NG-05", serial: "NG-05-0001", product_type: PRODUCTS.NEGAHBAN },
  { device_code: "RH-04", serial: "RH-04-0001", product_type: PRODUCTS.RAHBAN, vehicle_id: MOCK_VEHICLES[1].id, assigned_mobile: "09120000002" },
  { device_code: "RH-05", serial: "RH-05-0001", product_type: PRODUCTS.RAHBAN },
  { device_code: "GAMMA-0241", serial: "GAMMA-0241", product_type: PRODUCTS.RAHBAN },
];

export const MOCK_USERS = [
  {
    id: "mock-negahban-user",
    mobile: "09120000001",
    first_name: "کاربر",
    last_name: "نگهبان",
    national_id: "0012345678",
    birth_date: "1375-01-01",
    vehicles: [MOCK_VEHICLES[0]],
    devices: [MOCK_DEVICES[0]],
  },
  {
    id: "mock-rahban-user",
    mobile: "09120000002",
    first_name: "کاربر",
    last_name: "راهبان",
    national_id: "0012345679",
    birth_date: "1375-01-01",
    vehicles: [MOCK_VEHICLES[1]],
    devices: [MOCK_DEVICES[2]],
  },
  {
    id: "mock-both-user",
    mobile: "09120000003",
    first_name: "کاربر",
    last_name: "دو محصولی",
    national_id: "0012345686",
    birth_date: "1375-01-01",
    vehicles: [MOCK_VEHICLES[0], MOCK_VEHICLES[1]],
    devices: [MOCK_DEVICES[0], MOCK_DEVICES[2]],
  },
];

export function normalizeProductType(productType) {
  const normalized = productType?.toLowerCase?.();
  if (["luminen", "rahban"].includes(normalized)) return PRODUCTS.RAHBAN;
  if (normalized === "negahban") return PRODUCTS.NEGAHBAN;
  return productType;
}

export function getUserProducts(user) {
  return [...new Set((user?.devices || []).map((device) => normalizeProductType(device.product_type)))];
}

export const VIEWS = {
  HOME: "home",
  VEHICLE: "vehicle",
  DIAGNOSTICS: "diagnostics",
  DTC_DETAIL: "dtc-detail",
  ECU_LIVE: "ecu-live",
  OTA: "ota",
  ROUTES: "routes",
  MPU: "mpu",
  PROFILE: "profile",
  CONNECTION: "connection",
};

export const vehicle = {
  name: "پژو ۲۰۶",
  model: "تیپ ۵",
  year: "۱۴۰۲",
  vin: "IR206GAMMA0241VIN",
  deviceSerial: "GAMMA-0241",
  plate: "ایران ۴۴ • ۱۲۳ ب ۴۵",
};

export const luminenMetrics = [
  { label: "سرعت", value: "0", unit: "km/h", icon: "gauge" },
  { label: "دور موتور", value: "780", unit: "rpm", icon: "activity" },
  { label: "دمای موتور", value: "88", unit: "°C", icon: "cpu" },
  { label: "ولتاژ", value: "13.9", unit: "V", icon: "battery" },
];

export const negahbanMetrics = [
  { label: "سرعت", value: "42", unit: "km/h", icon: "gauge" },
  { label: "مسافت امروز", value: "38.6", unit: "km", icon: "route" },
  { label: "توقف‌ها", value: "3", unit: "مورد", icon: "pin" },
  { label: "MPU", value: "عادی", unit: "", icon: "activity" },
];

export const dtcs = [
  {
    code: "P0301",
    title: "احتراق ناقص در سیلندر ۱",
    severity: "متوسط",
    description: "ECU وقوع Misfire در سیلندر اول را ثبت کرده است.",
    symptoms: ["لرزش موتور", "افت قدرت", "افزایش مصرف سوخت"],
    causes: ["شمع فرسوده", "کوئل معیوب", "انژکتور سیلندر ۱", "نشتی هوای ورودی"],
    recommendation: "در صورت تکرار خطا، ابتدا شمع و کوئل سیلندر ۱ بررسی شوند و سپس وضعیت انژکتور تست شود.",
    status: "ذخیره‌شده",
  },
  {
    code: "P0420",
    title: "بازده پایین کاتالیست",
    severity: "کم",
    description: "بازده سیستم کاتالیست پایین‌تر از مقدار مورد انتظار گزارش شده است.",
    symptoms: ["چراغ چک", "مصرف سوخت کمی بالاتر"],
    causes: ["فرسودگی کاتالیست", "سنسور اکسیژن", "نشتی اگزوز"],
    recommendation: "ابتدا سنسورهای اکسیژن و نشتی اگزوز بررسی شوند.",
    status: "تاریخی",
  },
];

export const ecuParameters = [
  { label: "Engine RPM", value: "780", unit: "rpm" },
  { label: "Vehicle Speed", value: "0", unit: "km/h" },
  { label: "Coolant Temp", value: "88", unit: "°C" },
  { label: "Throttle Position", value: "12", unit: "%" },
  { label: "Intake Temp", value: "34", unit: "°C" },
  { label: "Battery Voltage", value: "13.9", unit: "V" },
  { label: "Engine Load", value: "18", unit: "%" },
  { label: "Fuel Trim", value: "+2.8", unit: "%" },
];

export const routePoints = [
  [35.7008, 51.3916],
  [35.704, 51.398],
  [35.709, 51.405],
  [35.715, 51.414],
];

export const routeHistory = [
  { id: 1, date: "امروز", start: "08:12", end: "09:36", distance: "38.6 km", duration: "1h 24m" },
  { id: 2, date: "دیروز", start: "17:05", end: "18:02", distance: "24.2 km", duration: "57m" },
  { id: 3, date: "۱۰ شهریور", start: "11:20", end: "12:14", distance: "19.8 km", duration: "54m" },
];

export const mpuEvents = [
  { id: 1, type: "لرزش", level: "عادی", time: "امروز 09:31" },
  { id: 2, type: "ضربه", level: "ثبت نشده", time: "امروز" },
  { id: 3, type: "حرکت ناگهانی", level: "کم", time: "دیروز 18:01" },
];

export const mockConnection = {
  bluetooth: { status: "متصل", quality: "سیگنال خوب" },
  wifi: { status: "آماده اتصال" },
};

export const mockNegahbanStatus = {
  online: true,
  gnss: { status: "قفل ماهواره برقرار" },
  sync: { status: "همگام‌سازی شد", lastSync: "امروز 09:40", pendingRecords: 0 },
};
