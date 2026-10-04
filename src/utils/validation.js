const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

export function isValidIranianNationalId(value) {
  const nationalId = normalizeDigits(value);
  if (!/^\d{10}$/.test(nationalId) || /^([0-9])\1{9}$/.test(nationalId)) return false;

  const sum = nationalId.slice(0, 9).split("").reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const remainder = sum % 11;
  const expectedCheckDigit = remainder < 2 ? remainder : 11 - remainder;
  return Number(nationalId[9]) === expectedCheckDigit;
}
