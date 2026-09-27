import GammaLogo from "../components/GammaLogo";

export default function LoginPage({
  mobile,
  onMobileChange,
  onSubmit,
  loading = false,
  error = "",
}) {
  const valid = /^09\d{9}$/.test(mobile);

  return (
    <main className="shell center auth-shell">
      <section className="auth-card">
        <GammaLogo />
        <p className="eyebrow">GAMMA VEHICLE SYSTEM</p>
        <h1>ورود به گاما</h1>
        <p className="muted">شماره موبایل خود را وارد کنید.</p>

        <label htmlFor="mobile">شماره موبایل</label>
        <input
          id="mobile"
          value={mobile}
          onChange={(event) =>
            onMobileChange(
              event.target.value.replace(/\D/g, "").slice(0, 11)
            )
          }
          placeholder="09xxxxxxxxx"
          inputMode="numeric"
          autoComplete="tel"
          dir="ltr"
          disabled={loading}
        />

        <p className={`field-hint ${mobile && !valid ? "error-text" : ""}`}>
          {mobile && !valid
            ? "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود."
            : "مثال: 09123456789"}
        </p>

        {error && <div className="form-error" role="alert">{error}</div>}

        <button
          className="primary-btn full-btn"
          type="button"
          disabled={!valid || loading}
          onClick={onSubmit}
        >
          {loading ? "در حال ارسال..." : "دریافت کد یکبار مصرف"}
        </button>
      </section>
    </main>
  );
}
