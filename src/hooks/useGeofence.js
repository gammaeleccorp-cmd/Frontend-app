import { useCallback, useEffect, useRef, useState } from "react";
import { getGeofence, saveGeofence, disableGeofence } from "../api/geofenceApi";
import { crossedFence } from "../utils/geofence.mjs";

export default function useGeofence(deviceCode, onTransition) {
  const [state, setState] = useState({ code: "", value: null, loading: false, error: "" });
  const sequence = useRef(0);
  const busy = useRef(false);
  const previous = useRef(null);
  const notify = useRef(onTransition);
  notify.current = onTransition;

  const refresh = useCallback(async () => {
    if (!deviceCode || busy.current) return;
    const id = ++sequence.current;
    try {
      const value = await getGeofence(deviceCode);
      if (id !== sequence.current) return;
      const old = previous.current;
      if (crossedFence(old, value)) {
        notify.current?.(value.position === "INSIDE"
          ? `دستگاه ${deviceCode} وارد محدوده شد.`
          : `دستگاه ${deviceCode} از محدوده خارج شد.`);
      }
      previous.current = value;
      setState({ code: deviceCode, value, loading: false, error: "" });
    } catch (error) {
      if (id === sequence.current) setState((s) => ({ ...s, code: deviceCode, loading: false, error: error.message || "دریافت محدوده ناموفق بود." }));
    }
  }, [deviceCode]);

  useEffect(() => {
    ++sequence.current;
    busy.current = false;
    previous.current = null;
    setState({ code: deviceCode, value: null, loading: !!deviceCode, error: "" });
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(onVisible, 30000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      ++sequence.current;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deviceCode, refresh]);

  const change = async (values) => {
    if (!deviceCode || busy.current) return false;
    busy.current = true;
    const id = ++sequence.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const value = values === null
        ? (await disableGeofence(deviceCode), { configured: true, is_active: false, position: "UNKNOWN" })
        : await saveGeofence(deviceCode, values);
      if (id !== sequence.current) return false;
      previous.current = value;
      setState({ code: deviceCode, value, loading: false, error: "" });
      return true;
    } catch (error) {
      if (id === sequence.current) setState((s) => ({ ...s, loading: false, error: error.message || "ذخیره محدوده ناموفق بود." }));
      return false;
    } finally {
      if (id === sequence.current) busy.current = false;
    }
  };

  const current = state.code === deviceCode ? state : { value: null, loading: !!deviceCode, error: "" };
  return { ...current, refresh, save: (values) => change(values), disable: () => change(null) };
}
