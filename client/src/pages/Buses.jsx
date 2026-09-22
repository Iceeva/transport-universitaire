// Cas d'usage 1 - Gestion de capacité (temps réel).
import { useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import FillBar from '../components/FillBar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import LineBadge from '../components/LineBadge.jsx';
import { Loading, ErrorMessage } from '../components/Status.jsx';

const STATUS_CLASS = { ok: 'success', warn: 'warning', full: 'danger' };

export default function Buses() {
  const { data, error, loading } = usePolling(api.buses, 2000, []);
  const [routeFilter, setRouteFilter] = useState('all');

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;

  const routeIds = [...new Set(data.buses.map((b) => b.routeId))];
  const buses = data.buses
    .filter((b) => routeFilter === 'all' || b.routeId === routeFilter)
    .sort((a, b) => b.fillRate - a.fillRate);
  const s = data.summary;

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3">
          <KpiCard icon="bi-bus-front" label="Bus en circulation" value={s.buses} />
        </div>
        <div className="col-6 col-lg-3">
          <KpiCard icon="bi-people-fill" label="Passagers transportés" value={s.totalPassengers} />
        </div>
        <div className="col-6 col-lg-3">
          <KpiCard icon="bi-check-circle" label="Places libres" value={s.freeSeats} variant="success" />
        </div>
        <div className="col-6 col-lg-3">
          <KpiCard icon="bi-speedometer2" label="Remplissage flotte" value={`${s.fillRate} %`} variant="warning" />
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span className="fw-bold">
            <i className="bi bi-bus-front me-2" />
            Capacité de chaque bus - {data.clock}
          </span>
          <select
            className="form-select form-select-sm w-auto"
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
          >
            <option value="all">Toutes les lignes</option>
            {routeIds.map((id) => (
              <option key={id} value={id}>
                Ligne {id}
              </option>
            ))}
          </select>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Bus</th>
                <th>Ligne</th>
                <th>Direction</th>
                <th>Passagers</th>
                <th>Places libres</th>
                <th style={{ minWidth: 160 }}>Taux de remplissage</th>
                <th>État</th>
                <th>Prochain arrêt</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((b) => (
                <tr key={b.id}>
                  <td className="fw-bold">{b.name}</td>
                  <td>
                    <LineBadge id={b.routeId} color={b.color} />
                  </td>
                  <td className="small">{b.heading}</td>
                  <td>
                    {b.passengers} / {b.capacity}
                  </td>
                  <td>{b.freeSeats}</td>
                  <td>
                    <FillBar value={b.fillRate} />
                  </td>
                  <td>
                    <span className={`badge text-bg-${STATUS_CLASS[b.level]}`}>{b.status}</span>
                  </td>
                  <td className="small">
                    {b.nextStop} <span className="text-muted">({b.etaNextMin} min)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer small text-muted">
          Taux de remplissage = (passagers / capacité) x 100. Exemple : 45 passagers pour 60 places = 75 %, soit 15 places restantes.
        </div>
      </div>
    </div>
  );
}
