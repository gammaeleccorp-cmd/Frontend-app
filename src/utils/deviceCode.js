export function asciiDigits(value) {
  return String(value ?? "").replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

export function deviceCodeParts(value) {
  const match = /^(NG|RH|LM)-([0-9]{0,4})$/.exec(String(value ?? ""));
  return match ? { prefix: match[1], number: match[2] } : { prefix: "NG", number: "" };
}

export function normalizeDeviceCode(value) {
  const match = /^(NG|RH|LM)-([0-9]{4})$/.exec(asciiDigits(value).trim().toUpperCase().replaceAll("_", "-"));
  return match ? `${match[1]}-${match[2].padStart(4, "0")}` : "";
}
