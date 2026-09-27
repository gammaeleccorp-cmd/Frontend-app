import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import AppHeader from "./components/AppHeader";
import BottomNav from "./components/BottomNav";
import StateMessage from "./components/StateMessage";
import LoginPage from "./pages/LoginPage";
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
import { PRODUCTS } from "./data/mockData";
import * as repo from "./services/gammaRepository";

const LazyRoutesPage = lazy(() => import("./pages/RoutesPage"));
function RoutesPage(props) {
  return <Suspense fallback={<StateMessage loading message="در حال بارگذاری نقشه..." />}><LazyRoutesPage {...props} /></Suspense>;
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginRoute />} /><Route path="/otp" element={<OtpRoute />} /><Route element={<ProtectedLayout />}><Route path="/home" element={<HomeRoute />} /><Route path="/vehicle" element={<VehicleRoute />} /><Route path="/profile" element={<ProfileRoute />} /><Route path="/diagnostics" element={<DiagnosticsRoute />} /><Route path="/diagnostics/:code" element={<DtcRoute />} /><Route path="/ecu-live" element={<EcuRoute />} /><Route path="/connection" element={<ConnectionRoute />} /><Route path="/ota" element={<OtaRoute />} /><Route path="/routes" element={<RoutesRoute />} /><Route path="/imu-events" element={<MpuRoute />} /></Route><Route path="*" element={<Navigate to="/home" replace />} /></Routes></BrowserRouter>;
}

function LoginRoute() {
  const navigate = useNavigate(); const [mobile, setMobile] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (repo.hasSession()) return <Navigate to="/home" replace />;
  const submit = async () => { setBusy(true); setError(""); try { await repo.requestOtp(mobile); navigate("/otp", { state: { mobile } }); } catch (err) { setError(err?.message || "ارسال کد ناموفق بود."); } finally { setBusy(false); } };
  return <LoginPage mobile={mobile} onMobileChange={setMobile} onSubmit={submit} loading={busy} error={error} />;
}

function OtpRoute() {
  const navigate = useNavigate(); const location = useLocation(); const mobile = location.state?.mobile || ""; const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  if (!mobile) return <Navigate to="/login" replace />;
  const verify = async () => { setBusy(true); setError(""); try { await repo.verifyOtp(mobile, code); navigate("/home", { replace: true }); } catch (err) { setError(err?.message || "تأیید کد ناموفق بود."); } finally { setBusy(false); } };
  const resend = async () => { setBusy(true); setError(""); try { await repo.resendOtp(mobile); setNotice("کد تأیید مجدداً ارسال شد."); } catch (err) { setError(err?.message || "ارسال مجدد ناموفق بود."); } finally { setBusy(false); } };
  return <OtpPage mobile={mobile} code={code} onCodeChange={setCode} onVerify={verify} onBack={() => navigate("/login")} onResend={resend} notice={notice} loading={busy} error={error} />;
}

