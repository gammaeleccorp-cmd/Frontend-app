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
