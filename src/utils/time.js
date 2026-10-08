const faNumber = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

export function formatAge(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return "—";
  const value = Math.max(0, Number(seconds));
  if (value < 45) return "لحظاتی پیش";
  if (value < 3600) return `${faNumber.format(Math.round(value / 60))} دقیقه پیش`;
  if (value < 86400) return `${faNumber.format(Math.round(value / 3600))} ساعت پیش`;
  return `${faNumber.format(Math.round(value / 86400))} روز پیش`;
}

export function secondsBetween(later, earlier) {
  const a = Date.parse(later);
  const b = Date.parse(earlier);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((a - b) / 1000));
}

export function formatDateTime(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  return new Date(time).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(Number(value));
}
