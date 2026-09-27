export default function GammaDoubleOrbit({ size = 48, duration = 1.1, label = "در حال اتصال", className = "" }) {
  return <span className={`gamma-double-orbit ${className}`.trim()} style={{ "--orbit-size": `${size}px`, "--orbit-duration": `${duration}s` }} role="status" aria-label={label}>
    <span className="gamma-double-orbit__outer" aria-hidden="true" /><span className="gamma-double-orbit__inner" aria-hidden="true" /><span className="gamma-double-orbit__dot" aria-hidden="true" /><span className="sr-only">{label}</span>
  </span>;
}
