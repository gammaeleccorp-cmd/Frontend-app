import { MARK_PATH, MARK_VIEWBOX } from "./gammaMarkData";

/** Vector Gamma symbol. Inherits its colour from `color` (fill: currentColor). */
export default function GammaMark({ className = "", ...rest }) {
  return (
    <svg
      className={className}
      viewBox={MARK_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

