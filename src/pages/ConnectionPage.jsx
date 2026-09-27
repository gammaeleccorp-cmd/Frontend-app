import { Bluetooth, RefreshCw, Wifi } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import GammaDoubleOrbit from "../components/motion/GammaDoubleOrbit";
import GammaStatus from "../components/motion/GammaStatus";
import * as repo from "../services/gammaRepository";

export default function ConnectionPage({ connection, onChange, onNotify, onBack }) {
  const [busy, setBusy] = useState("");
  const run = async (type, action) => { setBusy(`${type}-${action}`); try { onChange({ ...connection, [type]: await action(type) }); } catch { onNotify("عملیات اتصال ناموفق بود."); } finally { setBusy(""); } };
  return <section className="page-section"><PageHeader eyebrow="CONNECTION" title="اتصال دستگاه" subtitle="مدیریت اتصال Bluetooth و Wi‑Fi لومینن" onBack={onBack} /><div className="connection-grid"><ConnectionControl type="bluetooth" title="Bluetooth" icon={<Bluetooth />} value={connection?.bluetooth} busy={busy} onAction={run} /><ConnectionControl type="wifi" title="Wi‑Fi" icon={<Wifi />} value={connection?.wifi} busy={busy} onAction={run} /></div></section>;
}

function ConnectionControl({ type, title, icon, value = {}, busy, onAction }) {
  const connected = value.status === "متصل"; const failed = value.status === "خطا"; const scanning = busy === `${type}-scan`; const action = failed ? "retry" : connected ? "disconnect" : "connect";
  return <article className="panel connection-control"><div className="mini-heading">{icon}<strong>{title}</strong>{busy === `${type}-${action}` || scanning ? <GammaDoubleOrbit size={28} label="در حال اتصال" /> : null}<GammaStatus status={connected ? "online" : failed ? "warning" : "offline"} label={scanning ? "در حال جست‌وجو" : value.status || "قطع‌شده"} /></div><p className={failed ? "error-text" : "muted"}>{failed ? "اتصال با خطا مواجه شد." : value.quality || "وضعیت اتصال دستگاه"}</p><div className="connection-actions"><button type="button" className="secondary-btn" disabled={Boolean(busy)} onClick={() => onAction(type, repo.scanConnection)}><RefreshCw size={16} className={scanning ? "spin" : ""} /> اسکن</button><button type="button" className={connected ? "ghost-btn" : "primary-btn"} disabled={Boolean(busy)} onClick={() => onAction(type, failed ? repo.retryConnection : connected ? repo.disconnectConnection : repo.connectConnection)}>{busy === `${type}-${action}` ? "در حال اتصال..." : failed ? "تلاش مجدد" : connected ? "قطع اتصال" : "اتصال"}</button></div></article>;
}
