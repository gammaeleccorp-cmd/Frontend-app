import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { MARK_PATH, MARK_VIEWBOX, WIRE } from "../brand/gammaMarkData";

/*
 * Gamma intro â€” SVG + CSS only (no video / Lottie).
 *
 * Timeline (ms):     0 â”€â”€ grid fades in
 *                  150 â”€â”€ telemetry pulse leaves the left edge (CAN frame blips on the way)
 *                 ~1250 â”€â”€ pulse curls into the Î³ loop; ring + diagonal + circuit traces draw
 *              1150-2150 â”€â”€ data points / GNSS pings / channel labels
 *                 1950 â”€â”€ mark solidifies to orange with a soft glow
 *            2150-2830 â”€â”€ "GAMMA VEHICLE SYSTEM" + Persian tagline
 *                 3050 â”€â”€ hand-off: mark flies into the login-card logo, card fades in
 *                ~3730 â”€â”€ splash unmounted (â‰¤ 4 s total)
 */

const STORAGE_KEY = "gamma_intro_played";
const HANDOFF_AT = 3050;
const HANDOFF_MS = 650;
const SKIP_HANDOFF_MS = 420;
const REDUCED_HOLD = 1100;
const REDUCED_FADE_MS = 360;

const TARGET_SELECTOR = "[data-gamma-logo-target]";

/** True when the intro should play: once per app session (PWA launch / browser tab). `?intro=1` forces it. */
export function shouldPlayIntro() {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("intro") === "1") return true;
    return window.sessionStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

function markIntroPlayed() {
  try { window.sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* private mode: ignore */ }
}

// Data points that blink around the mark (mark units). [x, y, r, delayMs, driftX, driftY]
const PARTICLES = [
  [22, 40, 1.4, 1150, 5, 4], [-6, 104, 1.1, 1240, 7, 0], [6, 176, 1.5, 1330, 6, -4],
  [58, 236, 1.1, 1420, 3, -6], [168, 238, 1.3, 1200, -3, -6], [232, 196, 1.1, 1300, -6, -3],
  [244, 92, 1.5, 1380, -7, 2], [212, 30, 1.2, 1260, -5, 5], [158, 4, 1.1, 1460, -2, 6],
  [70, 10, 1.3, 1520, 2, 6], [-18, 142, 0.9, 1560, 7, -1], [254, 150, 0.9, 1600, -7, -1],
];

const LABELS = [
  { text: "CAN Â· 500K", side: "start", top: "16%" },
  { text: "OBD-II Â· OK", side: "start", top: "70%" },
  { text: "GNSS Â· FIX", side: "end", top: "8%" },
  { text: "LTE Â· LINK", side: "end", top: "60%" },
];

/** Build the pulse path: from the screen's left edge, across, through a CAN-style frame, into the Î³ loop. */
function buildPulsePath(xStart, upp) {
  const y = 96;
  const [lx, ly] = WIRE.loopStart;
  const entry = 62;
  const span = entry - xStart;
  const bit = Math.min(Math.max(span * 0.022, 5 * upp), 9 * upp);
  const amp = 6 * upp;
  const bits = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1];
  let x = xStart + span * 0.28;
  let d = `M${xStart.toFixed(1)} ${y}H${x.toFixed(1)}`;
  let level = 0;
  for (const b of bits) {
    if (b !== level) { d += `V${(b ? y - amp : y).toFixed(1)}`; level = b; }
    x += bit;
    d += `H${x.toFixed(1)}`;
  }
  if (level) d += `V${y}`;
  d += `H${entry}C70 ${y} ${lx} ${ly + 8} ${lx} ${ly}${WIRE.loop}`;
  return d;
}

