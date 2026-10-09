const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function telemetryTime(record) {
  const value = record?.received_at || record?.recorded_at;
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

export function isTelemetryFresh(record, now = Date.now()) {
  const time = telemetryTime(record);
  return time !== null && time <= now + 30_000 && now - time <= ONLINE_WINDOW_MS;
}

export function formatTelemetryTime(value) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" }).format(time)
    : "—";
}

export function coordinates(record) {
  const latitude = Number(record?.latitude);
  const longitude = Number(record?.longitude);
  if (record?.latitude == null || record?.longitude == null ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      (latitude === 0 && longitude === 0)) return null;
  return [latitude, longitude];
}

export function normalizeTelemetryHistory(records = []) {
  const positioned = (Array.isArray(records) ? records : [])
    .filter((record) => coordinates(record))
    .sort((a, b) => (telemetryTime(a) ?? 0) - (telemetryTime(b) ?? 0));

  return {
    routePoints: positioned.map((record) => coordinates(record)),
    routeHistory: positioned.slice().reverse().map((record, index) => ({
      id: record.id ?? `${record.recorded_at || "point"}-${index}`,
      date: formatTelemetryTime(record.recorded_at || record.received_at),
      recordedAt: record.recorded_at || record.received_at,
      coordinates: coordinates(record),
      speed: record.speed,
    })),
  };
}
