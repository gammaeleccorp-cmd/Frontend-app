// Device command result handling. Success is only a COMPLETED command whose
// server-side outcome is "success"; SENT / ACKNOWLEDGED are never final.

export const COMMAND_POLL_INTERVAL_MS = 2000;
// Backend expires in-flight commands after 60 s; keep a margin for polling.
export const COMMAND_CLIENT_TIMEOUT_MS = 75_000;
export const RELAY_COMMANDS = { RELAY_ON: "روشن کردن رله", RELAY_OFF: "خاموش کردن رله" };

/** Keep the overall deadline even when a send or poll request never resolves. */
export async function withinCommandDeadline(request, deadline) {
  const timeout = () => Object.assign(new Error("Command response timed out."), { clientTimedOut: true });
  let timer;
  try {
    if (Date.now() >= deadline) throw timeout();
    const response = await Promise.race([
      request(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(timeout()), deadline - Date.now()); }),
    ]);
    if (Date.now() >= deadline) throw timeout();
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/** Real relay state only from a successful relay result: "ON" | "OFF" | null. */
export function relayStateFromCommand(command) {
  if (!command || command.status !== "COMPLETED" || command.outcome !== "success" || !(command.command_type in RELAY_COMMANDS)) return null;
  const result = command.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const text = typeof result.relay === "string" ? result.relay.trim().toUpperCase() : "";
  if (text === "ON" || text === "OFF") return text;
  if (result.relay_state === 1) return "ON";
  if (result.relay_state === 0) return "OFF";
  return null;
}

export function isCommandPending(command) {
  return phaseOf(command) === "sending" || phaseOf(command) === "waiting" || phaseOf(command) === "acknowledged";
}

function phaseOf(command) {
  if (!command) return "sending";
  const outcome = command.outcome;
  if (outcome === "sending") return "sending";
  if (outcome === "waiting") return command.status === "ACKNOWLEDGED" ? "acknowledged" : "waiting";
  if (outcome === "success") return command.status === "COMPLETED" ? "success" : "unknown";
  if (["device_error", "failed", "timeout"].includes(outcome)) return outcome;
  return "unknown";
}

/** UI description of a command: { phase, tone, message, relayState, mismatch, pending }. */
export function describeCommand(command, { clientTimedOut = false } = {}) {
  let phase = phaseOf(command);
  const pending = ["sending", "waiting", "acknowledged"].includes(phase);
  if (pending && clientTimedOut) phase = "client_timeout";
  const relayState = relayStateFromCommand(command);
  const expected = command?.command_type === "RELAY_ON" ? "ON" : command?.command_type === "RELAY_OFF" ? "OFF" : null;
  const mismatch = Boolean(relayState && expected && relayState !== expected);
  const messages = {
    sending: ["info", "در حال ارسال فرمان…"],
    waiting: ["info", "فرمان ارسال شد؛ منتظر پاسخ دستگاه…"],
    acknowledged: ["info", "دستگاه دریافت فرمان را اعلام کرد؛ منتظر نتیجهٔ نهایی…"],
    success: relayState
      ? [mismatch ? "warning" : "success", mismatch ? "دستگاه پاسخ داد، اما وضعیت گزارش‌شده با فرمان درخواستی یکسان نیست." : "دستگاه انجام فرمان را تأیید کرد."]
      : ["warning", "دستگاه پاسخ موفق داد، اما وضعیت رله را گزارش نکرد."],
    device_error: ["error", "دستگاه خطا گزارش کرد؛ فرمان انجام نشد."],
    failed: ["error", "ارسال فرمان به دستگاه ناموفق بود."],
    timeout: ["error", "در مهلت مقرر پاسخی از دستگاه دریافت نشد. وضعیت رله نامشخص است."],
    client_timeout: ["error", "پاسخی دریافت نشد. وضعیت رله نامشخص است؛ چند لحظه بعد دوباره بررسی کنید."],
    unknown: ["warning", "نتیجهٔ فرمان قابل تأیید نیست. وضعیت رله نامشخص است."],
  };
  const [tone, message] = messages[phase];
  return { phase, tone, message, relayState, mismatch, pending: pending && !clientTimedOut };
}

/** Customer-facing text for a failed create request (no raw HTTP codes). */
export function commandErrorMessage(error) {
  switch (error?.status) {
    case 404: return "این دستگاه برای حساب شما پیدا نشد.";
    case 400: return "این فرمان برای دستگاه شما مجاز نیست.";
    case 429: return "تعداد فرمان‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.";
    case 503: return "ارسال فرمان به دستگاه ممکن نشد؛ کمی بعد دوباره تلاش کنید.";
    case 0: return "ارتباط با سرور برقرار نشد؛ اینترنت را بررسی کنید.";
    default: return error?.message && !/\d{3}/.test(error.message) ? error.message : "ارسال فرمان ناموفق بود.";
  }
}
