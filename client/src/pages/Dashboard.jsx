// Tableau de bord : indicateurs globaux, carte en direct et hypothèses de simulation.
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import KpiCard from '../components/KpiCard.jsx';
import MapView from '../components/MapView.jsx';
import BarChart from '../components/BarChart.jsx';
import { Loading, ErrorMessage } from '../components/Status.jsx';

export default function Dashboard() {
  const overview = usePolling(api.overview, 2000, []);
  const fleet = usePolling(api.buses, 2000, []);
  const network = usePolling(api.network, 0, []);
  const assumptions = usePolling(api.assumptions, 0, []);

  const o = overview.data;
  const error = overview.error || fleet.error || network.error;

  return (
    <div>
      <ErrorMessage message={error} />

      {o && (
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-3">
            <KpiCard icon="bi-bus-front" label="Bus en service" value={o.buses} hint={`${o.fullBuses} plein(s)`} />
          </div>
          <div className="col-6 col-lg-3">
            <KpiCard
              icon="bi-speedometer2"
              label="Taux de remplissage de la flotte"
              value={`${o.fillRate} %`}
              hint={`${o.passengers} / ${o.capacity} places`}
              variant={o.fillRate >= 60 ? 'warning' : 'success'}
            />
          </div>
          <div className="col-6 col-lg-3">
            <KpiCard icon="bi-people" label="Étudiants en attente" value={o.waiting} variant="warning" />
          </div>
          <div className="col-6 col-lg-3">
            <KpiCard
              icon="bi-hourglass-split"
              label="Attente moyenne (depuis 05h)"
              value={`${o.avgWaitMin} min`}
              hint={`${o.leftBehind} étudiants ont vu passer un bus plein`}
              variant="danger"
            />
          </div>
        </div>
      )}

      <div className="card mb-3">
        <div className="card-header fw-bold">
          <i className="bi bi-map me-2" />
          Carte du réseau en direct
        </div>
        <div className="card-body">
          {network.data ? (
            <MapView network={network.data} buses={fleet.data ? fleet.data.buses : []} />
          ) : (
            <Loading />
          )}
        </div>
      </div>

      {assumptions.data && <Assumptions data={assumptions.data} />}
    </div>
  );
}

// Hypothèses du jeu de données simulé (demandées par l'énoncé)
function Assumptions({ data }) {
  return (
    <div className="card">
      <div className="card-header fw-bold">
        <i className="bi bi-sliders me-2" />
        Hypothèses du jeu de données simulé
      </div>
      <div className="card-body">
        <p className="mb-2">
          {data.stops} arrêts, {data.routes} lignes, {data.buses} bus ({data.seats} places au total), service de{' '}
          {data.serviceHours}, environ {data.dailyStudents} déplacements d'étudiants par jour. La simulation
          tourne x{data.simSpeed} (1 seconde réelle = {data.simSpeed} secondes simulées).
        </p>

        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Ligne</th>
                <th>Bus</th>
                <th>Capacité</th>
                <th>Longueur</th>
                <th>Aller-retour</th>
                <th>Fréquence (par sens)</th>
                <th>Étudiants / jour</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.id}</strong> {l.name}
                  </td>
                  <td>{l.buses}</td>
                  <td>{l.capacity} places</td>
                  <td>{l.lengthKm} km</td>
                  <td>{l.cycleMin} min</td>
                  <td>un bus toutes les ~{l.headwayMin} min</td>
                  <td>{l.dailyStudents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="fw-bold mb-1">Profil horaire de la demande (étudiants par heure)</div>
        <BarChart
          items={data.hourlyProfile.map((h) => ({
            label: `${h.hour}h`,
            value: h.students,
            highlight: h.sharePct >= 10,
          }))}
        />
      </div>
    </div>
  );
}
