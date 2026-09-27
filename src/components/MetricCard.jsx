import { Activity, BatteryCharging, Cpu, Gauge, MapPinned, Route } from "lucide-react";

const icons = {
  gauge: Gauge,
  activity: Activity,
  cpu: Cpu,
  battery: BatteryCharging,
  pin: MapPinned,
  route: Route,
};

export default function MetricCard({ item }) {
  const Icon = icons[item.icon] ?? Gauge;
  return (
    <article className="metric-card">
      <div className="metric-icon"><Icon size={21} /></div>
      <span className="muted">{item.label}</span>
      <strong>{item.value}</strong>
      <small>{item.unit}</small>
    </article>
  );
}
