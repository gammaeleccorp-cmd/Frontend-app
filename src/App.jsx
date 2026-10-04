import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import AppHeader from "./components/AccessAppHeader";
import BottomNav from "./components/BottomNav";
import StateMessage from "./components/StateMessage";
import LoginPage from "./pages/UnifiedLoginPage";
import DeviceOnboardingPage from "./pages/DeviceOnboardingPage";
import RegisterPage from "./pages/RegisterPage";
import OtpPage from "./pages/OtpPage";
import HomePage from "./pages/HomePage";
import VehiclePage from "./pages/VehiclePage";
import DiagnosticsPage from "./pages/DiagnosticsPage";
import DtcDetailPage from "./pages/DtcDetailPage";
import EcuLivePage from "./pages/EcuLivePage";
import OtaPage from "./pages/OtaPage";
import MpuPage from "./pages/MpuPage";
import ConnectionPage from "./pages/ConnectionPage";
import ProfilePage from "./pages/ProfilePage";
import PageTransition from "./components/motion/PageTransition";
import { getUserProducts, normalizeProductType, PRODUCTS } from "./data/mockData";
import { isValidIranianNationalId } from "./utils/validation";
import * as repo from "./services/gammaRepository";

const LazyRoutesPage = lazy(() => import("./pages/RoutesPage"));
function RoutesPage(props) {
  return <Suspense fallback={<StateMessage loading message="در حال بارگذاری نقشه..." />}><LazyRoutesPage {...props} /></Suspense>;
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginRoute />} /><Route path="/register" element={<Navigate to="/login" replace />} /><Route path="/otp" element={<OtpRoute />} /><Route element={<ProtectedLayout />}><Route path="/home" element={<HomeRoute />} /><Route path="/vehicle" element={<VehicleRoute />} /><Route path="/profile" element={<ProfileRoute />} /><Route path="/diagnostics" element={<DiagnosticsRoute />} /><Route path="/diagnostics/:code" element={<DtcRoute />} /><Route path="/ecu-live" element={<EcuRoute />} /><Route path="/connection" element={<ConnectionRoute />} /><Route path="/ota" element={<OtaRoute />} /><Route path="/routes" element={<RoutesRoute />} /><Route path="/imu-events" element={<MpuRoute />} /></Route><Route path="*" element={<Navigate to="/home" replace />} /></Routes></BrowserRouter>;
}

