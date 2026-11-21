import { useEffect, useRef, useState } from "react";
import { updateBlocked } from "../hooks/useUpdateBlocker";
import { readRelease, releaseUrl, RELEASE_QUERY } from "../utils/release.mjs";

const currentRelease = __GAMMA_RELEASE__;

export default function ReleaseUpdate() {
  const [available, setAvailable] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const changedControls = useRef(new Set());
  const editRevision = useRef(0);

  useEffect(() => {
    if (currentRelease === "development") return;
    // A cache-busting navigation is performed only by the update button.
    // A stale response must show an error, never trigger another reload.
    const url = new URL(window.location.href);
    const requested = url.searchParams.get(RELEASE_QUERY);
    if (requested === currentRelease) {
      url.searchParams.delete(RELEASE_QUERY);
      window.history.replaceState(window.history.state, "", url);
    } else if (requested) {
      setMessage("دریافت نسخهٔ جدید کامل نشد. کمی بعد دوباره تلاش کنید.");
    }
    let disposed = false;
    let pending = false;
    const check = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const release = await readRelease();
        if (!disposed) {
          setAvailable(release !== currentRelease ? release : "");
          if (release === currentRelease) setMessage("");
        }
      } catch { /* Offline or a failed check must not interrupt the current app. */ }
      finally { pending = false; }
    };
    const edit = (event) => {
      if (event.target.matches?.("input, textarea, select, [contenteditable='true']")) {
        changedControls.current.add(event.target);
        editRevision.current += 1;
      }
    };
    check();
    const timer = window.setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    document.addEventListener("input", edit, true);
    document.addEventListener("change", edit, true);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener("input", edit, true);
      document.removeEventListener("change", edit, true);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);

  const update = async () => {
    if (busy) return;
    if (updateBlocked()) {
      setMessage("ابتدا محدودهٔ در حال ویرایش را ذخیره یا پاک کنید و منتظر پایان ذخیره بمانید.");
      return;
    }
    const edits = [...changedControls.current].some((control) => control.isConnected);
    if (edits && !window.confirm("با به‌روزرسانی، اطلاعات ذخیره‌نشدهٔ فرم‌ها از بین می‌رود. آیا ذخیره کرده‌اید و آمادهٔ به‌روزرسانی هستید؟")) return;
    setBusy(true);
    const revision = editRevision.current;
    setMessage("");
    try {
      // Recheck on click: a deploy or rollback may have happened since the prompt.
      const release = await readRelease();
      if (release === currentRelease) { setAvailable(""); return; }
      // Confirm a new HTML document is reachable before leaving a working session.
      const target = releaseUrl(window.location.href, release);
      const response = await fetch(target, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("HTML unavailable");
      const html = new DOMParser().parseFromString(await response.text(), "text/html");
      if (html.querySelector('meta[name="gamma-release"]')?.content !== release) throw new Error("HTML release mismatch");
      // Edits may have started while the network request was pending.
      if (updateBlocked() || editRevision.current !== revision) throw new Error("Edits active");
      window.location.replace(target);
    } catch {
      setMessage("به‌روزرسانی انجام نشد؛ اتصال و ذخیرهٔ فرم یا محدوده را بررسی کنید و دوباره تلاش کنید.");
    } finally { setBusy(false); }
  };

  if (!available && !message) return null;
  return <aside className="release-update" dir="rtl" aria-label="به‌روزرسانی برنامه">
    {available && <><strong role="status">نسخهٔ جدید آماده است</strong><p>پس از ذخیرهٔ کارها، برنامه را به‌روزرسانی کنید.</p>
      <button type="button" className="primary-btn" disabled={busy} onClick={update}>{busy ? "در حال بررسی…" : "به‌روزرسانی"}</button></>}
    {message && <p role="alert">{message}</p>}
  </aside>;
}
