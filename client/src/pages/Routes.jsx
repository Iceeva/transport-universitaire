// Cas d'usage 3 - Top 5 des itinéraires les plus fréquentés.
import { useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import FillBar from '../components/FillBar.jsx';
import BarChart from '../components/BarChart.jsx';
import SourceToggle from '../components/SourceToggle.jsx';
import LineBadge from '../components/LineBadge.jsx';
import { Loading, ErrorMessage } from '../components/Status.jsx';

export default function Routes() {
  const [source, setSource] = useState('history');
  const { data, error, loading } = usePolling(() => api.topRoutes(source), source === 'live' ? 5000 : 0, [source]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="mb-0">
          <i className="bi bi-signpost-split me-2" />
          Top 5 des itinéraires les plus utilisés
        </h5>
        <SourceToggle value={source} onChange={setSource} />
      </div>

      <ErrorMessage message={error} />
      {loading && <Loading />}

      {data && (
        <>
          <div className="card mb-3">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Itinéraire</th>
                    <th>Étudiants transportés</th>
                    <th style={{ minWidth: 190 }}>Taux de saturation (pointe)</th>
                    <th>Remplissage moyen</th>
                    <th>Refusés (bus plein)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.routes.map((r) => (
                    <tr key={r.routeId}>
                      <td className="fw-bold">{r.rank}</td>
                      <td>
                        <LineBadge id={r.routeId} color={r.color} /> {r.name}
                        <div className="small text-muted">
                          {r.buses} bus de {r.capacity} places
                        </div>
                      </td>
                      <td>
                        <strong>{r.transported.toLocaleString('fr-FR')}</strong> / jour
                      </td>
                      <td>
                        <FillBar value={r.peakSaturation} />
                        <div className="small text-muted">
                          à {String(r.peakHour).padStart(2, '0')}h, sens le plus chargé
                        </div>
                      </td>
                      <td>{r.saturation} %</td>
                      <td>{r.refused}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-footer small text-muted">
              Taux de saturation = charge maximale d'une heure dans le sens le plus chargé (passagers-km / places-km).
              Remplissage moyen = même calcul sur toute la journée et les deux sens. Total transporté :{' '}
              {data.totalTransported.toLocaleString('fr-FR')} étudiants.
            </div>
          </div>

          <div className="card">
            <div className="card-header fw-bold">
              <i className="bi bi-bar-chart-line me-2" />
              Étudiants transportés par heure (toutes lignes)
            </div>
            <div className="card-body">
              <BarChart
                items={data.hourly.map((h) => ({ label: `${h.hour}h`, value: h.boarded, highlight: h.isPeak }))}
              />
              <div className="small text-muted mt-1">En rouge : heures de pointe.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
