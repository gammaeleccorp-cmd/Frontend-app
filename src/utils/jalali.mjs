import { normalizeDigits } from "./validation.js";

const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});

function persianParts(date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return [Number(parts.year), Number(parts.month), Number(parts.day)];
}

export function jalaliToIso(value) {
  const text = normalizeDigits(value).trim();
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return "";
  const [year, month, day] = text.split("/").map(Number);
  if (year < 1250 || year > 1500 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const target = year * 10000 + month * 100 + day;
  let low = Math.floor(Date.UTC(year + 620, 0, 1) / 86400000);
  let high = Math.floor(Date.UTC(year + 623, 0, 1) / 86400000);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const [y, m, d] = persianParts(new Date(middle * 86400000));
    const current = y * 10000 + m * 100 + d;
    if (current === target) {
      const iso = new Date(middle * 86400000).toISOString().slice(0, 10);
      return iso <= new Date().toISOString().slice(0, 10) ? iso : "";
    }
    if (current < target) low = middle + 1;
    else high = middle - 1;
  }
  return "";
}

export function isoToJalali(value) {
  const time = value ? Date.parse(`${value}T00:00:00Z`) : NaN;
  if (!Number.isFinite(time)) return "";
  return persianParts(new Date(time)).map((part, index) => String(part).padStart(index ? 2 : 4, "0")).join("/");
}
