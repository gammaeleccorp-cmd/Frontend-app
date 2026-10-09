// Device command flows used by the connection check and relay controls.
// Pure functions over an injected API so they can be tested without a board.

export const COMMANDS = {
  PING: "PING",
  LOCATION: "REQUEST_LIVE_DATA",
  RELAY_ON: "RELAY_ON",
  RELAY_OFF: "RELAY_OFF",
};

export const WAITING_OUTCOMES = new Set(["sending", "waiting"]);
const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Start a command; a 409 means one is already in flight, so follow that one
// instead of sending a duplicate.
export async function startCommand(api, deviceCode, commandType) {
  try {
    return { command: await api.sendDeviceCommand(deviceCode, commandType), attached: false };
  } catch (error) {
    const pending = error?.status === 409 ? error?.payload?.command : null;
    if (pending?.id) return { command: pending, attached: true };
    throw error;
  }
}

// Poll until the server reports a terminal outcome. The server marks a command
// TIMEOUT after 60 s; the client waits a little longer and asks once more.
export async function waitForCommand(api, command, { timeoutMs = 75000, intervalMs = 2000, sleep = realSleep, now = Date.now } = {}) {
  const deadline = now() + timeoutMs;
  let current = command;
  while (WAITING_OUTCOMES.has(current?.outcome) && now() < deadline) {
    await sleep(intervalMs);
    try {
      current = await api.getCommand(current.id);
    } catch (error) {
      if (error?.status === 401 || error?.status === 404) throw error;
      // transient network error: keep waiting until the deadline
    }
  }
  if (WAITING_OUTCOMES.has(current?.outcome)) {
    try { current = await api.getCommand(current.id); } catch { /* keep last known */ }
    if (WAITING_OUTCOMES.has(current?.outcome)) current = { ...current, outcome: "timeout" };
  }
  return current;
}

const CONTAINERS = ["location", "gps", "gnss", "position", "data"];

// Mirrors the backend reading of a location answer (telemetry.services.extract_location).
export function locationFromResult(result) {
  if (!result || typeof result !== "object") return null;
  const items = [result, ...CONTAINERS.map((key) => result[key]).filter((item) => item && typeof item === "object")];
  let positional = false;
  for (const item of items) {
    const flag = ["fix", "gps_fix", "has_fix", "valid"].map((key) => item[key]).find((value) => value !== undefined && value !== null);
    const lat = Number(item.latitude ?? item.lat);
    const lon = Number(item.longitude ?? item.lon ?? item.lng);
    if (flag !== undefined || item.latitude !== undefined || item.lat !== undefined) positional = true;
    if (flag === false || ["0", "false", "no", "none", "invalid"].includes(String(flag ?? "x").trim().toLowerCase())) return { hasFix: false };
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) {
      return { hasFix: true, latitude: lat, longitude: lon };
    }
  }
  return positional ? { hasFix: false } : null;
}

function failureKind(outcome) {
  if (outcome === "timeout") return "no_response";
  if (outcome === "device_error") return "device_error";
  return "send_failed";
}

