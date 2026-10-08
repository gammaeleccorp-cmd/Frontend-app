import { useState } from "react";
import { fromGregorianIso, JALALI_MONTHS, persianNumber, toGregorianIso } from "../utils/jalaliDate";

const currentYear = fromGregorianIso(new Date().toISOString().slice(0, 10)).year;
const years = Array.from({ length: currentYear - 1249 }, (_, index) => currentYear - index);

export default function JalaliDatePicker({ value, onChange, disabled = false, error = false, inputRef }) {
  const initial = fromGregorianIso(value);
  const [parts, setParts] = useState({ year: initial?.year || "", month: initial?.month || "", day: initial?.day || "" });
  const maxDay = parts.year && parts.month
    ? (toGregorianIso(Number(parts.year), Number(parts.month), 31) ? 31 : toGregorianIso(Number(parts.year), Number(parts.month), 30) ? 30 : 29)
    : 31;

  const update = (key, raw) => {
    const next = { ...parts, [key]: raw ? Number(raw) : "" };
    if (next.day && next.year && next.month && !toGregorianIso(Number(next.year), Number(next.month), Number(next.day))) next.day = "";
    setParts(next);
    onChange(next.year && next.month && next.day ? toGregorianIso(Number(next.year), Number(next.month), Number(next.day)) : "");
  };

  return <div className="jalali-picker" role="group" aria-label="تاریخ تولد به تقویم شمسی">
    <select ref={inputRef} aria-label="سال تولد" value={parts.year} onChange={(event) => update("year", event.target.value)} aria-invalid={error} disabled={disabled}>
      <option value="">سال</option>{years.map((year) => <option key={year} value={year}>{persianNumber(year)}</option>)}
    </select>
    <select aria-label="ماه تولد" value={parts.month} onChange={(event) => update("month", event.target.value)} aria-invalid={error} disabled={disabled}>
      <option value="">ماه</option>{JALALI_MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
    </select>
    <select aria-label="روز تولد" value={parts.day} onChange={(event) => update("day", event.target.value)} aria-invalid={error} disabled={disabled}>
      <option value="">روز</option>{Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{persianNumber(day)}</option>)}
    </select>
    {value && <small className="field-hint">{persianNumber(parts.day)} {JALALI_MONTHS[Number(parts.month) - 1]} {persianNumber(parts.year)}</small>}
  </div>;
}
