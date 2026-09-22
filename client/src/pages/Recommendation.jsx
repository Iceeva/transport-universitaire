// Cas d'usage 4 - Recommandation intelligente du meilleur bus + cas limite des 200 étudiants.
import { useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import MapView from '../components/MapView.jsx';
import LineBadge from '../components/LineBadge.jsx';
import { Loading, ErrorMessage } from '../components/Status.jsx';

const CRITERIA = [
  { key: 'eta', label: "Temps d'arrivée du bus à l'arrêt", icon: 'bi-clock-history' },
  { key: 'seats', label: 'Places disponibles', icon: 'bi-people' },
  { key: 'walk', label: "Distance jusqu'à l'arrêt", icon: 'bi-person-walking' },
  { key: 'total', label: 'Temps total du trajet', icon: 'bi-signpost-split' },
];

export default function Recommendation() {
  const network = usePolling(api.network, 0, []);
  const fleet = usePolling(api.buses, 3000, []);

  // Position de départ par défaut : à environ 400 m de l'arrêt Togba
  const [position, setPosition] = useState({ lat: 6.436, lon: 2.335 });
  const [presetId, setPresetId] = useState('togba');
  const [destination, setDestination] = useState('uac');
  const [weights, setWeights] = useState({ eta: 35, seats: 20, walk: 15, total: 30 });
  const [hold, setHold] = useState(false);
  const [result, setResult] = useState(null);
  const [crowdCount, setCrowdCount] = useState(200);
  const [crowd, setCrowd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!network.data) return network.error ? <ErrorMessage message={network.error} /> : <Loading />;
  const stops = network.data.stops;
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  function payload() {
    return { lat: position.lat, lon: position.lon, destinationStopId: destination, weights };
  }

  function choosePreset(id) {
    setPresetId(id);
    const stop = stops.find((s) => s.id === id);
    // On place l'étudiant à environ 400 m de l'arrêt pour que la marche compte dans le score
    if (stop) setPosition({ lat: stop.lat + 0.003, lon: stop.lon + 0.003 });
  }

  function useMyPosition() {
    if (!navigator.geolocation) return setError('La géolocalisation n\'est pas disponible sur cet appareil.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPresetId('');
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => setError('Impossible de récupérer votre position.'),
    );
  }

  async function ask() {
    setBusy(true);
    setError('');
    try {
      setResult(await api.recommend({ ...payload(), hold }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runCrowd() {
    setBusy(true);
    setError('');
    try {
      setCrowd(await api.crowd({ ...payload(), count: crowdCount }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row g-3">
      {/* ---------- Colonne de gauche : formulaire + carte ---------- */}
      <div className="col-lg-6">
        <div className="card mb-3">
          <div className="card-header fw-bold">
            <i className="bi bi-stars me-2" />
            Trouver mon bus
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label fw-bold">Ma position</label>
              <select className="form-select mb-2" value={presetId} onChange={(e) => choosePreset(e.target.value)}>
                <option value="">Position personnalisée (cliquer sur la carte)</option>
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    Près de {s.name}
                  </option>
                ))}
              </select>
              <div className="row g-2">
                <div className="col">
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    step="0.0001"
                    value={Number(position.lat.toFixed(5))}
                    onChange={(e) => setPosition({ ...position, lat: Number(e.target.value) })}
                  />
                </div>
                <div className="col">
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    step="0.0001"
                    value={Number(position.lon.toFixed(5))}
                    onChange={(e) => setPosition({ ...position, lon: Number(e.target.value) })}
                  />
                </div>
                <div className="col-auto">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={useMyPosition}>
                    <i className="bi bi-geo-alt-fill" /> GPS
                  </button>
                </div>
              </div>
              <div className="form-text">Latitude / longitude. Vous pouvez aussi cliquer sur la carte.</div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Ma destination</label>
              <select className="form-select" value={destination} onChange={(e) => setDestination(e.target.value)}>
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">Importance des critères (pondérations)</label>
              {CRITERIA.map((c) => (
                <div className="d-flex align-items-center gap-2 mb-1" key={c.key}>
                  <i className={`bi ${c.icon}`} />
                  <span className="small flex-grow-1">{c.label}</span>
                  <input
                    type="range"
                    className="form-range w-25"
                    min="0"
                    max="100"
                    value={weights[c.key]}
                    onChange={(e) => setWeights({ ...weights, [c.key]: Number(e.target.value) })}
                  />
                  <span className="weight-value small">{Math.round((weights[c.key] / weightSum) * 100)} %</span>
                </div>
              ))}
              <div className="form-text">Les pondérations sont automatiquement ramenées à un total de 100 %.</div>
            </div>

            <div className="form-check mb-3">
              <input
                id="hold"
                className="form-check-input"
                type="checkbox"
                checked={hold}
                onChange={(e) => setHold(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="hold">
                Réserver provisoirement une place sur le bus recommandé
              </label>
            </div>

            <button className="btn btn-primary" onClick={ask} disabled={busy}>
              <i className="bi bi-stars me-1" />
              Recommander un bus
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header fw-bold">Carte (cliquez pour placer votre position)</div>
          <div className="card-body">
            <MapView
              network={network.data}
              buses={fleet.data ? fleet.data.buses : []}
              student={position}
              highlightStopId={result && result.best ? result.best.boardStop.id : null}
              onMapClick={(p) => {
                setPresetId('');
                setPosition(p);
              }}
            />
          </div>
        </div>
      </div>

      {/* ---------- Colonne de droite : résultats ---------- */}
      <div className="col-lg-6">
        <ErrorMessage message={error} />
        {!result && (
          <div className="alert alert-info">
            Choisissez votre position et votre destination, puis cliquez sur « Recommander un bus ».
          </div>
        )}
        {result && <Result result={result} />}
        <CrowdCard
          count={crowdCount}
          setCount={setCrowdCount}
          run={runCrowd}
          busy={busy}
          crowd={crowd}
          destinationName={(stops.find((s) => s.id === destination) || {}).name}
        />
      </div>
    </div>
  );
}

function Result({ result }) {
  const best = result.best;
  if (!best) {
    return (
      <div className="alert alert-warning">
        <i className="bi bi-exclamation-triangle me-2" />
        {result.message}
        <Alternatives list={result.alternatives} />
      </div>
    );
  }

  return (
    <div>
      <div className="card border-success mb-3">
        <div className="card-header bg-success text-white d-flex justify-content-between">
          <span className="fw-bold">
            <i className="bi bi-bus-front-fill me-2" />
            Bus recommandé : {best.bus.name}
          </span>
          <span>Score {best.score} / 100</span>
        </div>
        <div className="card-body">
          <div className="mb-2">
            <LineBadge id={best.route.id} color={best.route.color} /> {best.route.name}
          </div>
          <div className="mb-3">
            Montez à <strong>{best.boardStop.name}</strong> <i className="bi bi-arrow-right" /> descendez à{' '}
            <strong>{best.destination.name}</strong>
          </div>

          <div className="row g-2 mb-3">
            <Metric label="Arrivée du bus" value={`${best.etaMin} min`} />
            <Metric label="Places libres" value={best.freeSeats} />
            <Metric label="Marche" value={`${best.walkMeters} m`} />
            <Metric label="Trajet total" value={`${best.totalMin} min`} />
          </div>

          <p className="mb-2">{result.message}</p>
          {result.hold && (
            <div className="alert alert-info py-2 mb-2">
              <i className="bi bi-shield-check me-1" />
              Place réservée pendant {result.hold.validMin} min (réservation n°{result.hold.id}).
            </div>
          )}

          <div className="fw-bold small mb-1">Détail du score</div>
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>Critère</th>
                <th>Note (0-1)</th>
                <th>Poids</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td>{best.parts[c.key].toFixed(2)}</td>
                  <td>{Math.round(result.weights[c.key] * 100)} %</td>
                  <td>{best.contributions[c.key].toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result.alternatives.length > 0 && (
        <div className="card mb-3">
          <div className="card-header fw-bold">Autres options</div>
          <Alternatives list={result.alternatives} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="col-6 col-md-3">
      <div className="metric-box">
        <div className="small text-muted">{label}</div>
        <div className="metric-value">{value}</div>
      </div>
    </div>
  );
}

function Alternatives({ list }) {
  if (!list || list.length === 0) return null;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Bus</th>
            <th>Arrêt</th>
            <th>Arrivée</th>
            <th>Places</th>
            <th>Trajet</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {list.map((o, i) => (
            <tr key={i}>
              <td>
                <LineBadge id={o.route.id} color={o.route.color} /> {o.bus.name}
              </td>
              <td>{o.boardStop.name}</td>
              <td>{o.etaMin} min</td>
              <td>{o.full ? <span className="badge text-bg-danger">complet</span> : o.freeSeats}</td>
              <td>{o.totalMin} min</td>
              <td>{o.full ? '-' : o.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Cas limite : que se passe-t-il si 200 étudiants reçoivent la même recommandation ?
function CrowdCard({ count, setCount, run, busy, crowd, destinationName }) {
  return (
    <div className="card">
      <div className="card-header fw-bold">
        <i className="bi bi-people-fill me-2" />
        Cas limite : plusieurs étudiants demandent la même recommandation
      </div>
      <div className="card-body">
        <p className="small text-muted">
          Simule N étudiants au même endroit, allant à {destinationName}, qui demandent tous un bus en même temps : d'abord
          sans réservation de places, puis avec réservation provisoire (solution retenue).
        </p>
        <div className="input-group input-group-sm mb-3" style={{ maxWidth: 320 }}>
          <span className="input-group-text">Étudiants</span>
          <input
            type="number"
            className="form-control"
            min="1"
            max="2000"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <button className="btn btn-outline-primary" onClick={run} disabled={busy}>
            Simuler
          </button>
        </div>

        {crowd && (
          <div className="row g-3">
            <div className="col-md-6">
              <CrowdResult title="Sans réservation" variant="danger" data={crowd.withoutHolds} />
            </div>
            <div className="col-md-6">
              <CrowdResult title="Avec réservation" variant="success" data={crowd.withHolds} />
            </div>
            {crowd.extraBusesSuggested > 0 && (
              <div className="col-12">
                <div className="alert alert-warning mb-0 py-2 small">
                  <i className="bi bi-exclamation-triangle me-1" />
                  {crowd.withHolds.unserved} étudiants ne trouvent aucune place sur les prochains passages : il faudrait
                  environ <strong>{crowd.extraBusesSuggested} bus supplémentaire(s)</strong> sur cette ligne.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CrowdResult({ title, variant, data }) {
  return (
    <div className={`border border-${variant} rounded p-2 h-100`}>
      <div className={`fw-bold text-${variant}`}>{title}</div>
      <div className="small mb-2">
        Bus utilisés : <strong>{data.busesUsed}</strong> · Envoyés vers un bus sans place :{' '}
        <strong>{data.overloaded}</strong> · Sans solution : <strong>{data.unserved}</strong>
      </div>
      <table className="table table-sm mb-0">
        <thead>
          <tr>
            <th>Bus</th>
            <th>Passage</th>
            <th>Affectés</th>
            <th>Places</th>
          </tr>
        </thead>
        <tbody>
          {data.distribution.map((d) => (
            <tr key={`${d.busId}-${d.etaMin}`}>
              <td>{d.busName}</td>
              <td>{d.etaMin} min</td>
              <td className={d.overload > 0 ? 'text-danger fw-bold' : ''}>{d.assigned}</td>
              <td>{d.freeSeats}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
