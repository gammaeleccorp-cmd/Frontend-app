const MAX_SPEED = 240;
const ARC = "M 64.74 199 A 110 110 0 1 1 255.26 199";

export default function Speedometer({ value, fresh = false }) {
  const speed = typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN;
  const hasSpeed = Number.isFinite(speed) && speed >= 0;
  const progress = hasSpeed ? Math.min(speed / MAX_SPEED, 1) : 0;
  const status = !hasSpeed ? "سرعت دریافت نشده" : fresh ? "داده تازه" : "داده قدیمی";

  return (
    <article className="speed-card" aria-label="سرعت خودرو">
      <div className="speed-card-heading">
        <h3>سرعت خودرو</h3>
        <span className={`speed-status${hasSpeed && fresh ? " is-fresh" : ""}`}><i aria-hidden="true" />{status}</span>
      </div>
      <div className="speed-instrument" dir="ltr">
        <svg className="speed-dial" viewBox="0 0 320 240" aria-hidden="true" focusable="false">
          <path className="speed-track" d={ARC} />
          <path className="speed-progress" d={ARC} pathLength="100" strokeDasharray={`${progress * 100} 100`} opacity={progress ? 1 : 0} />
          {Array.from({ length: 25 }, (_, index) => {
            const angle = -120 + index * 10;
            const major = index % 4 === 0;
            const radians = angle * Math.PI / 180;
            return <g key={index}>
              <line className={major ? "speed-tick major" : "speed-tick"} x1="160" y1="45" x2="160" y2={major ? "55" : "50"} transform={`rotate(${angle} 160 144)`} />
              {major && <text className="speed-scale" x={160 + 130 * Math.sin(radians)} y={148 - 130 * Math.cos(radians)} textAnchor="middle">{index * 10}</text>}
            </g>;
          })}
          {hasSpeed && <g className="speed-needle" style={{ transform: `rotate(${-120 + progress * 240}deg)` }}>
            <path d="M 160 57 L 163 144 L 160 154 L 157 144 Z" />
          </g>}
          <circle className="speed-hub" cx="160" cy="144" r="7" />
          <circle className="speed-hub-core" cx="160" cy="144" r="2.5" />
        </svg>
        <div className="speed-readout">
          <strong>{hasSpeed ? Math.round(speed) : "—"}</strong>
          <span>km/h</span>
        </div>
      </div>
      <p className="speed-caption">آخرین سرعت ثبت‌شده</p>
    </article>
  );
}
