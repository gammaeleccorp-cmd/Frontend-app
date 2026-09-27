import { useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function DiagnosticsPage({ dtcs = [], onBack, onOpenDtc }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return dtcs;

    return dtcs.filter((dtc) =>
      `${dtc.code} ${dtc.title} ${dtc.description}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [dtcs, query]);

  const stored = dtcs.filter((item) => item.status === "ذخیره‌شده").length;
  const historic = dtcs.filter((item) => item.status === "تاریخی").length;
  const critical = dtcs.filter((item) => item.severity === "بحرانی").length;

  return (
    <section className="page-section">
      <PageHeader
        eyebrow="DIAGNOSTICS"
        title="دیاگ و کدهای خطا"
        subtitle="خطاهای فعال، ذخیره‌شده و تاریخی"
        onBack={onBack}
      />

      <section className="panel diagnostic-summary">
        <div><span className="summary-number">{stored}</span><span className="muted">ذخیره‌شده</span></div>
        <div><span className="summary-number">{historic}</span><span className="muted">تاریخی</span></div>
        <div><span className="summary-number ok-number">{critical}</span><span className="muted">بحرانی</span></div>
      </section>

      <div className="search-box">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجو بین کدها و توضیحات..."
        />
      </div>

      <div className="stack-list">
        {filtered.map((dtc) => (
          <button
            key={`${dtc.code}-${dtc.status}`}
            type="button"
            className="fault-row"
            onClick={() => onOpenDtc(dtc)}
          >
            <div className="fault-icon"><Wrench size={18} /></div>
            <div className="fault-main">
              <div className="fault-title-row">
                <strong className="mono">{dtc.code}</strong>
                <StatusBadge
                  tone={
                    dtc.severity === "متوسط" || dtc.severity === "بحرانی"
                      ? "warning"
                      : "default"
                  }
                >
                  {dtc.severity}
                </StatusBadge>
              </div>
              <h4>{dtc.title}</h4>
              <p className="muted compact">{dtc.description}</p>
            </div>
            <span className="card-chevron">‹</span>
          </button>
        ))}

        {!filtered.length && (
          <div className="empty-state">
            کد خطایی برای نمایش پیدا نشد.
          </div>
        )}
      </div>
    </section>
  );
}
