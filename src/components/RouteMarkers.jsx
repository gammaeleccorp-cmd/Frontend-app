import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag } from 'lucide-react';
import { divIcon, popup as createLeafletPopup } from 'leaflet';
import { CircleMarker, Marker, useMap } from 'react-leaflet';
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

// Mouse users get a hover card; touchscreens use Leaflet's built-in tap/click
// popup handling. One Popup avoids duplicate detail cards over the same point.
function isMouseHover(event) {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches &&
    event.originalEvent?.pointerType !== 'touch' &&
    event.originalEvent?.sourceCapabilities?.firesTouchEvents !== true;
}

function pointEvents(marker, onSelect) {
  return {
    mouseover(event) {
      if (isMouseHover(event)) onSelect(marker);
    },
    click(event) {
      // On touch, Leaflet can process the map's click-to-close after the marker
      // click. Open the shared card on the next task, after that propagation.
      event.originalEvent?.stopPropagation?.();
      setTimeout(() => onSelect(marker), 0);
    },
  };
}

function RecordedMarker({ marker, onSelect }) {
  const leafletMarker = useRef(null);
  const { element, icon } = useMemo(() => {
    const element = document.createElement('div');
    const icon = divIcon({
      html: element,
      className: `route-map-marker ${marker.kind}${marker.includesStart ? ' includes-start' : ''}`,
      iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24],
    });
    return { element, icon };
  }, [marker.kind, marker.includesStart]);
  useEffect(() => {
    // Leaflet's divIcon click can be swallowed by its touch emulation before
    // the Marker handler runs. Listen on the actual icon host as well so a
    // finger tap selects the same shared popup used by mouse hover.
    const icon = leafletMarker.current?.getElement();
    if (!icon) return undefined;
    const selectFromIcon = (event) => {
      event.stopPropagation();
      onSelect(marker);
    };
    const selectFromTouch = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTimeout(() => onSelect(marker), 0);
    };
    icon.addEventListener('click', selectFromIcon);
    icon.addEventListener('touchend', selectFromTouch, { passive: false });
    return () => {
      icon.removeEventListener('click', selectFromIcon);
      icon.removeEventListener('touchend', selectFromTouch);
    };
  }, [marker, onSelect]);
  return <>
    {createPortal(<span className="route-marker-symbol" aria-hidden="true">
      {marker.kind === 'end' ? <VehicleIcon heading={marker.heading} /> : <Flag size={23} />}
      {marker.includesStart && <span className="route-start-dot" />}
    </span>, element)}
    <Marker ref={leafletMarker} position={marker.point.coordinates} icon={icon} title={marker.label} alt={marker.label} zIndexOffset={marker.kind === 'end' ? 200 : 100} eventHandlers={pointEvents(marker, onSelect)} />
  </>;
}

function RecordedPointMarker({ point, index, covered, onSelect }) {
  const layer = useRef(null);
  const marker = useMemo(() => ({ label: 'نقطه ثبت‌شده', points: [point] }), [point]);
  useEffect(() => {
    if (covered) return undefined;
    const path = layer.current?.getElement();
    if (!path) return undefined;
    const selectFromTouch = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTimeout(() => onSelect(marker), 0);
    };
    const selectFromClick = (event) => {
      event.stopPropagation();
      onSelect(marker);
    };
    path.addEventListener('click', selectFromClick);
    path.addEventListener('touchend', selectFromTouch, { passive: false });
    return () => {
      path.removeEventListener('click', selectFromClick);
      path.removeEventListener('touchend', selectFromTouch);
    };
  }, [covered, marker, onSelect]);
  return <CircleMarker ref={layer} className={`route-recorded-point${covered ? ' route-under-symbol' : ''}`}
    key={`${point.id}-${index}`} center={point.coordinates} radius={7}
    pathOptions={{ color: '#fff', weight: 2, fillColor: '#ff6b1a', fillOpacity: 1 }}
    eventHandlers={covered ? undefined : pointEvents(marker, onSelect)} />;
}

function selectionKey(marker) {
  if (!marker) return '';
  return `${marker.kind || 'recorded'}:${marker.points.map(point => `${point.id ?? ''}:${point.recordedAt}`).join('|')}`;
}

// Keep one Leaflet Popup instance for the whole map. Updating a declarative
// React-Leaflet <Popup> while Leaflet was still removing its previous DOM node
// could briefly leave two close buttons in the popup pane. Reusing the same
// instance makes marker switches, hover and touch clicks share one lifecycle.
function SharedRoutePopup({ selection, onClose }) {
  const map = useMap();
  const host = useMemo(() => document.createElement('div'), []);
  const popup = useMemo(() => createLeafletPopup({
    className: 'route-detail-popup', autoPan: false, maxWidth: 240, minWidth: 160,
  }).setContent(host), [host]);

  useEffect(() => {
    popup.on('remove', onClose);
    return () => {
      popup.off('remove', onClose);
      if (map.hasLayer(popup)) map.removeLayer(popup);
    };
  }, [map, onClose, popup]);

  useEffect(() => {
    if (!selection) {
      if (map.hasLayer(popup)) map.removeLayer(popup);
      return;
    }
    popup.setLatLng(selection.point?.coordinates || selection.points[0].coordinates);
    if (!map.hasLayer(popup)) popup.openOn(map);
    else popup.update();
  }, [map, popup, selection]);

  return selection ? createPortal(<RecordedPointPopup marker={selection} />, host) : null;
}

export default function RouteMarkers({ history }) {
  const [selection, setSelection] = useState(null);
  const selectMarker = useCallback((marker) => {
    setSelection(current => selectionKey(current) === selectionKey(marker) ? current : marker);
  }, []);
  const closePopup = useCallback(() => setSelection(null), []);
  const markers = routeMarkers(history);
  // The visible start/car symbols own their positions, so underlying circles
  // cannot compete for pointer or touch events.
  const symbolPositions = new Set(markers.map(marker => marker.point.coordinates.join(',')));
  return <>
    {recordedRoutePoints(history, Infinity).map((point, index) => {
      const covered = symbolPositions.has(point.coordinates.join(','));
      return <RecordedPointMarker key={`${point.id}-${index}`} point={point} index={index} covered={covered} onSelect={selectMarker} />;
    })}
    {markers.map(marker => <RecordedMarker key={marker.kind} marker={marker} onSelect={selectMarker} />)}
    <SharedRoutePopup selection={selection} onClose={closePopup} />
  </>;
}
