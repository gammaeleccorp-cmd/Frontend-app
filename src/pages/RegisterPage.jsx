import { useEffect, useRef } from "react";
import GammaLogo from "../components/GammaLogo";
import PlateInput from "../components/PlateInput";
import { VEHICLE_COLORS, VEHICLE_MODELS } from "../data/vehicleCatalog";

const fields = [["mobile", "شماره موبایل", "09123456789", "tel", "mobile"], ["firstName", "نام", "نام", "text", "given-name"], ["lastName", "نام خانوادگی", "نام خانوادگی", "text", "family-name"], ["nationalId", "کد ملی", "۱۰ رقم", "text", "off"]];
const fieldOrder = ["mobile", "firstName", "lastName", "nationalId", "birthDate", "serial", "vehicle.plate_number", "vehicle.vin", "vehicle.model", "vehicle.modelCustom", "vehicle.color", "vehicle.colorCustom", "vehicle.production_year"];

export default function RegisterPage({ form, onChange, onSerialBlur, serialState = "idle", detectedProduct = "", rememberMe = false, onRememberMeChange, onSubmit, onLogin, loading = false, checkingSerial = false, error = "", fieldErrors = {} }) {
  const refs = useRef({});
  const plateRef = useRef(null);
  const previousErrors = useRef(fieldErrors);
  useEffect(() => {
    refs.current["vehicle.plate_number"] = plateRef.current;
    const firstInvalid = fieldOrder.find((key) => fieldErrors[key]);
    if (firstInvalid && !previousErrors.current[firstInvalid]) {
      const node = refs.current[firstInvalid]; node?.scrollIntoView?.({ behavior: "smooth", block: "center" }); node?.focus?.();
    }
    previousErrors.current = fieldErrors;
  }, [fieldErrors]);
  const errorFor = (key) => fieldErrors[key] ? <small className="field-error" role="alert">{fieldErrors[key]}</small> : null;
  const setRef = (key, node) => { refs.current[key] = node; };
  const moveOnEnter = (event, key) => { if (event.key !== "Enter" || event.isComposing) return; event.preventDefault(); refs.current[fieldOrder[fieldOrder.indexOf(key) + 1]]?.focus?.(); };
  const vehicle = form.vehicle;
  const modelIsPreset = VEHICLE_MODELS.includes(vehicle.model) && vehicle.model !== "سایر";
  const colorIsPreset = VEHICLE_COLORS.includes(vehicle.color) && vehicle.color !== "سایر";
  const modelChoice = modelIsPreset ? vehicle.model : vehicle.model ? "سایر" : "";
  const colorChoice = colorIsPreset ? vehicle.color : vehicle.color ? "سایر" : "";
  const changeVehicle = (key, value) => onChange(`vehicle.${key}`, value);
  const input = (key, label, placeholder, type = "text", autoComplete = "off") => <label><span>{label}</span><input ref={(node) => setRef(key, node)} value={form[key]} onChange={(event) => onChange(key, event.target.value)} onKeyDown={(event) => moveOnEnter(event, key)} placeholder={placeholder} type={type} autoComplete={autoComplete} inputMode={key === "mobile" || key === "nationalId" ? "numeric" : "text"} dir={key === "mobile" || key === "nationalId" ? "ltr" : undefined} aria-invalid={Boolean(fieldErrors[key])} disabled={loading} />{errorFor(key)}</label>;
  const select = (key, label, value, options, onValue) => <label><span>{label}</span><select ref={(node) => setRef(key, node)} value={value} onChange={(event) => onValue(event.target.value)} aria-invalid={Boolean(fieldErrors[key])} disabled={loading}><option value="">انتخاب کنید</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{errorFor(key)}</label>;
  const serialMessage = { valid: "✓ دستگاه شناسایی شد", already_assigned: "این دستگاه قبلاً به یک حساب متصل شده است.", invalid: "این دستگاه شناسایی نشد." }[serialState];
  return <main className="shell center auth-shell"><section className="auth-card registration-card"><GammaLogo /><p className="eyebrow">REGISTRATION</p><h1>ثبت‌نام</h1><p className="muted">اطلاعات حساب و دستگاه خود را وارد کنید.</p><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} noValidate>
    <div className="auth-section-title">اطلاعات مالک</div><div className="auth-form-grid">{fields.map(([key, label, placeholder, type, autoComplete]) => <div key={key} className={key === "mobile" ? "span-two" : "field-wrap"}>{input(key, label, placeholder, type, autoComplete)}</div>)}{input("birthDate", "تاریخ تولد", "", "date", "bday")}<label><span>کد دستگاه</span><input ref={(node) => setRef("serial", node)} value={form.serial} onChange={(event) => onChange("serial", event.target.value.toUpperCase())} onBlur={onSerialBlur} onKeyDown={(event) => moveOnEnter(event, "serial")} placeholder="NG-05 یا RH-05" autoComplete="off" dir="ltr" aria-invalid={Boolean(fieldErrors.serial)} disabled={loading} />{errorFor("serial")}</label></div>
    <div className="auth-section-title">اطلاعات خودرو</div><div className="auth-form-grid vehicle-form-grid"><label className="span-two"><span>پلاک خودرو</span><PlateInput value={vehicle.plate_number} inputRef={plateRef} onChange={(value) => changeVehicle("plate_number", value)} disabled={loading} error={fieldErrors["vehicle.plate_number"]} />{errorFor("vehicle.plate_number")}</label><label className="span-two"><span>VIN</span><input ref={(node) => setRef("vehicle.vin", node)} value={vehicle.vin} onChange={(event) => changeVehicle("vin", event.target.value)} onKeyDown={(event) => moveOnEnter(event, "vehicle.vin")} placeholder="17-character VIN" autoComplete="off" dir="ltr" aria-invalid={Boolean(fieldErrors["vehicle.vin"])} disabled={loading} />{errorFor("vehicle.vin")}</label>
      {select("vehicle.model", "مدل خودرو", modelChoice, VEHICLE_MODELS, (value) => changeVehicle("model", value))}{!modelIsPreset && modelChoice === "سایر" && <label><span>مدل خودرو (سایر)</span><input ref={(node) => setRef("vehicle.modelCustom", node)} value={vehicle.model === "سایر" ? "" : vehicle.model} onChange={(event) => changeVehicle("model", event.target.value)} onKeyDown={(event) => moveOnEnter(event, "vehicle.modelCustom")} placeholder="مدل خودرو را وارد کنید" aria-invalid={Boolean(fieldErrors["vehicle.model"])} disabled={loading} />{errorFor("vehicle.model")}</label>}
      {select("vehicle.color", "رنگ خودرو", colorChoice, VEHICLE_COLORS, (value) => changeVehicle("color", value))}{!colorIsPreset && colorChoice === "سایر" && <label><span>رنگ خودرو (سایر)</span><input ref={(node) => setRef("vehicle.colorCustom", node)} value={vehicle.color === "سایر" ? "" : vehicle.color} onChange={(event) => changeVehicle("color", event.target.value)} onKeyDown={(event) => moveOnEnter(event, "vehicle.colorCustom")} placeholder="رنگ خودرو را وارد کنید" aria-invalid={Boolean(fieldErrors["vehicle.color"])} disabled={loading} />{errorFor("vehicle.color")}</label>}
      <label><span>سال تولید</span><input ref={(node) => setRef("vehicle.production_year", node)} value={vehicle.production_year} onChange={(event) => changeVehicle("production_year", event.target.value)} onKeyDown={(event) => moveOnEnter(event, "vehicle.production_year")} placeholder="۱۴۰۴" type="number" inputMode="numeric" dir="ltr" aria-invalid={Boolean(fieldErrors["vehicle.production_year"])} disabled={loading} />{errorFor("vehicle.production_year")}</label></div>
    {(checkingSerial || serialMessage) && <div className={`device-detection ${serialState}`} role="status">{checkingSerial ? "در حال شناسایی دستگاه..." : serialMessage}{!checkingSerial && serialState === "valid" && <strong>{detectedProduct}</strong>}</div>}{error && <div className="form-error" role="alert">{error}</div>}<label className="check-row"><input type="checkbox" checked={rememberMe} onChange={(event) => onRememberMeChange(event.target.checked)} disabled={loading} /><span>مرا به خاطر بسپار</span></label><button className="primary-btn full-btn" type="submit" disabled={loading}>{loading ? "در حال ارسال..." : "دریافت کد یکبار مصرف"}</button></form><button className="link-btn auth-switch" type="button" disabled={loading} onClick={onLogin}>ورود</button></section></main>;
}
