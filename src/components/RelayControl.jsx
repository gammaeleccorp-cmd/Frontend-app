import { useEffect, useRef, useState } from "react";
import { Power, PowerOff } from "lucide-react";
import * as repo from "../services/gammaRepository";
import { COMMANDS, startCommand, waitForCommand } from "../services/deviceCommands";
import { useLiveDevice } from "../state/liveDevice";

const LABELS = { [COMMANDS.RELAY_ON]: "روشن‌کردن رله", [COMMANDS.RELAY_OFF]: "خاموش‌کردن رله" };
const STATE_TEXT = {
  sending: { tone: "info", text: "در حال ارسال فرمان..." },
  waiting: { tone: "info", text: "فرمان ارسال شد؛ منتظر پاسخ دستگاه..." },
  success: { tone: "success", text: "دستگاه اجرای فرمان را تأیید کرد." },
  device_error: { tone: "error", text: "دستگاه خطا گزارش کرد؛ فرمان اجرا نشد." },
  timeout: { tone: "warning", text: "دستگاه در زمان مقرر پاسخ نداد؛ نتیجه نامشخص است." },
  failed: { tone: "error", text: "ارسال فرمان به دستگاه ناموفق بود." },
};

export default function RelayControl() {
  const live = useLiveDevice();
  const [confirming, setConfirming] = useState("");
  const [active, setActive] = useState(null); // { type, outcome, message }
  const busy = active && (active.outcome === "sending" || active.outcome === "waiting");
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const send = async (type) => {
    if (busy || !live.deviceCode) return;
    setConfirming("");
    setActive({ type, outcome: "sending" });
    const api = { sendDeviceCommand: repo.sendDeviceCommand, getCommand: repo.getCommand };
    try {
      const { command, attached } = await startCommand(api, live.deviceCode, type);
      const followed = command.command_type || type;
      if (mounted.current) setActive({ type: followed, outcome: "waiting", attached });
      const final = await waitForCommand(api, command);
      if (mounted.current) setActive({ type: followed, outcome: final.outcome, attached });
    } catch (error) {
      if (mounted.current) setActive({ type, outcome: "failed", message: error?.message });
    }
  };

  const state = active ? STATE_TEXT[active.outcome] || STATE_TEXT.failed : null;
  return (
    <section className="panel relay-panel" aria-live="polite">
      <div className="section-title"><h3>کنترل رله</h3></div>
      <div className="relay-actions">
        <button type="button" className="secondary-btn" disabled={busy || !live.deviceCode} onClick={() => setConfirming(COMMANDS.RELAY_ON)}><Power size={17} /> روشن‌کردن رله</button>
        <button type="button" className="secondary-btn" disabled={busy || !live.deviceCode} onClick={() => setConfirming(COMMANDS.RELAY_OFF)}><PowerOff size={17} /> خاموش‌کردن رله</button>
      </div>
      {confirming && <div className="confirm-row" role="alertdialog" aria-label="تأیید فرمان رله">
        <span>فرمان «{LABELS[confirming]}» به دستگاه {live.deviceCode} ارسال شود؟</span>
        <div><button type="button" className="primary-btn" onClick={() => send(confirming)}>تأیید و ارسال</button><button type="button" className="link-btn" onClick={() => setConfirming("")}>انصراف</button></div>
      </div>}
      {state && <div className={`check-result ${state.tone}`} role="status">
        <strong>{LABELS[active.type] || "فرمان"}:</strong> {active.attached && active.outcome === "waiting" ? "فرمان قبلی هنوز منتظر پاسخ است؛ ارسال تکراری انجام نشد. " : ""}{active.message || state.text}
      </div>}
    </section>
  );
}
