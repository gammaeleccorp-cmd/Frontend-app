// @ts-check
import { useEffect, useRef, useState } from "react";
import { getLatestLocation } from "../services/gammaRepository";

/** @typedef {{latitude: number, longitude: number, recorded_at: string, speed: number | null, device_serial: string}} VehicleLocationData */
/** @param {{vehicleId?: string}} props */
export default function VehicleLocation({ vehicleId }) {
  const [state, setState] = useState(/** @type {{loading: boolean, location: VehicleLocationData | null, error: string}} */ ({ loading: true, location: null, error: "" }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, location: null, error: "" });
    getLatestLocation(vehicleId, controller.signal)
      .then((location) => {
        if (controller.signal.aborted) return;
        if (location !== null && (
          !Number.isFinite(location?.latitude) || Math.abs(location.latitude) > 90 ||
          !Number.isFinite(location?.longitude) || Math.abs(location.longitude) > 180
        )) throw new Error("مختصات دریافتی معتبر نیست.");
        setState({ loading: false, location, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, location: null, error: error.message || "دریافت موقعیت ناموفق بود." });
        }
      });
    return () => controller.abort();
  }, [vehicleId, attempt]);

  const { loading, location, error } = state;
  return (
    <section className="panel map-panel" aria-label="آخرین موقعیت خودرو" aria-busy={loading}>
      <div className="section-title">
        <h3>آخرین موقعیت خودرو</h3>
        <button type="button" className="secondary-btn" disabled={loading} onClick={() => setAttempt((value) => value + 1)}>
          {error ? "تلاش مجدد" : "به‌روزرسانی"}
        </button>
      </div>
      {loading && <p className="muted" role="status">در حال دریافت موقعیت...</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      {!loading && !error && !location && <p className="muted" role="status">هنوز موقعیتی برای این خودرو ثبت نشده است.</p>}
      {location && <>
        <LocationMap key={`${location.latitude},${location.longitude},${attempt}`} location={location} />
        <div className="status-list">
          <div className="status-line"><span>آخرین به‌روزرسانی</span><time dateTime={location.recorded_at}>{new Date(location.recorded_at).toLocaleString("fa-IR")}</time></div>
          <div className="status-line"><span>سرعت</span><span dir="ltr">{location.speed ?? "—"} km/h</span></div>
          <div className="status-line"><span>شناسه دستگاه</span><span className="mono">{location.device_serial}</span></div>
        </div>
      </>}
    </section>
  );
}

/** @param {{location: VehicleLocationData}} props */
function LocationMap({ location }) {
  const container = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    /** @type {import("leaflet").Map | undefined} */
    let map;
    // Effects run only on the client: Leaflet must never evaluate during SSR.
    import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      /** @type {import("leaflet").LatLngTuple} */
      const point = [location.latitude, location.longitude];
      map = L.map(container.current, { scrollWheelZoom: false }).setView(point, 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).on("tileerror", () => {
        if (!disposed) setError("بارگذاری نقشه ناموفق بود. اتصال اینترنت را بررسی کنید.");
      }).addTo(map);
      L.circleMarker(point, { radius: 10, color: "#fff", weight: 2, fillColor: "#f39a46", fillOpacity: 1 })
        .addTo(map).bindTooltip("آخرین موقعیت خودرو");
      setLoading(false);
    }).catch(() => {
      if (!disposed) { setLoading(false); setError("بارگذاری نقشه ناموفق بود."); }
    });
    return () => { disposed = true; map?.remove(); };
  }, [location.latitude, location.longitude]);

  return <>
    {loading && <p className="muted" role="status">در حال بارگذاری نقشه...</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
    <div ref={container} className="map-wrap vehicle-location-map" aria-label="نقشه موقعیت خودرو" />
  </>;
}
