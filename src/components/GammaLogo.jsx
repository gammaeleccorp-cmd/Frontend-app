import GammaMark from "./brand/GammaMark";

export default function GammaLogo({ small = false }) {
  return (
    <span className={`brand-logo${small ? " small-logo" : ""}`} role="img" aria-label="Gamma">
      <GammaMark className="brand-logo__mark" data-gamma-logo-target="" />
    </span>
  );
}
