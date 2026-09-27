import { CheckCircle2, DownloadCloud, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import GammaSyncProgress from "../components/motion/GammaSyncProgress";

export default function OtaPage({ vehicle, onCheck, onBack }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const check = async () => {
    setChecking(true);
    setError("");

    try {
      const payload = await onCheck(vehicle?.deviceId);
      setResult(payload || { upToDate: true });
    } catch (err) {
      setError(err?.message || "بررسی بروزرسانی ناموفق بود.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="FIRMWARE"
        title="بروزرسانی OTA"
        subtitle="مدیریت نسخه نرم‌افزار دستگاه لومینن"
        onBack={onBack}
      />

      <section className="panel firmware-card">
        <div className="firmware-icon"><DownloadCloud size={34} /></div>
        <div className="firmware-main">
          <span className="muted">نسخه فعلی</span>
          <h3>Firmware {result?.currentVersion || "1.4.2"}</h3>
          <p className="muted compact">بررسی از Backend</p>
        </div>
        <StatusBadge tone="success">پایدار</StatusBadge>
      </section>

      <section className="panel">
        <div className="security-row">
          <ShieldCheck size={22} />
          <div>
            <strong>بروزرسانی امن</strong>
            <p className="muted compact">
              درخواست بررسی OTA از API دستگاه ارسال می‌شود.
            </p>
          </div>
        </div>
        <GammaSyncProgress progress={checking ? 50 : result ? 100 : 0} label="بررسی OTA" />

        <button
          className="primary-btn"
          type="button"
          onClick={check}
          disabled={checking}
        >
          {checking ? (
            <>
              <RefreshCw className="spin" size={17} />
              در حال بررسی...
            </>
          ) : (
            "بررسی بروزرسانی"
          )}
        </button>

        {result && (
          <div className="inline-success">
            <CheckCircle2 size={17} />
            {result.upToDate === false
              ? "نسخه جدید برای دستگاه موجود است."
              : "دستگاه شما آخرین نسخه را دارد."}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
      </section>
    </section>
  );
}
