export default function GammaOrbit({ size = 42, duration = 1, label = "در حال بارگذاری", className = "" }) {
  return <span className={`gamma-orbit ${className}`.trim()} style={{ "--orbit-size": `${size}px`, "--orbit-duration": `${duration}s` }} role="status" aria-label={label}>
    <span className="gamma-orbit__ring" aria-hidden="true" /><span className="gamma-orbit__arc" aria-hidden="true" /><span className="sr-only">{label}</span>
  </span>;
}
