import GammaOrbit from "./motion/GammaOrbit";

export default function StateMessage({ loading = false, error = "", message = "", onRetry }) {
  return <main className="shell center auth-shell"><section className="auth-card state-card">{loading && <GammaOrbit label={message} />}<p className={error ? "error-text" : "muted"}>{loading ? message : error}</p>{error && onRetry && <button type="button" className="primary-btn full-btn" onClick={onRetry}>تلاش مجدد</button>}</section></main>;
}
