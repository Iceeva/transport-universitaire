// Carte schématique en SVG (pas de fond de carte externe : tout est calculé depuis les coordonnées GPS).
import { useMemo } from 'react';

const WIDTH = 700;

// Transforme latitude/longitude en coordonnées x/y du SVG (et inversement)
function makeProjection(stops) {
  const pad = 0.006;
  const lats = stops.map((s) => s.lat);
  const lons = stops.map((s) => s.lon);
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLon = Math.min(...lons) - pad;
  const maxLon = Math.max(...lons) + pad;
  const height = Math.round((WIDTH * (maxLat - minLat)) / (maxLon - minLon));

  return {
    height,
    toXY: (lat, lon) => ({
      x: ((lon - minLon) / (maxLon - minLon)) * WIDTH,
      y: ((maxLat - lat) / (maxLat - minLat)) * height,
    }),
    toLatLon: (x, y) => ({
      lat: maxLat - (y / height) * (maxLat - minLat),
      lon: minLon + (x / WIDTH) * (maxLon - minLon),
    }),
  };
}

export default function MapView({ network, buses = [], student = null, highlightStopId = null, onMapClick = null }) {
  const proj = useMemo(() => makeProjection(network.stops), [network]);
  const stopById = Object.fromEntries(network.stops.map((s) => [s.id, s]));

  function handleClick(event) {
    if (!onMapClick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * proj.height;
    onMapClick(proj.toLatLon(x, y));
  }

  const studentXY = student ? proj.toXY(student.lat, student.lon) : null;

  return (
    <div>
      <svg
        className={`map-svg ${onMapClick ? 'clickable' : ''}`}
        viewBox={`0 0 ${WIDTH} ${proj.height}`}
        onClick={handleClick}
      >
        {/* Lignes */}
        {network.routes.map((route) => {
          const points = route.stopIds
            .map((id) => proj.toXY(stopById[id].lat, stopById[id].lon))
            .map((p) => `${p.x},${p.y}`)
            .join(' ');
          return (
            <polyline
              key={route.id}
              points={points}
              fill="none"
              stroke={route.color}
              strokeWidth="4"
              strokeOpacity="0.65"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Arrêts */}
        {network.stops.map((stop) => {
          const { x, y } = proj.toXY(stop.lat, stop.lon);
          const classes = ['map-stop', stop.kind === 'campus' ? 'campus' : '', stop.id === highlightStopId ? 'highlight' : '']
            .join(' ');
          return (
            <g key={stop.id}>
              <circle className={classes} cx={x} cy={y} r={stop.id === highlightStopId ? 8 : 6}>
                <title>{stop.name}</title>
              </circle>
              <text className="map-label" x={x + 9} y={y - 7}>
                {stop.name}
              </text>
            </g>
          );
        })}

        {/* Bus */}
        {buses.map((bus) => {
          const { x, y } = proj.toXY(bus.lat, bus.lon);
          return (
            <g key={bus.id}>
              <circle className={`map-bus-${bus.level}`} cx={x} cy={y} r="9" stroke={bus.color} strokeWidth="3">
                <title>{`${bus.name} (${bus.routeId}) : ${bus.passengers}/${bus.capacity} passagers`}</title>
              </circle>
              <text className="map-bus-text" x={x} y={y}>
                {bus.name.replace('Bus ', '')}
              </text>
            </g>
          );
        })}

        {/* Position de l'étudiant */}
        {studentXY && (
          <g>
            <circle className="map-student" cx={studentXY.x} cy={studentXY.y} r="9" />
            <text className="map-label" x={studentXY.x + 12} y={studentXY.y + 4}>
              Vous
            </text>
          </g>
        )}
      </svg>

      <div className="d-flex flex-wrap gap-3 small mt-2">
        {network.routes.map((r) => (
          <span key={r.id}>
            <span className="line-dot" style={{ background: r.color }} />
            {r.id} : {r.name}
          </span>
        ))}
      </div>
      {buses.length > 0 && (
        <div className="small text-muted mt-1">
          Bus : <span className="text-success fw-bold">vert</span> &lt; 60 % ·{' '}
          <span className="fw-bold" style={{ color: 'var(--couleur-attention)' }}>orange</span> 60-90 % ·{' '}
          <span className="text-danger fw-bold">rouge</span> ≥ 90 %. Arrêts jaunes = campus.
        </div>
      )}
    </div>
  );
}
