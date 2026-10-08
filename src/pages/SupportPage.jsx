import { Globe, Mail, Phone } from "lucide-react";
import PageHeader from "../components/PageHeader";

export default function SupportPage({ support, deviceCode, onBack }) {
  const channels = [
    support.phone && { icon: <Phone size={18} />, label: "تماس تلفنی", value: support.phone, href: `tel:${support.phone.replace(/[^0-9+]/g, "")}` },
    support.email && { icon: <Mail size={18} />, label: "ایمیل", value: support.email, href: `mailto:${support.email}${deviceCode ? `?subject=${encodeURIComponent(`پشتیبانی دستگاه ${deviceCode}`)}` : ""}` },
    support.url && /^https:\/\//.test(support.url) && { icon: <Globe size={18} />, label: "صفحه پشتیبانی", value: support.url, href: support.url },
  ].filter(Boolean);

  return (
    <section className="page-section">
      <PageHeader eyebrow="SUPPORT" title="پشتیبانی" subtitle="ارتباط با تیم گاما" onBack={onBack} />
      {channels.length ? (
        <section className="panel">
          <div className="stack-list">
            {channels.map((item) => (
              <a key={item.label} className="setting-row support-link" href={item.href} target={item.href.startsWith("https") ? "_blank" : undefined} rel="noreferrer">
                <div className="setting-icon">{item.icon}</div>
                <div><strong>{item.label}</strong><span className="muted" dir="ltr">{item.value}</span></div>
                <span className="card-chevron">‹</span>
              </a>
            ))}
          </div>
          {support.hours && <p className="muted small-text">ساعات پاسخ‌گویی: {support.hours}</p>}
          {deviceCode && <p className="muted small-text">هنگام تماس، کد دستگاه <span dir="ltr">{deviceCode}</span> را اعلام کنید.</p>}
        </section>
      ) : (
        <section className="panel">
          <p>کانال پشتیبانی هنوز در پیکربندی این نسخه تعریف نشده است.</p>
          <p className="muted small-text">برای فعال شدن این بخش، شماره، ایمیل یا آدرس رسمی پشتیبانی باید در تنظیمات انتشار برنامه ثبت شود.</p>
        </section>
      )}
    </section>
  );
}
