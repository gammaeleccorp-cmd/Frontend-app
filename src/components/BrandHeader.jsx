import GammaMark from "./brand/GammaMark";

export default function BrandHeader() {
  return <div className="platform-title gamma-brand" dir="ltr" aria-label="GAMMA VEHICLE PLATFORM">
    <span className="gamma-brand-logo"><GammaMark /></span>
    <strong className="gamma-brand-wordmark">GAMMA</strong>
    <span className="gamma-brand-subtitle">VEHICLE PLATFORM</span>
  </div>;
}
