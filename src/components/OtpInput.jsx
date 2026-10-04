import { useRef, useState } from "react";
import { OTP_LENGTH } from "../config/auth";

export default function OtpInput({ onChange, onComplete }) {
  const length = OTP_LENGTH;
  const [digits, setDigits] = useState(() => Array(length).fill(""));
  const inputsRef = useRef([]);

  const emit = (next) => {
    const code = next.join("");
    onChange?.(code);
    if (next.every(Boolean)) onComplete?.(code);
  };

  const handleChange = (index, rawValue) => {
    const value = rawValue.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    emit(next);

    if (value && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
      inputsRef.current[index + 1]?.select();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      inputsRef.current[index - 1]?.select();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;

    const next = Array(length).fill("");
    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });

    setDigits(next);
    emit(next);
    inputsRef.current[Math.min(pasted.length, length) - 1]?.focus();
  };

  return (
    <div
      className="otp-row"
      style={{ "--otp-length": length }}
      onPaste={handlePaste}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputsRef.current[index] = el; }}
          className="otp"
          value={digit}
          maxLength={1}
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
