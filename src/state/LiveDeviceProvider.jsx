import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as repo from "../services/gammaRepository";
import { LiveDeviceContext } from "./liveDevice";

// Polls the existing REST status endpoint; no new transport is introduced.
export default function LiveDeviceProvider({ deviceCode, refreshSeconds, children }) {
  const [state, setState] = useState({ status: null, route: [], loading: Boolean(deviceCode), error: "", fetchedAt: 0 });
  const inFlight = useRef(null);
  const [now, setNow] = useState(Date.now);

  // Expire cached online status even when polling is disabled or fails.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    if (!deviceCode) return null;
    if (inFlight.current) return inFlight.current;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true }));
    inFlight.current = Promise.all([
      repo.getDeviceStatus(deviceCode, controller.signal),
      repo.getDeviceRoute(deviceCode, controller.signal).catch(() => null),
    ])
      .then(([status, route]) => {
        setState((current) => ({ status, route: route ?? current.route, loading: false, error: "", fetchedAt: Date.now() }));
        return status;
      })
      .catch((error) => {
        setState((current) => ({ ...current, loading: false, error: error?.message || "دریافت وضعیت دستگاه ناموفق بود." }));
        return null;
      })
      .finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [deviceCode]);

  useEffect(() => {
    setState({ status: null, route: [], loading: Boolean(deviceCode), error: "", fetchedAt: 0 });
    refresh();
  }, [deviceCode, refresh]);

  useEffect(() => {
    if (!deviceCode || !refreshSeconds) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, refreshSeconds * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [deviceCode, refreshSeconds, refresh]);

  const value = useMemo(() => ({ ...state, refresh, deviceCode, now }), [state, refresh, deviceCode, now]);
  return <LiveDeviceContext.Provider value={value}>{children}</LiveDeviceContext.Provider>;
}
