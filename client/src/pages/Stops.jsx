// Cas d'usage 2 - Analyse des arrêts (temps réel).
import { useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import { Loading, ErrorMessage } from '../components/Status.jsx';

export default function Stops() {
  const { data, error, loading } = usePolling(api.stops, 2000, []);
  const network = usePolling(api.network, 0, []);
  const [search, setSearch] = useState('');

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;

  const colors = Object.fromEntries((network.data ? network.data.routes : []).map((r) => [r.id, r.color]));
  const stops = data.stops
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.waiting - a.waiting);

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="fw-bold">
          <i className="bi bi-geo-alt me-2" />
          Analyse des arrêts - {data.clock}
        </span>
        <input
          className="form-control form-control-sm w-auto"
          placeholder="Rechercher un arrêt..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Arrêt</th>
              <th>Lignes</th>
              <th title="Étudiants présents maintenant">En attente</th>
              <th title="Cumul depuis 05h00">Montées</th>
              <th title="Cumul depuis 05h00">Descentes</th>
              <th title="Étudiants ayant vu passer au moins un bus plein">Restés à quai</th>
              <th>Attente moyenne</th>
              <th>Derniers passages</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((s) => (
              <tr key={s.id}>
                <td className="fw-bold">{s.name}</td>
                <td>
                  {s.routeIds.map((id) => (
                    <span key={id} className="line-badge" style={{ background: colors[id] || '#666' }}>
                      {id}
                    </span>
                  ))}
                </td>
                <td>
                  <span className={s.waiting >= 20 ? 'text-danger fw-bold' : ''}>{s.waiting}</span>
                </td>
                <td>{s.boarded}</td>
                <td>{s.alighted}</td>
                <td>{s.leftBehind > 0 ? <span className="text-danger">{s.leftBehind}</span> : 0}</td>
                <td>{s.avgWaitMin} min</td>
                <td className="small">
                  {s.lastEvents.length === 0 && <span className="text-muted">-</span>}
                  {s.lastEvents.map((e, i) => (
                    <div key={i}>
                      <span className="text-muted">{e.time}</span> {e.label}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-footer small text-muted">
        Montées, descentes et "restés à quai" sont des cumuls depuis 05h00. Le temps d'attente moyen est celui des étudiants déjà montés
        dans un bus. Exemple : 15 étudiants en attente, un bus en embarque 8, il en reste 7 à quai.
      </div>
    </div>
  );
}
