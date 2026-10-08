import { useRef, useState } from "react";
import { OTP_GROUP_SIZE, OTP_LENGTH } from "../config/auth";
import { normalizeDigits } from "../utils/validation";

// Keep only ASCII digits (Persian/Arabic digits are converted first). The OTP
// stays a string end to end so leading zeros are never lost.
const onlyDigits = (value) => normalizeDigits(value).replace(/\D/g, "");

export default function OtpInput({ onChange, onComplete }) {
  const length = OTP_LENGTH;
  const columns = Math.min(length, OTP_GROUP_SIZE);
  const [digits, setDigits] = useState(() => Array(length).fill(""));
  const inputsRef = useRef([]);

  const emit = (next) => {
    const code = next.join("");
    onChange?.(code);
    if (next.every(Boolean)) onComplete?.(code);
  };

  const focusIndex = (index) => {
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  };

  // Fill consecutive boxes from `start` (used for paste and one-time-code autofill).
  const fillFrom = (start, value, base) => {
    const next = [...base];
    value.slice(0, length - start).split("").forEach((digit, offset) => {
      next[start + offset] = digit;
    });
    setDigits(next);
    emit(next);
    focusIndex(Math.min(start + value.length, length) - 1);
  };

  const handleChange = (index, rawValue) => {
    const clean = onlyDigits(rawValue);

    // More than "old digit + new digit" means the whole code arrived at once
    // (SMS one-time-code autofill or keyboard suggestion).
    if (clean.length > 2) {
      const start = clean.length >= length ? 0 : index;
      fillFrom(start, clean, start === 0 ? Array(length).fill("") : digits);
      return;
    }

    const value = clean.slice(-1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    emit(next);

    if (value && index < length - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      focusIndex(index - 1);
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = onlyDigits(event.clipboardData.getData("text")).slice(0, length);
    if (!pasted) return;

    fillFrom(0, pasted, Array(length).fill(""));
  };

  return (
    <div
      className="otp-row"
      style={{ "--otp-length": length, "--otp-columns": columns }}
      role="group"
      aria-label={`کد یکبار مصرف ${length} رقمی`}
      onPaste={handlePaste}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputsRef.current[index] = el; }}
          className="otp"
          dir="ltr"
          value={digit}
          maxLength={length}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`رقم ${index + 1} کد یکبار مصرف`}
          onFocus={(event) => event.target.select()}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