function LoginRoute() {
  const navigate = useNavigate(); const [mobile, setMobile] = useState(""); const [rememberMe, setRememberMe] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (repo.hasSession()) return <Navigate to="/home" replace />;
  const submit = async () => { setBusy(true); setError(""); try { await repo.requestOtp(mobile); navigate("/otp", { state: { mobile } }); } catch (err) { setError(err?.message || "ارسال کد ناموفق بود."); } finally { setBusy(false); } };
  const submitWithRemember = async () => {
    setBusy(true);
    setError("");
    try {
      await repo.requestLoginOtp(mobile);
      navigate("/otp", { state: { flow: "login", mobile, rememberMe } });
    } catch (err) {
      setError(err?.message || "ارسال کد ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };
  void submit;
  return <LoginPage mobile={mobile} onMobileChange={setMobile} onSubmit={submitWithRemember} rememberMe={rememberMe} onRememberMeChange={setRememberMe} onRegister={() => navigate("/register")} loading={busy} error={error} />;
}

function RegisterRoute() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ mobile: "", firstName: "", lastName: "", nationalId: "", birthDate: "", serial: "", vehicle: { plate_number: "", vin: "", model: "", color: "", production_year: "" } });
  const [rememberMe, setRememberMe] = useState(false);
  const [serialState, setSerialState] = useState("idle");
  const [detectedProduct, setDetectedProduct] = useState("");
  const [checkingSerial, setCheckingSerial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  if (repo.hasSession()) return <Navigate to="/home" replace />;

  const changeField = (key, value) => {
    const vehicleField = key.startsWith("vehicle.");
    const fieldName = vehicleField ? key.slice("vehicle.".length) : key;
    const nextValue = key === "mobile" || key === "nationalId"
      ? value.replace(/\D/g, "").slice(0, key === "mobile" ? 11 : 10)
      : fieldName === "production_year"
        ? value.replace(/\D/g, "").slice(0, 4)
        : fieldName === "vin"
          ? value.replace(/\s/g, "").toUpperCase()
          : fieldName === "plate_number"
            ? value
            : value;
    setForm((current) => vehicleField ? { ...current, vehicle: { ...current.vehicle, [fieldName]: nextValue } } : { ...current, [key]: nextValue });
    const errorKey = vehicleField ? `vehicle.${fieldName}` : key;
    setFieldErrors((current) => current[errorKey] ? { ...current, [errorKey]: "" } : current);
    if (key === "serial") { setSerialState("idle"); setDetectedProduct(""); }
  };
  const validateSerial = async () => {
    if (!form.serial) { setSerialState("idle"); setFieldErrors((current) => ({ ...current, serial: "شماره سریال دستگاه معتبر نیست." })); return false; }
    setCheckingSerial(true); setSerialState("checking"); setError("");
    try {
      const result = await repo.validateDeviceSerial(form.serial);
      setSerialState(result.state);
      setFieldErrors((current) => ({ ...current, serial: result.state === "valid" ? "" : result.state === "already_assigned" ? "این دستگاه قبلاً به حساب دیگری متصل شده است." : "شماره سریال دستگاه معتبر نیست." }));
      setDetectedProduct(result.productType === PRODUCTS.NEGAHBAN ? "نگهبان" : "راهبان");
      return result.state === "valid";
    } catch (err) { setSerialState("invalid"); setFieldErrors((current) => ({ ...current, serial: err?.message || "شماره سریال دستگاه معتبر نیست." })); return false; }
    finally { setCheckingSerial(false); }
  };
  const submit = async () => {
    const vehicle = form.vehicle;
    const nextErrors = {};
    if (!/^09\d{9}$/.test(form.mobile)) nextErrors.mobile = "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود.";
    if (!form.firstName.trim()) nextErrors.firstName = "نام را وارد کنید.";
    if (!form.lastName.trim()) nextErrors.lastName = "نام خانوادگی را وارد کنید.";
    if (!isValidIranianNationalId(form.nationalId)) nextErrors.nationalId = "کد ملی معتبر نیست.";
    if (!form.birthDate) nextErrors.birthDate = "تاریخ تولد را وارد کنید.";
    if (!repo.validateVehicle({ ...vehicle, plate_number: vehicle.plate_number }).valid) nextErrors["vehicle.plate_number"] = "پلاک خودرو را کامل وارد کنید.";
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(vehicle.vin || "").toUpperCase())) nextErrors["vehicle.vin"] = "VIN باید دقیقاً ۱۷ کاراکتر معتبر باشد.";
    if (!String(vehicle.model || "").trim() || vehicle.model === "سایر") nextErrors["vehicle.model"] = "مدل خودرو را انتخاب یا وارد کنید.";
    if (!String(vehicle.color || "").trim() || vehicle.color === "سایر") nextErrors["vehicle.color"] = "رنگ خودرو را انتخاب یا وارد کنید.";
    if (!/^\d{4}$/.test(String(vehicle.production_year || "")) || Number(vehicle.production_year) < 1300 || Number(vehicle.production_year) > 1500) nextErrors["vehicle.production_year"] = "سال تولید معتبر را وارد کنید.";
    if (!form.serial) nextErrors.serial = "شماره سریال دستگاه معتبر نیست.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setError("لطفاً خطاهای مشخص‌شده را برطرف کنید."); return; }
    const validSerial = serialState === "valid" || await validateSerial();
    if (!validSerial) return;
    setBusy(true); setError(""); setFieldErrors({});
    try {
      const result = await repo.requestRegistrationOtp(form);
      navigate("/otp", { state: { flow: "registration", mobile: form.mobile, rememberMe, registration: form, detectedProduct: result.productType } });
    } catch (err) { setError(err?.message || "ارسال کد ناموفق بود."); }
    finally { setBusy(false); }
  };
  return <RegisterPage form={form} onChange={changeField} onSerialBlur={validateSerial} serialState={serialState} detectedProduct={detectedProduct} rememberMe={rememberMe} onRememberMeChange={setRememberMe} onSubmit={submit} onLogin={() => navigate("/login")} loading={busy} checkingSerial={checkingSerial} error={error} fieldErrors={fieldErrors} />;
}

