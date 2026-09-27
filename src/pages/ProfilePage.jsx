import { Bell, DatabaseZap, LogOut, Settings, Shield, UserRound } from "lucide-react";
import { useState } from "react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function ProfilePage({
  user,
  apiMode,
  onTestBackend,
  onBack,
  onLogout,
  onSetting,
}) {
  const [checking, setChecking] = useState(false);
  const [backend, setBackend] = useState(null);

  const test = async () => {
    setChecking(true);
    setBackend(null);
    try {
      setBackend(await onTestBackend());
    } catch {
      setBackend({ reachable: false, status: 0 });
    } finally {
      setChecking(false);
    }
  };

  const fullName = `${user?.firstName || "کاربر"} ${user?.lastName || "گاما"}`.trim();

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="ACCOUNT"
        title="پروفایل"
        subtitle="تنظیمات حساب و اپلیکیشن"
        onBack={onBack}
      />

      <section className="panel profile-card">
        <div className="profile-avatar"><UserRound size={28} /></div>
        <div>
          <h3>{fullName}</h3>
          <p className="muted compact" dir="ltr">
            {user?.mobile || "—"}
          </p>
        </div>
        <StatusBadge tone={apiMode === "api" ? "success" : "warning"}>
          {apiMode === "api" ? "API Mode" : "Mock Mode"}
        </StatusBadge>
      </section>

      <section className="settings-list">
        <SettingRow
          icon={<Bell />}
          title="اعلان‌ها"
          subtitle="خطاها و وضعیت دستگاه"
          onClick={() => onSetting("اعلان‌ها")}
        />
        <SettingRow
          icon={<Shield />}
          title="امنیت"
          subtitle="ورود و نشست‌های فعال"
          onClick={() => onSetting("امنیت")}
        />
        <SettingRow
          icon={<Settings />}
          title="تنظیمات برنامه"
          subtitle="زبان، واحدها و نمایش"
          onClick={() => onSetting("تنظیمات برنامه")}
        />
      </section>

      <section className="panel backend-test-card">
        <div className="mini-heading">
          <DatabaseZap />
          <strong>اتصال Backend</strong>
        </div>
        <p className="muted">
          برای تست سریع دسترسی Frontend به Django/DRF.
        </p>
        <button
          type="button"
          className="secondary-btn"
          disabled={checking}
          onClick={test}
        >
          {checking ? "در حال تست..." : "تست اتصال"}
        </button>

        {backend && (
          <div className={backend.reachable ? "inline-success" : "form-error"}>
            {backend.mock
              ? "Mock API فعال است."
              : backend.reachable
                ? `سرور در دسترس است (HTTP ${backend.status}).`
                : "سرور از مرورگر در دسترس نیست."}
          </div>
        )}
      </section>

      <button type="button" className="danger-btn" onClick={onLogout}>
        <LogOut size={18} /> خروج از حساب
      </button>
    </section>
  );
}

function SettingRow({ icon, title, subtitle, onClick }) {
  return (
    <button className="setting-row" type="button" onClick={onClick}>
      <div className="setting-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span className="muted">{subtitle}</span>
      </div>
      <span className="card-chevron">‹</span>
    </button>
  );
}
