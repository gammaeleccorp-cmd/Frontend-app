import GammaMark from "../components/brand/GammaMark";

// Registration status is shown only to signed-in users without a device.
export default function WelcomeStartPage() {
  return <section className="panel welcome-start" dir="rtl" aria-labelledby="welcome-title">
    <div className="welcome-mark"><GammaMark /></div>
    <h2 id="welcome-title">به گاما خوش آمدید</h2>
    <p>برای ثبت دستگاه به بخش پروفایل مراجعه کنید.</p>
  </section>;
}
