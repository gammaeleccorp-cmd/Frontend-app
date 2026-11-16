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

export async function saveGeofence(deviceCode, values) {
  const stored = await apiRequest(geofenceUrl(deviceCode), {
    method: "PUT",
    body: values.boundary_points ? { boundary_points: values.boundary_points } : { latitude: Number(values.latitude), longitude: Number(values.longitude), radius_m: Number(values.radius_m) },
  });
  if (values.boundary_points && JSON.stringify(stored?.boundary_points) !== JSON.stringify(values.boundary_points)) {
    throw new Error("ذخیره مرز انتخاب‌شده توسط سرور تأیید نشد.");
  }
  return stored;
}

export function disableGeofence(deviceCode) {
  return apiRequest(geofenceUrl(deviceCode), {
    method: "DELETE",
  });
}
