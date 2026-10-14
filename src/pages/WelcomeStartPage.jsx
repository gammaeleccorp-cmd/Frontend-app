import GammaMark from "../components/brand/GammaMark";

// Shown to a signed-in user who has no device yet. The CTA reuses the existing /add-device flow.
export default function WelcomeStartPage({ onStart }) {
  return <section className="panel welcome-start" aria-labelledby="welcome-title">
    <div className="welcome-mark"><GammaMark /></div>
    <h2 id="welcome-title">به گاما خوش آمدید</h2>
    <p>برای شروع ردیابی، روی دکمهٔ زیر بزنید و اطلاعات محصول خود را وارد کنید.</p>
    <button className="primary-btn" type="button" onClick={onStart}>شروع ردیابی</button>
  </section>;
}
