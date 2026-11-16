import GammaMark from "../components/brand/GammaMark";

// Shown to a signed-in user who has no device yet. The CTA reuses the existing /add-device flow.
export default function WelcomeStartPage() {
  return <section className="panel welcome-start" aria-labelledby="welcome-title">
    <div className="welcome-mark"><GammaMark /></div>
    <h2 id="welcome-title">به گاما خوش آمدید</h2>
    <p>ثبت دستگاه موقتاً در دسترس نیست.</p>
    <button className="primary-btn" type="button" disabled>شروع ردیابی</button>
  </section>;
}
