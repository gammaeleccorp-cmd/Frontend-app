import { asciiDigits } from "./deviceCode.js";

const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});

export const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const persianNumber = (value) => new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);

function jalaliParts(date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return { year: Number(asciiDigits(parts.year)), month: Number(asciiDigits(parts.month)), day: Number(asciiDigits(parts.day)) };
}

export function fromGregorianIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : jalaliParts(date);
}

export function toGregorianIso(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 1250 || year > 1500 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  let low = Math.floor(Date.UTC(year + 620, 0, 1) / 86400000);
  let high = Math.floor(Date.UTC(year + 623, 0, 1) / 86400000);
  const target = year * 10000 + month * 100 + day;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const parts = jalaliParts(new Date(middle * 86400000));
    const found = parts.year * 10000 + parts.month * 100 + parts.day;
    if (found === target) return new Date(middle * 86400000).toISOString().slice(0, 10);
    if (found < target) low = middle + 1;
    else high = middle - 1;
  }
  return "";
}

export function parseJalaliBirthDate(value) {
  const text = asciiDigits(value).trim();
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return '';
  const iso = toGregorianIso(...text.split('/').map(Number));
  return iso && iso <= new Date().toISOString().slice(0, 10) ? iso : '';
}