// PING first; only a valid PING answer leads to the location request. A PING
// answer alone never counts as a confirmed position.
export async function runConnectionCheck(api, deviceCode, { onPhase = () => {}, sleep = realSleep, now = Date.now, commandTimeoutMs = 75000, settleMs = 12000, intervalMs = 2000 } = {}) {
  const before = await api.getDeviceStatus(deviceCode).catch(() => null);
  const baseline = before?.location?.received_at || null;

  onPhase("ping_sending");
  let ping;
  try { ping = (await startCommand(api, deviceCode, COMMANDS.PING)).command; }
  catch (error) { return { kind: "send_failed", step: "ping", message: error?.message }; }
  onPhase("ping_waiting");
  ping = await waitForCommand(api, ping, { timeoutMs: commandTimeoutMs, intervalMs, sleep, now });
  if (ping.outcome !== "success") return { kind: failureKind(ping.outcome), step: "ping", command: ping };

  onPhase("location_sending");
  let locate;
  try { locate = (await startCommand(api, deviceCode, COMMANDS.LOCATION)).command; }
  catch (error) { return { kind: "send_failed", step: "location", message: error?.message, pingOk: true }; }
  onPhase("location_waiting");
  locate = await waitForCommand(api, locate, { timeoutMs: commandTimeoutMs, intervalMs, sleep, now });
  if (locate.outcome !== "success") {
    return { kind: locate.outcome === "timeout" ? "location_no_response" : failureKind(locate.outcome), step: "location", pingOk: true, command: locate };
  }

  // The answer may carry the fix directly or arrive as telemetry shortly after.
  onPhase("location_settling");
  const fromResult = locationFromResult(locate.result);
  const deadline = now() + (fromResult?.hasFix ? Math.min(settleMs, 4000) : settleMs);
  let status = null;
  do {
    status = await api.getDeviceStatus(deviceCode).catch(() => status);
    const received = status?.location?.received_at || null;
    if (received && received !== baseline) return { kind: "located", status, pingOk: true, command: locate };
    if (fromResult && !fromResult.hasFix) break;
    if (now() >= deadline) break;
    await sleep(intervalMs);
  } while (now() < deadline);
  return { kind: "no_gps", status, pingOk: true, command: locate, explicit: Boolean(fromResult && !fromResult.hasFix) };
}

export function createCheckLimiter({ max = 3, windowMs = 10 * 60 * 1000, cooldownMs = 20000, now = Date.now } = {}) {
  let runs = [];
  return {
    check() {
      const time = now();
      runs = runs.filter((at) => time - at < windowMs);
      const last = runs[runs.length - 1];
      if (last !== undefined && time - last < cooldownMs) return { ok: false, waitSeconds: Math.ceil((cooldownMs - (time - last)) / 1000) };
      if (runs.length >= max) return { ok: false, waitSeconds: Math.ceil((windowMs - (time - runs[0])) / 1000) };
      return { ok: true, waitSeconds: 0 };
    },
    record() { runs.push(now()); },
  };
}

export const CHECK_MESSAGES = {
  ping_sending: "در حال ارسال PING به دستگاه...",
  ping_waiting: "منتظر پاسخ PING از دستگاه...",
  location_sending: "PING پاسخ داد؛ در حال درخواست موقعیت...",
  location_waiting: "منتظر پاسخ موقعیت از دستگاه...",
  location_settling: "پاسخ دریافت شد؛ در حال به‌روزرسانی موقعیت...",
};

export function describeCheckResult(result) {
  switch (result?.kind) {
    case "located": return { tone: "success", text: "اتصال برقرار است و موقعیت جدید دریافت شد. نقشه به‌روز شد." };
    case "no_gps": return { tone: "warning", text: result.explicit ? "دستگاه پاسخ داد اما GPS هنوز موقعیت معتبر (Fix) ندارد." : "دستگاه پاسخ داد اما موقعیت جدیدی ارسال نکرد؛ احتمالاً GPS هنوز Fix ندارد." };
    case "no_response": return { tone: "error", text: "دستگاه در زمان مقرر به PING پاسخ نداد. روشن بودن، آنتن و اینترنت سیم‌کارت دستگاه را بررسی کنید." };
    case "location_no_response": return { tone: "warning", text: "PING موفق بود اما دستگاه به درخواست موقعیت در زمان مقرر پاسخ نداد." };
    case "device_error": return { tone: "error", text: result.step === "ping" ? "دستگاه به PING پاسخ خطا داد." : "PING موفق بود اما دستگاه برای موقعیت خطا گزارش کرد." };
    case "send_failed": return { tone: "error", text: result.message || "ارسال فرمان به دستگاه ناموفق بود." };
    default: return null;
  }
}