function ProtectedLayout() {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = async () => { if (!repo.hasSession()) { setLoading(false); return; } setLoading(true); setError(""); try { setData(await repo.getBootstrapData()); } catch (err) { setError(err?.message || "دریافت اطلاعات ناموفق بود."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  if (!repo.hasSession()) return <Navigate to="/login" replace />;
  if (loading) return <StateMessage loading message="در حال دریافت اطلاعات..." />;
  if (error || !data) return <StateMessage error={error || "اطلاعاتی دریافت نشد."} onRetry={load} />;
  return <AppFrame data={data} setData={setData} />;
}

function AppFrame({ data, setData }) {
  const navigate = useNavigate(); const location = useLocation(); const [product, setProduct] = useState(() => localStorage.getItem("gamma_product") || PRODUCTS.LUMINEN); const [toast, setToast] = useState("");
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2400); };
  const changeProduct = (next) => { localStorage.setItem("gamma_product", next); setProduct(next); navigate("/home"); };
  const logout = () => { repo.logout(); navigate("/login", { replace: true }); };
  return <main className="app-shell"><AppHeader product={product} vehicle={data.vehicle} onProductChange={changeProduct} onNotify={() => showToast("اعلان جدیدی وجود ندارد.")} /><PageTransition key={location.pathname} className="content-shell"><Outlet context={{ data, setData, product, showToast, logout }} /></PageTransition><BottomNav product={product} path={location.pathname} onNavigate={navigate} />{toast && <div className="toast" role="status">{toast}</div>}</main>;
}

function useApp() { return useOutletContext(); }
function useBack(fallback = "/home") { const navigate = useNavigate(); return () => { if (window.history.state?.idx > 0) navigate(-1); else navigate(fallback); }; }
function HomeRoute() { const { data, product } = useApp(); const navigate = useNavigate(); return <HomePage product={product} data={data} onNavigate={navigate} onDtcOpen={(dtc) => navigate(`/diagnostics/${dtc.code}`, { state: { dtc } })} />; }
function VehicleRoute() { const { data, product } = useApp(); return <VehiclePage product={product} vehicle={data.vehicle} onBack={useBack()} />; }
function DiagnosticsRoute() { const { product, data } = useApp(); const navigate = useNavigate(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <DiagnosticsPage dtcs={data.dtcs} onBack={() => navigate("/home")} onOpenDtc={(dtc) => navigate(`/diagnostics/${dtc.code}`, { state: { dtc } })} />; }
function DtcRoute() { const { product, data } = useApp(); const { code } = useParams(); const location = useLocation(); const back = useBack("/diagnostics"); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; const dtc = location.state?.dtc || data.dtcs.find((item) => item.code === code); return <DtcDetailPage dtc={dtc} onBack={back} />; }
function EcuRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); const [refreshing, setRefreshing] = useState(false); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; const refresh = async () => { setRefreshing(true); try { setData(await repo.refreshLiveData()); showToast("داده‌های ECU به‌روزرسانی شد."); } catch { showToast("به‌روزرسانی داده‌های ECU ناموفق بود."); } finally { setRefreshing(false); } }; return <EcuLivePage parameters={data.ecuParameters} onRefresh={refresh} refreshing={refreshing} onBack={back} />; }
function ConnectionRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <ConnectionPage connection={data.connection} onChange={(connection) => setData((current) => ({ ...current, connection }))} onNotify={showToast} onBack={back} />; }
function OtaRoute() { const { product, data } = useApp(); const back = useBack(); if (product !== PRODUCTS.LUMINEN) return <Navigate to="/home" replace />; return <OtaPage vehicle={data.vehicle} onCheck={repo.checkOta} onBack={back} />; }
function RoutesRoute() { const { product, data, setData, showToast } = useApp(); const back = useBack(); const [syncing, setSyncing] = useState(false); if (product !== PRODUCTS.NEGAHBAN) return <Navigate to="/home" replace />; const sync = async () => { setSyncing(true); try { const status = await repo.syncNegahban(); setData((current) => ({ ...current, negahbanStatus: status })); showToast("همگام‌سازی انجام شد."); } catch { showToast("همگام‌سازی ناموفق بود."); } finally { setSyncing(false); } }; return <RoutesPage routePoints={data.routePoints} routeHistory={data.routeHistory} negahbanStatus={data.negahbanStatus} onSync={sync} syncing={syncing} onBack={back} />; }
function MpuRoute() { const { product, data } = useApp(); const back = useBack(); if (product !== PRODUCTS.NEGAHBAN) return <Navigate to="/home" replace />; return <MpuPage events={data.mpuEvents} onBack={back} />; }
function ProfileRoute() { const { data, showToast, logout } = useApp(); const back = useBack(); return <ProfilePage user={data.user} apiMode={repo.runtime.useMockApi ? "mock" : "api"} onTestBackend={repo.testBackendConnection} onBack={back} onLogout={logout} onSetting={(name) => showToast(`${name} در نسخه فعلی در دسترس نیست.`)} />; }
