// @ts-check
import { useEffect, useRef, useState } from "react";

/**
 * Leaflet map for real device positions only. The map is created once and the
 * marker/route are updated in place, so new positions move the view smoothly.
 * @param {{location: {latitude:number, longitude:number} | null, points?: Array<{latitude:number, longitude:number}>, stale?: boolean, height?: number}} props
 */
export default function DeviceMap({ location, points = [], stale = false, height }) {
  const container = useRef(/** @type {HTMLDivElement | null} */ (null));
  const view = useRef(/** @type {any} */ (null));
  const [error, setError] = useState("");
  const latest = useRef({ location, points, stale });
  latest.current = { location, points, stale };

  useEffect(() => {
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !container.current || view.current) return;
      const map = L.map(container.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on("tileerror", () => { if (!disposed) setError("بارگذاری کاشی‌های نقشه ناموفق بود؛ اتصال اینترنت را بررسی کنید."); }).addTo(map);
      view.current = { L, map, marker: null, line: null };
      setError("");
      const now = latest.current;
      update(view.current, now.location, now.points, now.stale, true);
    }).catch(() => { if (!disposed) setError("بارگذاری نقشه ناموفق بود."); });
    return () => {
      disposed = true;
      view.current?.map.remove();
      view.current = null;
    };
    // The map instance is created once per mount; later updates reuse it.
  }, []);

  useEffect(() => {
    if (view.current) update(view.current, location, points, stale, false);
  }, [location, points, stale]);

  return <>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div ref={container} className="map-wrap device-map" style={height ? { height } : undefined} aria-label="نقشه آخرین موقعیت دستگاه" />
  </>;
}

function update(view, location, points, stale, first) {
  const { L, map } = view;
  const path = points.map((point) => [point.latitude, point.longitude]);
  if (view.line) { view.line.remove(); view.line = null; }
  if (path.length > 1) view.line = L.polyline(path, { color: "#ff6b1a", weight: 3, opacity: 0.75 }).addTo(map);
  if (view.marker) { view.marker.remove(); view.marker = null; }
  if (location) {
    const point = [location.latitude, location.longitude];
    view.marker = L.circleMarker(point, {
      radius: 10, color: "#fff", weight: 2, fillColor: stale ? "#8b8e95" : "#ff6b1a", fillOpacity: 1,
    }).addTo(map).bindTooltip(stale ? "آخرین موقعیت (قدیمی)" : "آخرین موقعیت");
    if (first || map.getZoom() < 10) map.setView(point, 15); else map.panTo(point);
  } else if (first) {
    map.setView([32.4, 53.7], 5);
  }
  map.invalidateSize();
}
