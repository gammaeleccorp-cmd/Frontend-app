import { useEffect, useRef, useState } from "react";
import { Radar } from "lucide-react";
import * as repo from "../services/gammaRepository";
import { CHECK_MESSAGES, createCheckLimiter, describeCheckResult, runConnectionCheck } from "../services/deviceCommands";
import { useLiveDevice } from "../state/liveDevice";

// Shared across pages: limits repeated checks for the whole app session.
const limiter = createCheckLimiter();
let running = false;

export default function ConnectionCheck() {
  const live = useLiveDevice();
  const [phase, setPhase] = useState("");
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const run = async () => {
    if (running || !live.deviceCode) return;
    const allowed = limiter.check();
    if (!allowed.ok) { setNotice(`برای جلوگیری از درخواست تکراری، ${allowed.waitSeconds.toLocaleString("fa-IR")} ثانیه دیگر دوباره تلاش کنید.`); return; }
    running = true;
    limiter.record();
    setNotice(""); setResult(null);
    try {
      const outcome = await runConnectionCheck(
        { sendDeviceCommand: repo.sendDeviceCommand, getCommand: repo.getCommand, getDeviceStatus: repo.getDeviceStatus },
        live.deviceCode,
        { onPhase: (next) => mounted.current && setPhase(next) },
      );
      if (mounted.current) setResult(outcome);
    } catch (error) {
      if (mounted.current) setResult({ kind: "send_failed", message: error?.message });
    } finally {
      running = false;
      if (mounted.current) setPhase("");
      live.refresh();
    }
  };

  const message = describeCheckResult(result);
  const busy = Boolean(phase);
  return (
    <section className="panel connection-check" aria-live="polite">
      <div className="mini-heading"><Radar size={20} /><strong>بررسی اتصال و موقعیت</strong></div>
      <p className="muted">ابتدا PING و در صورت پاسخ، درخواست موقعیت به دستگاه ارسال می‌شود.</p>
      <button type="button" className="primary-btn full-btn" onClick={run} disabled={busy || !live.deviceCode}>
        {busy ? "در حال بررسی..." : "بررسی اتصال و دریافت موقعیت"}
      </button>
      {busy && <p className="check-phase" role="status"><span className="spinner-dot" aria-hidden="true" />{CHECK_MESSAGES[phase]}</p>}
      {message && <div className={`check-result ${message.tone}`} role="status">{message.text}</div>}
      {notice && <p className="muted small-text" role="status">{notice}</p>}
    </section>
  );
}
