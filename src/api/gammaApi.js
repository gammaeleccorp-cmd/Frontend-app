import { apiRequest } from "./client";
import { endpoints } from "../config/endpoints";

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function listVehicles() {
  return unwrapList(await apiRequest(endpoints.vehicles.list));
}

export async function getVehicle(vehicleId) {
  return apiRequest(endpoints.vehicles.detail(vehicleId));
}

export async function getLatestLocation(vehicleId, signal) {
  return apiRequest(endpoints.vehicles.location(vehicleId), { signal });
}

export async function listDevices() {
  return unwrapList(await apiRequest(endpoints.devices.list));
}

export async function validateDeviceCode(deviceCode) {
  return apiRequest(`${endpoints.devices.validate}?device_code=${encodeURIComponent(deviceCode)}`, { auth: false });
}

export async function activateDevice(payload) {
  return apiRequest(endpoints.devices.activate, { method: "POST", body: payload });
}

export async function getTelemetryHistory(vehicleId) {
  return unwrapList(await apiRequest(endpoints.telemetry.history(vehicleId)));
}

export async function getLatestTelemetry(vehicleId) {
  return apiRequest(endpoints.telemetry.latest(vehicleId));
}

export async function updateVehicle(vehicleId, changes) {
  return apiRequest(endpoints.vehicles.detail(vehicleId), { method: "PATCH", body: changes });
}