function legacyOtpRoute() {
  const navigate = useNavigate(); const location = useLocation(); const mobile = location.state?.mobile || ""; const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  if (!mobile) return <Navigate to="/login" replace />;
  const verify = async () => { setBusy(true); setError(""); try { await repo.verifyOtp(mobile, code); navigate("/home", { replace: true }); } catch (err) { setError(err?.message || "تأیید کد ناموفق بود."); } finally { setBusy(false); } };
  const resend = async () => { setBusy(true); setError(""); try { await repo.resendOtp(mobile); setNotice("کد تأیید مجدداً ارسال شد."); } catch (err) { setError(err?.message || "ارسال مجدد ناموفق بود."); } finally { setBusy(false); } };
  return <OtpPage mobile={mobile} code={code} onCodeChange={setCode} onVerify={verify} onBack={() => navigate("/login")} onResend={resend} notice={notice} loading={busy} error={error} />;
}

function OtpRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const flow = location.state?.flow || "login";
  const mobile = location.state?.mobile || "";
  const registration = location.state?.registration;
  const rememberMe = Boolean(location.state?.rememberMe);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!mobile || (flow === "registration" && !registration)) return <Navigate to={flow === "registration" ? "/register" : "/login"} replace />;
  const verify = async () => {
    setBusy(true); setError("");
    try { await repo.verifyOtp({ mobile, code, flow, registration, rememberMe }); navigate("/home", { replace: true }); }
    catch (err) { setError(err?.message || "تأیید کد ناموفق بود."); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError("");
    try { await repo.resendOtp({ flow, mobile, registration }); setNotice("کد تأیید مجدداً ارسال شد."); }
    catch (err) { setError(err?.message || "ارسال مجدد ناموفق بود."); }
    finally { setBusy(false); }
  };
  return <OtpPage mobile={mobile} flow={flow} code={code} onCodeChange={setCode} onVerify={verify} onBack={() => navigate(flow === "registration" ? "/register" : "/login")} onResend={resend} notice={notice} loading={busy} error={error} />;
}

