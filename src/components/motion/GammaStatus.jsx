export default function GammaStatus({ status = "online", label = "آنلاین", className = "" }) {
  const normalized = ["online", "warning", "offline"].includes(status) ? status : "offline";
  return <span className={`gamma-status gamma-status--${normalized} ${className}`.trim()}><span className="gamma-status__dot" aria-hidden="true" /><span>{label}</span></span>;
}
