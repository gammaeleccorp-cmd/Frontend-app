import GammaLogo from "../components/GammaLogo";

const fields = [
  ["mobile", "شماره موبایل", "09xxxxxxxxx", "tel"],
  ["firstName", "نام", "نام", "given-name"],
  ["lastName", "نام خانوادگی", "نام خانوادگی", "family-name"],
  ["birthDate", "تاریخ تولد (شمسی)", "yyyy/mm/dd", "bday"],
];

export default function RegisterPage({ form, onChange, rememberMe, onRememberMeChange, onSubmit, onLogin, loading = false, error = "", fieldErrors = {} }) {
  const field = ([key, label, placeholder, autoComplete]) => (
    <label key={key} htmlFor={key}>
      <span>{label}</span>
      <input id={key} name={key} value={form[key]} onChange={(event) => onChange(key, event.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} disabled={loading}
        maxLength={key === "mobile" ? 11 : key === "birthDate" ? 10 : 100}
        inputMode={key === "mobile" ? "numeric" : "text"}
        dir={key === "mobile" || key === "birthDate" ? "ltr" : "rtl"}
        aria-invalid={Boolean(fieldErrors[key])} />
      {fieldErrors[key] && <small className="field-error" role="alert">{fieldErrors[key]}</small>}
    </label>
  );

  return <main className="shell center auth-shell" dir="rtl">
    <section className="auth-card registration-card simple-registration">
      <GammaLogo />
      <h1>ثبت‌نام در گاما</h1>
      <p className="muted">ابتدا شماره موبایل و سپس اطلاعات حساب را وارد کنید.</p>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} noValidate>
        {field(fields[0])}
        <div className="auth-form-grid">{fields.slice(1, 3).map(field)}</div>
        {field(fields[3])}
        <label htmlFor="deviceModel"><span>مدل دستگاه</span>
          <select id="deviceModel" value={form.deviceModel} onChange={(event) => onChange("deviceModel", event.target.value)} disabled={loading} aria-invalid={Boolean(fieldErrors.deviceModel)}>
            <option value="">انتخاب مدل دستگاه</option>
            <option value="NEGAHBAN">نگهبان</option>
            <option value="RAHBAN">راهبان</option>
            <option value="LUMINEN">لومینن</option>
          </select>
          {fieldErrors.deviceModel && <small className="field-error" role="alert">{fieldErrors.deviceModel}</small>}
        </label>
        <p className="field-hint">اتصال دستگاه با کد عمومی آن، پس از ورود به داشبورد انجام می‌شود.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label className="check-row"><input type="checkbox" checked={rememberMe} onChange={(event) => onRememberMeChange(event.target.checked)} disabled={loading} /><span>مرا به خاطر بسپار</span></label>
        <button className="primary-btn full-btn" type="submit" disabled={loading}>{loading ? "در حال ارسال..." : "دریافت کد تأیید"}</button>
      </form>
      <button className="link-btn auth-switch" type="button" onClick={onLogin} disabled={loading}>ورود به حساب</button>
    </section>
  </main>;
}