export default function GammaSplash({ onReveal, onFinish }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState("intro"); // intro | handoff
  const [skipped, setSkipped] = useState(false);
  const [pulseD, setPulseD] = useState("");
  const rootRef = useRef(null);
  const markRef = useRef(null);
  const svgRef = useRef(null);
  const doneRef = useRef(false);
  const timers = useRef([]);
  const cbs = useRef({ onReveal, onFinish });
  cbs.current = { onReveal, onFinish };

  const later = (fn, ms) => { timers.current.push(window.setTimeout(fn, ms)); };

  // Pulse path depends on where the mark sits on screen; rebuild on resize.
  useLayoutEffect(() => {
    const measure = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const upp = 240 / rect.width; // mark units per CSS px
      setPulseD(buildPulsePath(-rect.left * upp - 8, upp));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Feed real path lengths to CSS for stroke-dash drawing.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const upp = 240 / (svg.getBoundingClientRect().width || 240);
    svg.querySelectorAll("[data-draw]").forEach((el) => {
      const len = el.getTotalLength();
      el.style.setProperty("--len", `${len.toFixed(1)}px`);
    });
    svg.style.setProperty("--comet", `${(46 * upp).toFixed(1)}px`);
  }, [pulseD]);

  const handoff = useCallback((fast) => {
    if (doneRef.current) return;
    doneRef.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("handoff");
    cbs.current.onReveal?.();

    const mark = markRef.current;
    const target = document.querySelector(TARGET_SELECTOR);
    const fly = !reduced && mark && target;
    if (fly) {
      const from = mark.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const s = to.width / from.width;
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const ms = fast ? SKIP_HANDOFF_MS : HANDOFF_MS;
      mark.style.transition = `transform ${ms}ms cubic-bezier(.65,0,.22,1)`;
      // Next frame so the introâ†’handoff class change and the transform don't collapse into one style pass.
      requestAnimationFrame(() => {
        mark.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${s})`;
      });
      later(() => cbs.current.onFinish?.(), ms + 30);
    } else {
      later(() => cbs.current.onFinish?.(), reduced ? REDUCED_FADE_MS : SKIP_HANDOFF_MS);
    }
  }, [reduced]);

  const skip = useCallback(() => {
    if (doneRef.current) return;
    setSkipped(true);
    // Let the "final frame" styles apply, then hand off.
    requestAnimationFrame(() => handoff(true));
  }, [handoff]);

  useEffect(() => {
    markIntroPlayed();
    const html = document.documentElement;
    html.classList.add("gs-lock");
    later(() => handoff(false), reduced ? REDUCED_HOLD : HANDOFF_AT);
    const onKey = (e) => {
      if (["Escape", "Enter", " ", "Spacebar"].includes(e.key)) { e.preventDefault(); skip(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      html.classList.remove("gs-lock");
      window.removeEventListener("keydown", onKey);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      doneRef.current = false;
    };
  }, [reduced]);

  const cls = [
    "gs-root",
    phase === "handoff" && "is-handoff",
    skipped && "is-skipped",
    reduced && "is-reduced",
  ].filter(Boolean).join(" ");

  const n = WIRE.nodeRadius;

  return (
    <div ref={rootRef} className={cls} onClick={skip} role="presentation">
      <div className="gs-grid" aria-hidden="true" />
      <div className="gs-stage">
        <div className="gs-mark" ref={markRef}>
          <svg ref={svgRef} className="gs-svg" viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false">
            <defs>
              <filter id="gs-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>

            {/* 1â€“3: telemetry pulse travelling in and curling into Î³ */}
            {pulseD && (
              <g className="gs-pulse">
                <path className="gs-trail" data-draw="" d={pulseD} />
                <path className="gs-comet gs-comet--halo" data-draw="" d={pulseD} />
                <path className="gs-comet gs-comet--core" data-draw="" d={pulseD} />
              </g>
            )}

            {/* Wireframe of the mark drawing itself */}
            <g className="gs-wire">
              <path className="gs-w gs-w--loop" data-draw="" d={`M${WIRE.loopStart.join(" ")}${WIRE.loop}`} />
              <path className="gs-w gs-w--ring" data-draw="" d={WIRE.ring} />
              <path className="gs-w gs-w--diag" data-draw="" d={WIRE.diagonal} />
              <circle className="gs-w gs-w--top" data-draw="" cx={WIRE.topNode[0]} cy={WIRE.topNode[1]} r={WIRE.topNode[2]} />
              {WIRE.traces.map((t, i) => (
                <g key={t.d} style={{ "--i": i }}>
                  <path className="gs-w gs-w--trace" data-draw="" d={t.d} />
                  <circle className="gs-w gs-w--node" data-draw="" cx={t.node[0]} cy={t.node[1]} r={n} />
                </g>
              ))}
            </g>

            {/* 4: data points + GNSS / link pings */}
            <g className="gs-particles">
              {PARTICLES.map(([x, y, r, delay, dx, dy]) => (
                <circle
                  key={`${x}-${y}`}
                  className="gs-dot"
                  cx={x}
                  cy={y}
                  r={r}
                  style={{ "--d": `${delay}ms`, "--dx": `${dx}px`, "--dy": `${dy}px` }}
                />
              ))}
              <circle className="gs-ping" cx="181.5" cy="102" r={n} style={{ "--d": "1450ms" }} />
              <circle className="gs-ping" cx="123" cy="21" r={WIRE.topNode[2]} style={{ "--d": "1700ms" }} />
              <circle className="gs-ping" cx="75.5" cy="166" r={n} style={{ "--d": "1580ms" }} />
            </g>

            {/* 5: solid mark + glow */}
            <path className="gs-glow" d={MARK_PATH} fillRule="evenodd" filter="url(#gs-soft-glow)" />
            <path className="gs-fill" d={MARK_PATH} fillRule="evenodd" />
          </svg>

          <ul className="gs-labels" aria-hidden="true">
            {LABELS.map((l, i) => (
              <li key={l.text} className={`gs-label gs-label--${l.side}`} style={{ top: l.top, "--i": i }}>
                <span className="gs-label__dot" />{l.text}
              </li>
            ))}
          </ul>
        </div>

        {/* 6â€“7: wordmark lines */}
        <div className="gs-text">
          <p className="gs-en" dir="ltr">GAMMA VEHICLE SYSTEM</p>
          <span className="gs-rule" aria-hidden="true" />
          <p className="gs-fa" dir="rtl">Ø³Ø§Ù…Ø§Ù†Ù‡ Ù‡ÙˆØ´Ù…Ù†Ø¯ Ø®ÙˆØ¯Ø±ÙˆÛŒ Ú¯Ø§Ù…Ø§</p>
        </div>
      </div>

      <button
        type="button"
        className="gs-skip"
        onClick={(e) => { e.stopPropagation(); skip(); }}
        aria-label="Ø±Ø¯ Ú©Ø±Ø¯Ù† Ø§Ù†ÛŒÙ…ÛŒØ´Ù† Ø´Ø±ÙˆØ¹"
      >
        Ø±Ø¯ Ú©Ø±Ø¯Ù†
      </button>
    </div>
  );
}

