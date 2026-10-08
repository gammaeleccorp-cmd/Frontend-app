import { Component, lazy, Suspense, useEffect, useState } from "react";
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
import { normalizeDigits } from "./utils/validation";
import { jalaliToIso } from "./utils/jalali.mjs";
import { isTelemetryFresh } from "./utils/telemetry.mjs";
import GammaSplash from "./components/splash/GammaSplash";
import * as repo from "./services/gammaRepository";

const LazyRoutesPage = lazy(() => import("./pages/RoutesPage"));
function RoutesPage(props) {
  return <RouteErrorBoundary><Suspense fallback={<StateMessage loading message="در حال بارگذاری نقشه..." />}><LazyRoutesPage {...props} /></Suspense></RouteErrorBoundary>;
}

class RouteErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="panel"><div className="form-error" role="alert">نقشه بارگذاری نشد.</div><button className="secondary-btn" type="button" onClick={() => window.location.reload()}>تلاش مجدد</button></section>;
    return this.props.children;
  }
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginRoute />} /><Route path="/register" element={<RegisterRoute />} /><Route path="/otp" element={<OtpRoute />} /><Route element={<ProtectedLayout />}><Route path="/home" element={<HomeRoute />} /><Route path="/add-device" element={<AddDeviceRoute />} /><Route path="/vehicle" element={<VehicleRoute />} /><Route path="/profile" element={<ProfileRoute />} /><Route path="/diagnostics" element={<DiagnosticsRoute />} /><Route path="/diagnostics/:code" element={<DtcRoute />} /><Route path="/ecu-live" element={<EcuRoute />} /><Route path="/connection" element={<ConnectionRoute />} /><Route path="/ota" element={<OtaRoute />} /><Route path="/routes" element={<RoutesRoute />} /><Route path="/imu-events" element={<MpuRoute />} /></Route><Route path="*" element={<Navigate to="/home" replace />} /></Routes></BrowserRouter>;
}

function LoginRoute() {
  const navigate = useNavigate(); const [mobile, setMobile] = useState(""); const [rememberMe, setRememberMe] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [intro, setIntro] = useState("playing");
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
  return <><LoginPage mobile={mobile} onMobileChange={setMobile} onSubmit={submitWithRemember} rememberMe={rememberMe} onRememberMeChange={setRememberMe} onRegister={() => navigate("/register")} loading={busy} error={error} intro={intro} />{intro !== "done" && <GammaSplash onReveal={() => setIntro("reveal")} onFinish={() => setIntro("done")} />}</>;
}

function RegisterRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(() => location.state?.registration || { mobile: location.state?.mobile || "", firstName: "", lastName: "", birthDate: "", deviceModel: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  if (repo.hasSession()) return <Navigate to="/home" replace />;

  const changeField = (key, value) => {
    const next = key === "mobile" ? normalizeDigits(value).replace(/\D/g, "").slice(0, 11)
      : key === "birthDate" ? normalizeDigits(value).replace(/[^0-9/]/g, "").slice(0, 10) : value;
    setForm((current) => ({ ...current, [key]: next }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  };
  const submit = async () => {
    const nextErrors = {};
    if (!/^09\d{9}$/.test(form.mobile)) nextErrors.mobile = "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود.";
    if (!form.firstName.trim()) nextErrors.firstName = "نام را وارد کنید.";
    if (!form.lastName.trim()) nextErrors.lastName = "نام خانوادگی را وارد کنید.";
    if (!jalaliToIso(form.birthDate)) nextErrors.birthDate = "تاریخ تولد شمسی معتبر با قالب yyyy/mm/dd وارد کنید.";
    if (!["NEGAHBAN", "RAHBAN", "LUMINEN"].includes(form.deviceModel)) nextErrors.deviceModel = "مدل دستگاه را انتخاب کنید.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setError("لطفاً خطاهای مشخص‌شده را برطرف کنید."); return; }
    setBusy(true); setError(""); setFieldErrors({});
    try {
      await repo.requestRegistrationOtp(form);
      navigate("/otp", { state: { flow: "registration", mobile: form.mobile, rememberMe, registration: form } });
    } catch (err) { setError(err?.message || "ارسال کد ناموفق بود."); setFieldErrors(err?.payload?.registration || {}); }
    finally { setBusy(false); }
  };
  return <RegisterPage form={form} onChange={changeField} rememberMe={rememberMe} onRememberMeChange={setRememberMe} onSubmit={submit} onLogin={() => navigate("/login")} loading={busy} error={error} fieldErrors={fieldErrors} />;
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
  return <OtpPage mobile={mobile} flow={flow} code={code} onCodeChange={setCode} onVerify={verify} onBack={() => navigate(flow === "registration" ? "/register" : "/login", { state: { registration, mobile } })} onResend={resend} notice={notice} loading={busy} error={error} />;
}

function ProtectedLayout() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = async (silent = false) => { if (!repo.hasSession()) { setLoading(false); return; } if (!silent) { setLoading(true); setError(""); } try { setData(await repo.getBootstrapData()); } catch (err) { if (!silent) setError(err?.message || "دریافت اطلاعات ناموفق بود."); } finally { if (!silent) setLoading(false); } };
  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load(true); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  if (!repo.hasSession()) return <Navigate to="/login" replace />;
  if (loading) return <StateMessage loading message="در حال دریافت اطلاعات..." />;
  if (error || !data) return <StateMessage error={error || "اطلاعاتی دریافت نشد."} onRetry={() => load()} />;
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
  const [product, setProduct] = useState(() => allowedProducts.includes(storedProduct) ? storedProduct : allowedProducts[0] || PRODUCTS.NEGAHBAN);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState("");
  useEffect(() => { if (allowedProducts.length && !allowedProducts.includes(product)) setProduct(allowedProducts[0]); }, [allowedProducts, product]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const changeProduct = (next) => { const normalized = normalizeProductType(next); if (!allowedProducts.includes(normalized)) return; localStorage.setItem("gamma_product", normalized); setProduct(normalized); navigate("/home"); };
  const logout = () => { repo.logout(); navigate("/login", { replace: true }); };
  return <main className="app-shell"><AppHeader product={product} vehicle={data.vehicle} availableProducts={allowedProducts} onProductChange={changeProduct} online={isTelemetryFresh(data.latestTelemetry, now)} /><PageTransition key={location.pathname} className="content-shell"><Outlet context={{ data, setData, product, now, allowedProducts, setProduct: changeProduct, showToast, logout }} /></PageTransition><BottomNav product={product} path={location.pathname} onNavigate={navigate} />{toast && <div className="toast" role="status">{toast}</div>}</main>;
}

function useApp() { return useOutletContext(); }
function useBack(fallback = "/home") { const navigate = useNavigate(); return () => { if (window.history.state?.idx > 0) navigate(-1); else navigate(fallback); }; }
function HomeRoute() { const { data, product, now } = useApp(); const navigate = useNavigate(); if (!data.devices?.length) return <section className="panel dashboard-empty"><h2>داشبورد گاما</h2><p>حساب شما آماده است. دستگاه را با کد عمومی آن متصل کنید.</p><p className="muted">اطلاعات خودرو اختیاری است.</p><button className="primary-btn" type="button" onClick={() => navigate("/add-device")}>افزودن دستگاه</button><button className="link-btn" type="button" onClick={() => navigate("/profile")}>پروفایل من</button></section>; return <><div className="home-actions"><button className="secondary-btn" type="button" onClick={() => navigate("/add-device")}>افزودن دستگاه</button></div><HomePage product={product} data={data} now={now} onNavigate={(path) => navigate(path.startsWith("/") ? path : `/${path}`)} onDtcOpen={(dtc) => navigate(`/diagnostics/${dtc.code}`, { state: { dtc } })} /></>; }
function AddDeviceRoute() { const { setData } = useApp(); const navigate = useNavigate(); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const submit = async (payload) => { setBusy(true); setError(""); try { await repo.bindDevice(payload); setData(await repo.getBootstrapData()); navigate("/home"); } catch (err) { setError(err?.message || "اتصال دستگاه ناموفق بود."); } finally { setBusy(false); } }; return <DeviceOnboardingPage loading={busy} error={error} onSubmit={submit} onBack={() => navigate("/home")} />; }
function VehicleRoute() { const { data, product, now, setData, showToast } = useApp(); const navigate = useNavigate(); const update = async (changes) => { if (!data.vehicle?.id) return; const raw = await repo.updateVehicle(data.vehicle.id, changes); setData((current) => ({ ...current, vehicle: { ...current.vehicle, ...raw, model: raw.model, year: String(raw.production_year || "—"), plate: raw.license_plate, color: raw.color } })); showToast("اطلاعات خودرو ذخیره شد."); }; return <VehiclePage product={product} data={data} now={now} onUpdate={update} onRoutes={() => navigate("/routes")} onBack={useBack()} />; }
function DiagnosticsRoute() { const { product, data } = useApp(); const navigate = useNavigate(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <DiagnosticsPage dtcs={data.dtcs} onBack={() => navigate("/home")} onOpenDtc={(dtc) => navigate(`/diagnostics/${dtc.code}`, { state: { dtc } })} />; }
function DtcRoute() { const { product, data } = useApp(); const { code } = useParams(); const location = useLocation(); const back = useBack("/diagnostics"); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; const dtc = location.state?.dtc || data.dtcs.find((item) => item.code === code); return <DtcDetailPage dtc={dtc} onBack={back} />; }
function EcuRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); const [refreshing, setRefreshing] = useState(false); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; const refresh = async () => { setRefreshing(true); try { setData(await repo.refreshLiveData()); showToast("داده‌های ECU به‌روزرسانی شد."); } catch { showToast("به‌روزرسانی داده‌های ECU ناموفق بود."); } finally { setRefreshing(false); } }; return <EcuLivePage parameters={data.ecuParameters} onRefresh={refresh} refreshing={refreshing} onBack={back} />; }
function ConnectionRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <ConnectionPage connection={data.connection} onChange={(connection) => setData((current) => ({ ...current, connection }))} onNotify={showToast} onBack={back} />; }
function OtaRoute() { const { product, data } = useApp(); const back = useBack(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <OtaPage vehicle={data.vehicle} onCheck={repo.checkOta} onBack={back} />; }
function RoutesRoute() { const { product, data, now, setData } = useApp(); const back = useBack(); const [syncing, setSyncing] = useState(false); const [syncError, setSyncError] = useState(""); if (product !== PRODUCTS.NEGAHBAN) return <Navigate to="/home" replace />; const sync = async () => { setSyncing(true); setSyncError(""); try { setData(await repo.syncNegahban()); } catch (error) { setSyncError(error?.message || "به‌روزرسانی ناموفق بود."); } finally { setSyncing(false); } }; return <RoutesPage routePoints={data.routePoints} routeHistory={data.routeHistory} latestTelemetry={data.latestTelemetry} deviceCode={data.vehicle?.deviceCode} online={isTelemetryFresh({ recorded_at: data.routeHistory?.[0]?.recordedAt }, now)} historyError={syncError || data.historyError} onSync={sync} syncing={syncing} onBack={back} />; }
function MpuRoute() { const { product, data } = useApp(); const back = useBack(); if (product !== PRODUCTS.NEGAHBAN) return <Navigate to="/home" replace />; return <MpuPage events={data.mpuEvents} onBack={back} />; }
function ProfileRoute() { const { data, setData, showToast, logout } = useApp(); const back = useBack(); const update = async (changes) => { const raw = await repo.updateProfile(changes); setData((current) => ({ ...current, user: { ...current.user, firstName: raw?.first_name ?? changes.first_name, lastName: raw?.last_name ?? changes.last_name, birthDate: raw?.birth_date ?? changes.birth_date } })); showToast("پروفایل ذخیره شد."); }; return <ProfilePage user={data.user} onUpdate={update} onTestBackend={repo.testBackendConnection} onBack={back} onLogout={logout} />; }

void legacyOtpRoute;
void legacyAppFrame;
