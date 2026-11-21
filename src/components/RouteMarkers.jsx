import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CarFront, Flag } from 'lucide-react';
import { divIcon } from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import RecordedPointPopup from './RecordedPointPopup';
import { routeMarkers } from '../utils/routeMarkers.mjs';

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
      {marker.kind === 'end' ? <CarFront size={25} style={marker.heading === null ? undefined : { transform: `rotate(${marker.heading}deg)` }} /> : <Flag size={23} />}
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
  return routeMarkers(history).map(marker => <RecordedMarker key={marker.kind} marker={marker} />);
}
