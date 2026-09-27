import { Bluetooth, Car, Cpu, Fingerprint, Wifi } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import VehicleLocation from "../components/VehicleLocation";
import { PRODUCTS } from "../data/mockData";

export default function VehiclePage({ product, vehicle, onBack }) {
  const luminen = product === PRODUCTS.LUMINEN;

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="VEHICLE"
        title="خودرو و دستگاه"
        subtitle="اطلاعات ثبت‌شده و وضعیت ارتباط"
        onBack={onBack}
      />

      <section className="panel vehicle-overview">
        <div className="vehicle-avatar"><Car size={36} /></div>
        <div>
          <h3>{vehicle?.name || "—"}</h3>
          <p className="muted compact">
            {vehicle?.model || "—"} • مدل {vehicle?.year || "—"}
          </p>
        </div>
        <StatusBadge tone="success">فعال</StatusBadge>
      </section>

      <section className="info-grid">
        <InfoCard icon={<Fingerprint />} label="VIN" value={vehicle?.vin || "—"} mono />
        <InfoCard icon={<Cpu />} label="Serial دستگاه" value={vehicle?.deviceSerial || "—"} mono />
        <InfoCard icon={<Car />} label="پلاک" value={vehicle?.plate || "—"} />
        <InfoCard
          icon={luminen ? <Bluetooth /> : <Wifi />}
          label="نوع دستگاه"
          value={luminen ? "Luminen OBD" : "Negahban Tracker"}
        />
      </section>

      <VehicleLocation key={vehicle?.id || "no-vehicle"} vehicleId={vehicle?.id} />

      <section className="panel">
        <div className="section-title">
          <h3>وضعیت ارتباط</h3>
          <StatusBadge tone="success">متصل</StatusBadge>
        </div>
        <div className="status-list">
          <StatusLine
            label={luminen ? "Bluetooth" : "Server Link"}
            value="متصل"
            success
          />
          <StatusLine
            label={luminen ? "Wi‑Fi" : "GNSS"}
            value={luminen ? "آماده" : "قفل ماهواره برقرار"}
            success
          />
          <StatusLine label="آخرین ارتباط" value="چند ثانیه پیش" />
        </div>
      </section>
    </section>
  );
}

function InfoCard({ icon, label, value, mono = false }) {
  return (
    <article className="info-card">
      <div className="info-icon">{icon}</div>
      <span className="muted">{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </article>
  );
}

function StatusLine({ label, value, success = false }) {
  return (
    <div className="status-line">
      <span>{label}</span>
      <span className={success ? "success-text" : "muted"}>{value}</span>
    </div>
  );
}