function ProtectedLayout() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = async () => { if (!repo.hasSession()) { setLoading(false); return; } setLoading(true); setError(""); try { setData(await repo.getBootstrapData()); } catch (err) { setError(err?.message || "دریافت اطلاعات ناموفق بود."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  if (!repo.hasSession()) return <Navigate to="/login" replace />;
  if (loading) return <StateMessage loading message="در حال دریافت اطلاعات..." />;
  if (error || !data) return <StateMessage error={error || "اطلاعاتی دریافت نشد."} onRetry={load} />;
  if (data.onboardingRequired) return <DeviceOnboardingPage loading={loading} error={error} onSubmit={async (payload) => { try { await repo.bindDevice(payload); await load(); } catch (err) { setError(err?.message || "فعال‌سازی دستگاه ناموفق بود."); } }} />;
  return <AppFrame data={data} setData={setData} />;
}

function legacyAppFrame({ data, setData }) {
  const navigate = useNavigate(); const location = useLocation(); const [product, setProduct] = useState(() => localStorage.getItem("gamma_product") || PRODUCTS.LUMINEN); const [toast, setToast] = useState("");
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const changeProduct = (next) => { localStorage.setItem("gamma_product", next); setProduct(next); navigate("/home"); };
  const logout = () => { repo.logout(); navigate("/login", { replace: true }); };
  return <main className="app-shell"><AppHeader product={product} vehicle={data.vehicle} onProductChange={changeProduct} onNotify={() => showToast("اعلان جدیدی وجود ندارد.")} /><PageTransition key={location.pathname} className="content-shell"><Outlet context={{ data, setData, product, showToast, logout }} /></PageTransition><BottomNav product={product} path={location.pathname} onNavigate={navigate} />{toast && <div className="toast" role="status">{toast}</div>}</main>;
}

function AppFrame({ data, setData }) {
  const navigate = useNavigate();
  const location = useLocation();
  const allowedProducts = data.allowedProducts?.length ? data.allowedProducts : getUserProducts(data.user);
  const storedProduct = normalizeProductType(localStorage.getItem("gamma_product"));
  const [product, setProduct] = useState(() => allowedProducts.includes(storedProduct) ? storedProduct : allowedProducts[0]);
  const [toast, setToast] = useState("");
  useEffect(() => { if (!allowedProducts.includes(product)) setProduct(allowedProducts[0]); }, [allowedProducts, product]);
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const changeProduct = (next) => { const normalized = normalizeProductType(next); if (!allowedProducts.includes(normalized)) return; localStorage.setItem("gamma_product", normalized); setProduct(normalized); navigate("/home"); };
  const logout = () => { repo.logout(); navigate("/login", { replace: true }); };
  return <main className="app-shell"><AppHeader product={product} vehicle={data.vehicle} availableProducts={allowedProducts} onProductChange={changeProduct} onNotify={() => showToast("اعلان جدیدی وجود ندارد.")} /><PageTransition key={location.pathname} className="content-shell"><Outlet context={{ data, setData, product, allowedProducts, setProduct: changeProduct, showToast, logout }} /></PageTransition><BottomNav product={product} path={location.pathname} onNavigate={navigate} />{toast && <div className="toast" role="status">{toast}</div>}</main>;
}

function useApp() { return useOutletContext(); }
function useBack(fallback = "/home") { const navigate = useNavigate(); return () => { if (window.history.state?.idx > 0) navigate(-1); else navigate(fallback); }; }
function HomeRoute() { const { data, product } = useApp(); const navigate = useNavigate(); return <HomePage product={product} data={data} onNavigate={navigate} onDtcOpen={(dtc) => navigate(`/diagnostics/${dtc.code}`, { state: { dtc } })} />; }
function VehicleRoute() { const { data, product, setData, showToast } = useApp(); const update = async (changes) => { const raw = await repo.updateVehicle(data.vehicle.id, changes); setData((current) => ({ ...current, vehicle: { ...current.vehicle, ...raw, model: raw.model, year: String(raw.production_year || "—"), plate: raw.license_plate, color: raw.color } })); showToast("اطلاعات خودرو ذخیره شد."); }; return <VehiclePage product={product} vehicle={data.vehicle} onUpdate={update} onBack={useBack()} />; }
function DiagnosticsRoute() { const { product, data } = useApp(); const navigate = useNavigate(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <DiagnosticsPage dtcs={data.dtcs} onBack={() => navigate("/home")} onOpenDtc={(dtc) => navigate(`/diagnostics/${dtc.code}`, { state: { dtc } })} />; }
function DtcRoute() { const { product, data } = useApp(); const { code } = useParams(); const location = useLocation(); const back = useBack("/diagnostics"); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; const dtc = location.state?.dtc || data.dtcs.find((item) => item.code === code); return <DtcDetailPage dtc={dtc} onBack={back} />; }
function EcuRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); const [refreshing, setRefreshing] = useState(false); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; const refresh = async () => { setRefreshing(true); try { setData(await repo.refreshLiveData()); showToast("داده‌های ECU به‌روزرسانی شد."); } catch { showToast("به‌روزرسانی داده‌های ECU ناموفق بود."); } finally { setRefreshing(false); } }; return <EcuLivePage parameters={data.ecuParameters} onRefresh={refresh} refreshing={refreshing} onBack={back} />; }
function ConnectionRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <ConnectionPage connection={data.connection} onChange={(connection) => setData((current) => ({ ...current, connection }))} onNotify={showToast} onBack={back} />; }
function OtaRoute() { const { product, data } = useApp(); const back = useBack(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <OtaPage vehicle={data.vehicle} onCheck={repo.checkOta} onBack={back} />; }
function RoutesRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); const [syncing, setSyncing] = useState(false); if (product !== PRODUCTS.NEGAHBAN) return <Navigate to="/home" replace />; const sync = async () => { setSyncing(true); try { const fresh = await repo.syncNegahban(); setData(fresh); showToast("اطلاعات واقعی به‌روزرسانی شد."); } catch { showToast("به‌روزرسانی ناموفق بود."); } finally { setSyncing(false); } }; return <RoutesPage routePoints={data.routePoints} routeHistory={data.routeHistory} negahbanStatus={data.negahbanStatus} onSync={sync} syncing={syncing} onBack={back} />; }
function MpuRoute() { const { product, data } = useApp(); const back = useBack(); if (product !== PRODUCTS.NEGAHBAN) return <Navigate to="/home" replace />; return <MpuPage events={data.mpuEvents} onBack={back} />; }
function ProfileRoute() { const { data, setData, showToast, logout } = useApp(); const back = useBack(); const update = async (changes) => { const raw = await repo.updateProfile(changes); setData((current) => ({ ...current, user: { ...current.user, firstName: raw.first_name, lastName: raw.last_name, birthDate: raw.birth_date } })); showToast("پروفایل ذخیره شد."); }; return <ProfilePage user={data.user} apiMode={repo.runtime.useMockApi ? "mock" : "api"} onUpdate={update} onTestBackend={repo.testBackendConnection} onBack={back} onLogout={logout} onSetting={(name) => showToast(`${name} در نسخه فعلی در دسترس نیست.`)} />; }

void legacyOtpRoute;
void legacyAppFrame;
void RegisterRoute;
