import { useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { polygonError } from "../utils/flag15.mjs";
function MapActions({ open, onPoint }) {
 const map = useMap();
 useEffect(() => { if (open) { const timer=setTimeout(() => map.invalidateSize(),220); return () => clearTimeout(timer); } },[open,map]);
 useMapEvents({ click: e => { if (!e.originalEvent?.target?.closest?.('.leaflet-control')) onPoint([e.latlng.lat,e.latlng.lng]); } });
 return null;
}
export default function GeofenceEditor({ fence, deviceCode, lastPoint }) {
 const [open,setOpen]=useState(false);
 const [points,setPoints]=useState([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const invalid=polygonError(points);
 const existing=fence.value;
 const save=async () => { setBusy(true);setNotice(""); try { if(!invalid && !busy && existing?.supports_polygon && await fence.save({boundary_points:points})) setNotice("محدوده ذخیره شد."); } finally {setBusy(false);} };
 return <section className="panel">
 <button className="secondary-btn" type="button" aria-expanded={open} aria-controls="fence-editor" onClick={()=>setOpen(v=>!v)}>محدوده جغرافیایی · {open ? "بستن" : "باز کردن"}</button>
 <div id="fence-editor" className={`fence-disclosure ${open ? "is-open" : ""}`} inert={open ? undefined : ""}><div>
 <p>چهار نقطه را به‌ترتیب روی نقشه انتخاب کنید.</p>
 <div className="map-wrap"><MapContainer center={lastPoint || [35.6892,51.389]} zoom={13} doubleClickZoom={false} style={{height:300,width:"100%"}}>
 <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{tileerror:()=>setError("بارگذاری نقشه ناموفق بود.")}} />
 <MapActions open={open} onPoint={p=>{if(!busy) {setPoints(v=>v.length<4?[...v,p]:v);setNotice("");}}}/>
 {existing?.configured && Number.isFinite(existing.latitude) && Number.isFinite(existing.longitude) && !existing.boundary_points?.length && <Circle center={[existing.latitude,existing.longitude]} radius={existing.radius_m}/>}
 {existing?.boundary_points?.length===4 && <Polygon positions={existing.boundary_points} pathOptions={{color:"#888"}}/>}
 {points.length===4 ? <Polygon positions={points} pathOptions={{color:invalid ? "#d33":"#ff6b1a"}}/> : <Polyline positions={points} color="#ff6b1a"/>}
 {points.map((p,i)=><CircleMarker key={i} center={p} radius={7}><Tooltip permanent direction="top">{i+1}</Tooltip></CircleMarker>)}
 </MapContainer></div>
 <p role="status">{points.length.toLocaleString("fa-IR")} از ۴</p><p>{invalid}</p>
 {!existing?.supports_polygon && <p role="status">ذخیره محدوده چندضلعی به پشتیبانی سرور نیاز دارد.</p>}
 {error && <p role="alert">{error}</p>}{fence.error && <p role="alert">{fence.error}</p>}{notice && <p role="status">{notice}</p>}
 <div className="fence-actions"><button className="secondary-btn" disabled={!points.length || busy} onClick={()=>setPoints(v=>v.slice(0,-1))}>حذف آخرین نقطه</button><button className="secondary-btn" disabled={!points.length || busy} onClick={()=>setPoints([])}>شروع دوباره</button><button className="primary-btn" disabled={!!invalid || busy || !existing?.supports_polygon} onClick={save}>ذخیره محدوده</button>
 {existing?.is_active && <button className="secondary-btn" disabled={fence.loading} onClick={()=>fence.disable()}>غیرفعال کردن محدوده فعلی</button>}</div>
 {!deviceCode && <p>دستگاهی انتخاب نشده است.</p>}
 </div></div></section>;
}
