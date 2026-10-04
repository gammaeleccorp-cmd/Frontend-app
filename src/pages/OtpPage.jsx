import GammaLogo from "../components/GammaLogo";
import OtpInput from "../components/OtpInput";
import { OTP_LENGTH } from "../config/auth";

export default function OtpPage({
  mobile,
  flow = "login",
  code,
  onCodeChange,
  onVerify,
  onBack,
  onResend,
  notice = "",
  loading = false,
  error = "",
}) {
  return (
    <main className="shell center auth-shell">
      <section className="auth-card">
        <GammaLogo />
        <p className="eyebrow">{flow === "registration" ? "REGISTRATION" : "VERIFICATION"}</p>
        <h1>تأیید شماره</h1>

        <p className="muted">
          کد ارسال‌شده به <span dir="ltr">{mobile}</span> را وارد کنید.
        </p>

        <OtpInput
          onChange={onCodeChange}
          onComplete={onCodeChange}
        />

        {error && <div className="form-error" role="alert">{error}</div>}

        <button
          className="primary-btn full-btn"
          type="button"
          disabled={code.length !== OTP_LENGTH || loading}
          onClick={onVerify}
        >
          {loading ? "در حال بررسی..." : "ورود به داشبورد"}
        </button>

        <button
          className="ghost-btn full-btn"
          type="button"
          disabled={loading}
          onClick={onBack}
        >
          ویرایش شماره
        </button>

        {notice && <div className="inline-success">{notice}</div>}
        <button className="link-btn" type="button" disabled={loading} onClick={onResend}>
          ارسال مجدد کد
        </button>
      </section>
    </main>
  );
}
