import { ArrowRight } from "lucide-react";

export default function PageHeader({ eyebrow, title, subtitle, onBack, action }) {
  return (
    <div className="page-header">
      <div className="page-heading-wrap">
        {onBack && (
          <button className="icon-btn" type="button" onClick={onBack} aria-label="بازگشت">
            <ArrowRight size={20} />
          </button>
        )}
        <div>
          {eyebrow && <p className="eyebrow no-margin">{eyebrow}</p>}
          <h2>{title}</h2>
          {subtitle && <p className="muted compact">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
