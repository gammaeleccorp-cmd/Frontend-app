import { useState } from 'react';
import { asciiDigits, normalizeDeviceCode } from '../utils/deviceCode';
export default function DeviceOnboardingPage({ onSubmit, onBack, loading = false, error = '' }) {
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState('');
  const submit = event => { event.preventDefault(); const normalized = normalizeDeviceCode(code); if (!normalized) { setFieldError('کد دستگاه را مانند NG-0001 وارد کنید.'); return; } setFieldError(''); setCode(normalized); onSubmit({ deviceCode: normalized }); };
  return <section className="auth-card device-add-card" dir="rtl"><h1>افزودن دستگاه</h1><p className="muted">کد عمومی روی دستگاه را وارد کنید.</p><form onSubmit={submit} noValidate><label htmlFor="device-code"><span>کد عمومی دستگاه</span><input id="device-code" value={code} placeholder="NG-XXXX" dir="ltr" autoComplete="off" maxLength={16} disabled={loading} onChange={event => { setCode(asciiDigits(event.target.value).toUpperCase()); setFieldError(''); }} aria-invalid={Boolean(fieldError)} /></label>{fieldError && <p className="field-error" role="alert">{fieldError}</p>}{error && <div className="form-error" role="alert">{error}</div>}<p className="field-hint">اطلاعات خودرو را بعداً تکمیل کنید.</p><button className="primary-btn full-btn" type="submit" disabled={loading}>{loading ? 'در حال اتصال...' : 'اتصال دستگاه'}</button></form><button className="link-btn" disabled={loading} onClick={onBack}>بازگشت به داشبورد</button></section>;
}
