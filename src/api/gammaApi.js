import { paginatedHistory } from "../utils/paginatedHistory.mjs";
import { runtime } from "../config/runtime";
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
  return paginatedHistory(endpoints.telemetry.history(vehicleId), apiRequest, runtime.apiBaseUrl);
}

export async function getLatestTelemetry(vehicleId) {
  return apiRequest(endpoints.telemetry.latest(vehicleId));
}

export async function getDeviceTelemetryHistory(deviceCode, { start, end, signal } = {}) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const query = params.toString();
  const path = `${endpoints.telemetry.deviceHistory(deviceCode)}${query ? `?${query}` : ""}`;
  return paginatedHistory(path, (page) => apiRequest(page, { signal }), runtime.apiBaseUrl);
}

export async function getLatestDeviceTelemetry(deviceCode) {
  return apiRequest(endpoints.telemetry.deviceLatest(deviceCode));
}

export async function updateVehicle(vehicleId, changes) {
  return apiRequest(endpoints.vehicles.detail(vehicleId), { method: "PATCH", body: changes });
}

export async function attachDeviceVehicle(deviceCode, payload) {
  return apiRequest(endpoints.devices.vehicle(deviceCode), { method: "POST", body: payload });
}

export async function createDeviceCommand(deviceCode, commandType) {
  return apiRequest(endpoints.commands.create, { method: "POST", body: { device_code: deviceCode, command_type: commandType } });
}

export async function getCommand(commandId) {
  return apiRequest(endpoints.commands.detail(commandId));
}

export async function getNotifications() {
  return apiRequest(endpoints.notifications.list);
}

export async function markNotificationsRead() {
  return apiRequest(endpoints.notifications.read, { method: "POST" });
}
