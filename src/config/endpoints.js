// Keep backend route assumptions in one place.
// Once Django urls.py is final, adjust only this file.
export const endpoints = {
  auth: {
    requestOtp: "/api/v1/auth/otp/request/",
    verifyOtp: "/api/v1/auth/otp/verify/",
    refresh: "/api/v1/auth/otp/refresh/",
    logout: "/api/v1/auth/otp/logout/",
    me: "/api/v1/auth/otp/me/",
    sessions: "/api/v1/auth/otp/sessions/",
    revokeOtherSessions: "/api/v1/auth/otp/sessions/revoke-others/",
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
    status: (deviceCode) => `/api/v1/devices/${encodeURIComponent(deviceCode)}/status/`,
    telemetry: (deviceCode) => `/api/v1/devices/${encodeURIComponent(deviceCode)}/telemetry/`,
  },
  commands: {
    create: "/api/v1/commands/",
    detail: (commandId) => `/api/v1/commands/${commandId}/`,
  },
  notifications: {
    list: "/api/v1/notifications/",
    read: "/api/v1/notifications/read/",
  },
  telemetry: {
    latest: (vehicleId) => `/api/v1/telemetry/vehicles/${vehicleId}/latest/`,
    history: (vehicleId) => `/api/v1/telemetry/vehicles/${vehicleId}/history/`,
  },
};
