export default function GammaLogo({ small = false }) {
  return (
    <img
      src="/logo-symbol.png"
      alt="Gamma"
      className={`brand-logo${small ? " small-logo" : ""}`}
    />
  );
}
