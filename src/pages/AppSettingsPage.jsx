import PageHeader from "../components/PageHeader";
import { REFRESH_OPTIONS } from "../utils/appSettings";

export default function AppSettingsPage({ settings, onChange, onBack }) {
  const update = (key, value) => onChange({ ...settings, [key]: value });
  return (
    <section className="page-section">
      <PageHeader eyebrow="SETTINGS" title="تنظیمات برنامه" subtitle="این انتخاب‌ها روی همین دستگاه ذخیره می‌شوند" onBack={onBack} />
      <section className="panel">
        <div className="section-title"><h3>به‌روزرسانی خودکار وضعیت و نقشه</h3></div>
        <div className="choice-list" role="radiogroup" aria-label="فاصله به‌روزرسانی خودکار">
          {REFRESH_OPTIONS.map((option) => (
            <label key={option.value} className={`choice-row ${settings.refreshSeconds === option.value ? "selected" : ""}`}>
              <input type="radio" name="refresh" checked={settings.refreshSeconds === option.value} onChange={() => update("refreshSeconds", option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-title"><h3>نمایش</h3></div>
        <ToggleRow label="کاهش انیمیشن‌ها" hint="حرکت و جلوه‌های انتقال صفحه حذف می‌شوند." checked={settings.reduceMotion} onChange={(value) => update("reduceMotion", value)} />
        <ToggleRow label="متن بزرگ‌تر" hint="اندازه متن کل برنامه بزرگ‌تر می‌شود." checked={settings.largeText} onChange={(value) => update("largeText", value)} />
      </section>
    </section>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small className="muted">{hint}</small></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
