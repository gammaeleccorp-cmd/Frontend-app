import { apiRequest } from "./client";

const geofenceUrl = (deviceCode) => {
  if (!/^NG-\d{4}$/.test(deviceCode || "")) {
    throw new Error("کد دستگاه معتبر نیست.");
  }

  return `/api/v1/devices/${deviceCode}/geofence/`;
};

export function getGeofence(deviceCode) {
  return apiRequest(geofenceUrl(deviceCode));
}

export function saveGeofence(deviceCode, values) {
  return apiRequest(geofenceUrl(deviceCode), {
    method: "PUT",
    body: {
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      radius_m: Number(values.radius_m),
    },
  });
}

export function disableGeofence(deviceCode) {
  return apiRequest(geofenceUrl(deviceCode), {
    method: "DELETE",
  });
}
