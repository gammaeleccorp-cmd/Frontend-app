import { useEffect, useRef } from "react";
import { persianNumber } from "../utils/jalaliDate";

const years = Array.from({ length: 201 }, (_, index) => 1300 + index);

export default function ProductionYearWheel({ value, onChange, disabled = false, error = false, inputRef }) {
  const wheelRef = useRef(null);
  const timerRef = useRef(null);
  const userScrolling = useRef(false);
  const initialYear = Number(value) || 1404;
  useEffect(() => {
    if (wheelRef.current) wheelRef.current.scrollTop = (initialYear - 1300) * 44;
    return () => clearTimeout(timerRef.current);
  }, []);

  const selectYear = (year) => {
    userScrolling.current = false;
    onChange(String(year));
    wheelRef.current?.scrollTo({ top: (year - 1300) * 44, behavior: "smooth" });
  };
  const onScroll = (event) => {
    if (!userScrolling.current || disabled) return;
    clearTimeout(timerRef.current);
    const wheel = event.currentTarget;
    timerRef.current = setTimeout(() => {
      onChange(String(1300 + Math.max(0, Math.min(200, Math.round(wheel.scrollTop / 44)))));
      userScrolling.current = false;
    }, 100);
  };

  return <div className="production-year-picker">
    <div ref={wheelRef} className="production-year-wheel" role="listbox" aria-label="سال تولید" aria-invalid={error} onScroll={onScroll} onWheel={() => { userScrolling.current = true; }} onTouchStart={() => { userScrolling.current = true; }} onPointerDown={() => { userScrolling.current = true; }} tabIndex={disabled ? -1 : 0} onKeyDown={(event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault(); selectYear(Math.max(1300, Math.min(1500, (Number(value) || 1404) + (event.key === "ArrowDown" ? 1 : -1))));
      }
    }}>
      <div className="production-year-spacer" aria-hidden="true" />
      {years.map((year) => <button key={year} type="button" className={String(year) === String(value) ? "selected" : ""} role="option" aria-selected={String(year) === String(value)} onClick={() => selectYear(year)} disabled={disabled}>{persianNumber(year)}</button>)}
      <div className="production-year-spacer" aria-hidden="true" />
    </div>
    <select ref={inputRef} aria-label="انتخاب سال تولید از فهرست" value={value} onChange={(event) => selectYear(Number(event.target.value))} aria-invalid={error} disabled={disabled}>
      <option value="">انتخاب سال از فهرست</option>
      {years.map((year) => <option key={year} value={year}>{persianNumber(year)}</option>)}
    </select>
  </div>;
}
