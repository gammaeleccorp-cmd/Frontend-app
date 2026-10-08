import { useEffect, useRef } from "react";

export const PLATE_LETTERS = ["الف", "ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "د", "ذ", "ر", "ز", "ژ", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"];

const EMPTY_PLATE = { left: "", letter: "", middle: "", iran: "" };
const digitsOnly = (value, length) => String(value || "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[^0-9]/g, "").slice(0, length);

export function normalizePlateValue(value) {
  if (value && typeof value === "object") return { ...EMPTY_PLATE, ...value };
  const compact = String(value || "").replace(/\s/g, "").replace(/-+/g, "");
  return { left: compact.slice(0, 2), letter: "", middle: compact.slice(2, 5), iran: compact.slice(-2) };
}

export function formatPlateValue(value) {
  const plate = normalizePlateValue(value);
  return `${plate.left}${plate.letter}${plate.middle} ایران ${plate.iran}`.trim();
}

export function isCompletePlate(value) {
  const plate = normalizePlateValue(value);
  return /^\d{2}$/.test(digitsOnly(plate.left, 2)) && PLATE_LETTERS.includes(plate.letter) && /^\d{3}$/.test(digitsOnly(plate.middle, 3)) && /^\d{2}$/.test(digitsOnly(plate.iran, 2));
}

export default function PlateInput({ value, onChange, disabled = false, error = "", inputRef }) {
  const plate = normalizePlateValue(value);
  const refs = useRef([]);
  useEffect(() => { if (inputRef) inputRef.current = refs.current[0]; }, [inputRef]);

  const update = (key, nextValue, nextIndex) => {
    onChange({ ...plate, [key]: nextValue });
    if (nextIndex !== undefined && ((key === "letter" && nextValue) || (key === "left" && nextValue.length === 2) || (key === "middle" && nextValue.length === 3))) refs.current[nextIndex]?.focus({ preventScroll: true });
  };
  const onKeyDown = (index, event) => {
    if (event.key === "Backspace" && !event.currentTarget.value && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus({ preventScroll: true });
    }
  };
  const field = (key, index, maxLength, label) => (
    <input
      ref={(element) => { refs.current[index] = element; }}
      value={plate[key]}
      maxLength={maxLength}
      inputMode="numeric"
      aria-label={label}
      aria-invalid={Boolean(error)}
      onChange={(event) => update(key, digitsOnly(event.target.value, maxLength), index + 1)}
      onKeyDown={(event) => onKeyDown(index, event)}
      disabled={disabled}
      dir="ltr"
    />
  );

  return <div className="plate-input" role="group" aria-label="پلاک خودرو">
    {field("left", 0, 2, "دو رقم اول پلاک")}
    <select
      ref={(element) => { refs.current[1] = element; }}
      value={plate.letter}
      aria-label="حرف پلاک"
      aria-invalid={Boolean(error)}
      onChange={(event) => update("letter", event.target.value, 2)}
      onKeyDown={(event) => onKeyDown(1, event)}
      disabled={disabled}
    >
      <option value="">حرف</option>
      {PLATE_LETTERS.map((letter) => <option key={letter} value={letter}>{letter}</option>)}
    </select>
    {field("middle", 2, 3, "سه رقم میانی پلاک")}
    <span className="plate-iran" aria-hidden="true">ایران</span>
    {field("iran", 3, 2, "دو رقم ایران")}
  </div>;
}
