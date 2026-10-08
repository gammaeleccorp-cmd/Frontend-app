// Keep backend route assumptions in one place.
// Once Django urls.py is final, adjust only this file.
export const endpoints = {
  auth: {
    requestOtp: "/api/v1/auth/otp/request/",
    verifyOtp: "/api/v1/auth/otp/verify/",
    refresh: "/api/v1/auth/otp/refresh/",
    me: "/api/v1/auth/otp/me/",
  },
  vehicles: {
    list: "/api/v1/vehicles/",
    detail: (vehicleId) => `/api/v1/vehicles/${vehicleId}/`,
    location: (vehicleId) => `/api/v1/vehicles/${vehicleId}/location/`,
  },
  devices: {
    list: "/api/v1/devices/",
    validate: "/api/v1/devices/validate/",
    activate: "/api/v1/devices/activate/",
  },
  telemetry: {
    latest: (vehicleId) => `/api/v1/telemetry/vehicles/${vehicleId}/latest/`,
    history: (vehicleId) => `/api/v1/telemetry/vehicles/${vehicleId}/history/`,
    deviceLatest: (deviceCode) => `/api/v1/telemetry/devices/${encodeURIComponent(deviceCode)}/latest/`,
    deviceHistory: (deviceCode) => `/api/v1/telemetry/devices/${encodeURIComponent(deviceCode)}/history/`,
  },
};
