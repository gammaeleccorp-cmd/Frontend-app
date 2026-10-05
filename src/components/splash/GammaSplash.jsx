import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import GammaMark from "../brand/GammaMark";
import GammaOrbit from "../motion/GammaOrbit";

const HOLD_MS = 1500;
const FADE_MS = 300;
const REDUCED_HOLD_MS = 120;
const REDUCED_FADE_MS = 160;

export default function GammaSplash({ onReveal, onFinish }) {
  const reduced = useReducedMotion();
  const [fading, setFading] = useState(false);
  const callbacks = useRef({ onReveal, onFinish });
  callbacks.current = { onReveal, onFinish };

  useEffect(() => {
    const revealTimer = window.setTimeout(() => {
      setFading(true);
      callbacks.current.onReveal?.();
    }, reduced ? REDUCED_HOLD_MS : HOLD_MS);
    const finishTimer = window.setTimeout(
      () => callbacks.current.onFinish?.(),
      reduced ? REDUCED_HOLD_MS + REDUCED_FADE_MS : HOLD_MS + FADE_MS
    );

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(finishTimer);
    };
  }, [reduced]);

  return (
    <div className={`gs-root${fading ? " is-fading" : ""}${reduced ? " is-reduced" : ""}`} role="status" aria-label="در حال بارگذاری گاما">
      <div className="gs-stage">
        <GammaMark className="gs-mark" />
        <GammaOrbit size={42} duration={1.8} label="در حال بارگذاری گاما" className="gs-orbit" />
        <p className="gs-title" dir="ltr">GAMMA VEHICLE SYSTEM</p>
      </div>
    </div>
  );
}
