import { Power } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import StatusBadge from "./StatusBadge";
import {
  COMMAND_CLIENT_TIMEOUT_MS,
  COMMAND_POLL_INTERVAL_MS,
  RELAY_COMMANDS,
  commandErrorMessage,
  describeCommand,
  withinCommandDeadline,
} from "../utils/commands.mjs";

const RELAY_LABEL = { ON: "روشن", OFF: "خاموش" };

/**
 * Relay output control by device code. Independent of vehicle data.
 * The relay is a switched output; its effect depends on the installation,
 * so it is never presented as starting or stopping the engine.
 */
export default function RelayControl({ deviceCode, onSend, onPoll, pollIntervalMs = COMMAND_POLL_INTERVAL_MS, clientTimeoutMs = COMMAND_CLIENT_TIMEOUT_MS }) {
  const [confirm, setConfirm] = useState(null);
  const [view, setView] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [relay, setRelay] = useState({ state: null, at: null });
  const timer = useRef(null);
  const run = useRef(0);
  const confirmRef = useRef(null);

  useEffect(() => () => { run.current += 1; window.clearTimeout(timer.current); }, []);
  useEffect(() => { if (confirm) confirmRef.current?.focus(); }, [confirm]);

  const settle = (command, id, clientTimedOut = false) => {
    if (id !== run.current) return;
    const next = describeCommand(command, { clientTimedOut });
    setView({ ...next, commandType: command?.command_type });
    if (next.pending) return;
    setBusy(false);
    setNote("");
    // Only a valid device result sets the relay state; anything else makes it unknown.
    setRelay(next.relayState ? { state: next.relayState, at: new Date() } : { state: null, at: null });
  };

  const follow = (command, id, deadline) => {
    settle(command, id);
    if (!describeCommand(command).pending) return;
    const tick = async () => {
      if (id !== run.current) return;
      if (Date.now() >= deadline) { settle(command, id, true); return; }
      try {
        command = await withinCommandDeadline(() => onPoll(command.id), deadline);
        if (id !== run.current) return;
        setNote("");
        settle(command, id);
        if (!describeCommand(command).pending) return;
      } catch (err) {
        if (id !== run.current) return;
        if (err?.clientTimedOut) { settle(command, id, true); return; }
        if (err?.status === 404) { settle(null, id, true); setError("فرمان دیگر در دسترس نیست."); return; }
        setNote("دریافت وضعیت موقتاً ممکن نشد؛ دوباره تلاش می‌شود…");
      }
      timer.current = window.setTimeout(tick, pollIntervalMs);
    };
    timer.current = window.setTimeout(tick, pollIntervalMs);
  };

  const send = async (commandType) => {
    setConfirm(null);
    setError("");
    setNote("");
    setBusy(true);
    window.clearTimeout(timer.current);
    const id = ++run.current;
    const deadline = Date.now() + clientTimeoutMs;
    setView({ ...describeCommand(null), commandType });
    try {
      const { command, existing } = await withinCommandDeadline(() => onSend(deviceCode, commandType), deadline);
      if (id !== run.current) return;
      if (existing) setNote(`فرمان قبلی («${RELAY_COMMANDS[command.command_type] || "رله"}») هنوز منتظر پاسخ است؛ نتیجهٔ همان دنبال می‌شود.`);
      follow(command, id, deadline);
    } catch (err) {
      if (id !== run.current) return;
      if (err?.clientTimedOut) { settle({ command_type: commandType, outcome: "sending" }, id, true); return; }
      setBusy(false);
      setView(null);
      setError(err?.status === -1 ? err.message : commandErrorMessage(err));
    }
  };

  const relayText = relay.state
    ? `${RELAY_LABEL[relay.state]} — طبق پاسخ دستگاه، ${relay.at.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`
    : "نامشخص";

  return <section className="panel relay-control" aria-labelledby="relay-title">
    <div className="section-title">
      <div className="mini-heading no-margin"><Power size={20} aria-hidden="true" /><strong id="relay-title">کنترل رله</strong></div>
      <StatusBadge tone={relay.state ? "success" : "warning"}>وضعیت رله: {relay.state ? RELAY_LABEL[relay.state] : "نامشخص"}</StatusBadge>
    </div>
    <p className="muted compact">رله یک خروجی کلیدی دستگاه است و اثر آن به نحوهٔ نصب بستگی دارد؛ این فرمان لزوماً به معنی روشن یا خاموش شدن موتور نیست.</p>
    <p className="relay-state" aria-live="polite">آخرین وضعیت تأییدشده: <strong>{relayText}</strong></p>

    {!confirm && <div className="relay-actions">
      <button type="button" className="secondary-btn" disabled={busy} onClick={() => setConfirm("RELAY_ON")}>روشن کردن رله</button>
      <button type="button" className="secondary-btn" disabled={busy} onClick={() => setConfirm("RELAY_OFF")}>خاموش کردن رله</button>
    </div>}

    {confirm && <div className="relay-confirm" role="group" aria-label="تأیید ارسال فرمان">
      <p>فرمان «{RELAY_COMMANDS[confirm]}» به دستگاه <span className="mono" dir="ltr">{deviceCode}</span> ارسال شود؟</p>
      <div className="relay-actions">
        <button ref={confirmRef} type="button" className="primary-btn" onClick={() => send(confirm)}>ارسال فرمان</button>
        <button type="button" className="ghost-btn" onClick={() => setConfirm(null)}>انصراف</button>
      </div>
    </div>}

    <div aria-live="polite">
      {view && <p className={`relay-status relay-${view.tone}`} role="status">
        {view.commandType && <span className="relay-status-label">{RELAY_COMMANDS[view.commandType]}: </span>}
        {view.message}
        {view.relayState && <> وضعیت گزارش‌شده: <strong>{RELAY_LABEL[view.relayState]}</strong>.</>}
      </p>}
      {note && <p className="muted compact">{note}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}
