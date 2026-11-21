import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Flag } from 'lucide-react';
import { divIcon } from 'leaflet';
import { CircleMarker, Marker, Popup } from 'react-leaflet';
import RecordedPointPopup from './RecordedPointPopup';
import { recentRecordedPoints as recordedRoutePoints } from '../utils/flag15.mjs';
import { routeMarkers } from '../utils/routeMarkers.mjs';

function VehicleIcon({ heading }) {
  return <svg className="route-vehicle-icon" width="28" height="34" viewBox="0 0 28 40" fill="none" style={heading === null ? undefined : { transform: `rotate(${heading}deg)` }}>
    <rect x="1" y="8" width="4" height="8" rx="1.5" fill="#101216" />
    <rect x="23" y="8" width="4" height="8" rx="1.5" fill="#101216" />
    <rect x="1" y="27" width="4" height="8" rx="1.5" fill="#101216" />
    <rect x="23" y="27" width="4" height="8" rx="1.5" fill="#101216" />
    <rect x="4" y="1" width="20" height="38" rx="7" fill="#f5f6f8" stroke="#20252d" strokeWidth="1.5" />
    <path d="M7 11 Q14 8 21 11 L19 17 H9Z" fill="#25475b" />
    <path d="M9 26 H19 L21 31 Q14 34 7 31Z" fill="#25475b" />
    <rect x="9" y="18" width="10" height="7" rx="2" fill="#b4bdc8" />
    <path d="M6 5 H10 M18 5 H22" stroke="#ffcf65" strokeWidth="2" />
    <path d="M6 35 H10 M18 35 H22" stroke="#e85555" strokeWidth="2" />
  </svg>;
}

function RecordedMarker({ marker }) {
  const { element, icon } = useMemo(() => {
    const element = document.createElement('div');
    const icon = divIcon({
      html: element,
      className: `route-map-marker ${marker.kind}${marker.includesStart ? ' includes-start' : ''}`,
      iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24],
    });
    return { element, icon };
  }, [marker.kind, marker.includesStart]);
  return <>
    {createPortal(<span className="route-marker-symbol" aria-hidden="true">
      {marker.kind === 'end' ? <VehicleIcon heading={marker.heading} /> : <Flag size={23} />}
      {marker.includesStart && <span className="route-start-dot" />}
    </span>, element)}
    <Marker position={marker.point.coordinates} icon={icon} title={marker.label} alt={marker.label} zIndexOffset={marker.kind === 'end' ? 200 : 100}>
      <Popup maxWidth={240} minWidth={160}>
        <RecordedPointPopup marker={marker} />
      </Popup>
    </Marker>
  </>;
}

export default function RouteMarkers({ history }) {
  const markers = routeMarkers(history);
  return <>
    {recordedRoutePoints(history, Infinity).map((point, index) => <CircleMarker className="route-recorded-point" key={`${point.id}-${index}`} center={point.coordinates} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#ff6b1a', fillOpacity: 1 }}>
      <Popup><RecordedPointPopup marker={{ label: 'نقطه ثبت‌شده', points: [point] }} /></Popup>
    </CircleMarker>)}
    {markers.map(marker => <RecordedMarker key={marker.kind} marker={marker} />)}
  </>;
}
