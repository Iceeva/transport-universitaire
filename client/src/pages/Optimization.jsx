// Cas d'usage 5 - Optimisation d'itinéraire : zones, heures de pointe, congestion, actions correctives.
import { useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import BarChart from '../components/BarChart.jsx';
import SourceToggle from '../components/SourceToggle.jsx';
import { Loading, ErrorMessage } from '../components/Status.jsx';

const ACTION_INFO = {
  ADD_BUS: { icon: 'bi-bus-front', label: 'Ajout de bus' },
  RESCHEDULE: { icon: 'bi-clock-history', label: 'Modification des horaires' },
  NEW_STOP: { icon: 'bi-geo-alt', label: 'Nouvel arrêt' },
  MERGE_LINES: { icon: 'bi-diagram-2', label: 'Fusion de lignes' },
};
const PRIORITY_CLASS = { haute: 'danger', moyenne: 'warning', basse: 'secondary' };

export default function Optimization() {
  const [source, setSource] = useState('history');
  const { data, error, loading } = usePolling(() => api.optimization(source), source === 'live' ? 5000 : 0, [source]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="mb-0">
          <i className="bi bi-graph-up-arrow me-2" />
          Optimisation des lignes
        </h5>
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <ErrorMessage message={error} />
      {loading && <Loading />}

      {data && (
        <>
          <div className="card mb-3">
            <div className="card-header fw-bold">Heures de pointe</div>
            <div className="card-body">
              <BarChart
                items={data.hourly.map((h) => ({ label: `${h.hour}h`, value: h.spawned, highlight: h.isPeak }))}
              />
              <div className="small mt-2">
                Étudiants arrivant aux arrêts par heure.{' '}
                {data.peakWindows.length > 0 ? (
                  <>
                    Pointes détectées (≥ 125 % de la moyenne horaire) :{' '}
                    {data.peakWindows.map((w) => (
                      <span key={w.label} className="badge text-bg-danger me-1">
                        {w.label}
                      </span>
                    ))}
                  </>
                ) : (
                  'Pas encore de pointe détectée.'
                )}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header fw-bold">Zones les plus fréquentées</div>
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Arrêt</th>
                      <th>Montées + descentes</th>
                      <th>Part du trafic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hotspots.map((h) => (
                      <tr key={h.id}>
                        <td>{h.name}</td>
                        <td>{h.traffic}</td>
                        <td>{h.sharePct} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header fw-bold">Points de congestion</div>
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Arrêt</th>
                      <th>Ont vu passer un bus plein</th>
                      <th>Attente moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.congestion.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-muted">
                          Aucun point de congestion détecté.
                        </td>
                      </tr>
                    )}
                    {data.congestion.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td className="text-danger">
                          {c.refusalRatePct} % ({c.leftBehind})
                        </td>
                        <td>{c.avgWaitMin} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <h5 className="mb-2">Actions correctives proposées</h5>
          {data.actions.length === 0 && <div className="alert alert-success">Aucune action nécessaire.</div>}
          <div className="row g-3">
            {data.actions.map((a, i) => {
              const info = ACTION_INFO[a.type];
              return (
                <div className="col-lg-6" key={i}>
                  <div className="card h-100">
                    <div className="card-body">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-primary">
                          <i className={`bi ${info.icon} me-1`} />
                          {info.label}
                        </span>
                        <span className={`badge text-bg-${PRIORITY_CLASS[a.priority]}`}>Priorité {a.priority}</span>
                      </div>
                      <div className="fw-bold">{a.title}</div>
                      <p className="small text-muted mb-2">{a.detail}</p>
                      <table className="table table-sm mb-0">
                        <tbody>
                          {Object.entries(a.indicators).map(([label, value]) => (
                            <tr key={label}>
                              <td className="text-muted">{label}</td>
                              <td className="text-end fw-bold">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
