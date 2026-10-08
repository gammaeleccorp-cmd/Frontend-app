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

export async function getDeviceStatus(deviceCode, signal) {
  return apiRequest(endpoints.devices.status(deviceCode), { signal });
}

export async function getDeviceTelemetry(deviceCode, signal) {
  return unwrapList(await apiRequest(`${endpoints.devices.telemetry(deviceCode)}?limit=200`, { signal }));
}

export async function createDeviceCommand(deviceCode, commandType) {
  return apiRequest(endpoints.commands.create, {
    method: "POST",
    body: { device_code: deviceCode, command_type: commandType },
  });
}

export async function getCommand(commandId, signal) {
  return apiRequest(endpoints.commands.detail(commandId), { signal });
}

export async function listNotifications(signal) {
  return apiRequest(endpoints.notifications.list, { signal });
}

export async function markNotificationsRead() {
  return apiRequest(endpoints.notifications.read, { method: "POST" });
}
