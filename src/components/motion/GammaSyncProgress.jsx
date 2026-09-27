export default function GammaSyncProgress({ progress = 0, label = "در حال همگام‌سازی", className = "" }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  return <div className={`gamma-sync ${className}`.trim()} role="status" aria-label={`${label}: ${safeProgress}%`}>
    <div className="gamma-sync__head"><span>{label}</span><strong>{safeProgress}%</strong></div>
    <div className="gamma-sync__track" aria-hidden="true"><span className="gamma-sync__fill" style={{ "--gamma-progress": `${safeProgress}%` }} /><span className="gamma-sync__pulse" style={{ "--gamma-progress": `${safeProgress}%` }} /></div>
  </div>;
}
