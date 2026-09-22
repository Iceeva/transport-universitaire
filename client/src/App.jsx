// Application principale : barre latérale de navigation, en-tête avec l'horloge de simulation.
import { useState } from 'react';
import { api } from './api.js';
import { usePolling } from './hooks/usePolling.js';
import Dashboard from './pages/Dashboard.jsx';
import Buses from './pages/Buses.jsx';
import Stops from './pages/Stops.jsx';
import Routes from './pages/Routes.jsx';
import Recommendation from './pages/Recommendation.jsx';
import Optimization from './pages/Optimization.jsx';

const PAGES = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'bi-speedometer2', Component: Dashboard },
  { id: 'buses', label: 'Bus et capacité', icon: 'bi-bus-front', Component: Buses },
  { id: 'stops', label: 'Arrêts', icon: 'bi-geo-alt', Component: Stops },
  { id: 'routes', label: 'Top itinéraires', icon: 'bi-signpost-split', Component: Routes },
  { id: 'recommendation', label: 'Recommandation', icon: 'bi-stars', Component: Recommendation },
  { id: 'optimization', label: 'Optimisation', icon: 'bi-graph-up-arrow', Component: Optimization },
];

function pageFromHash() {
  const id = window.location.hash.replace('#', '');
  return PAGES.some((p) => p.id === id) ? id : 'dashboard';
}

export default function App() {
  const [pageId, setPageId] = useState(pageFromHash());
  const clock = usePolling(api.clock, 2000, []);
  const page = PAGES.find((p) => p.id === pageId);

  function go(id) {
    window.location.hash = id;
    setPageId(id);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <i className="bi bi-bus-front-fill" />
          <div className="app-brand-text">
            <div className="title">Transport universitaire</div>
            <div className="subtitle">Poste de régulation - MTDI Bénin</div>
          </div>
        </div>

        <nav className="app-nav">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`app-nav-link ${p.id === pageId ? 'active' : ''}`}
              onClick={() => go(p.id)}
            >
              <i className={`bi ${p.icon}`} />
              {p.label}
            </button>
          ))}
        </nav>

        <div className="app-sidebar-footer">Données simulées - démonstration hors production.</div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <h1>
            <i className={`bi ${page.icon} me-2`} />
            {page.label}
          </h1>
          <span className="app-clock">
            <i className="bi bi-clock me-1" />
            {clock.data ? `Heure simulée ${clock.data.clock} (x${clock.data.speed})` : '...'}
          </span>
        </header>

        <main className="app-content">
          <page.Component />
        </main>

        <footer className="app-footer">
          Bootstrap et Bootstrap Icons installés via npm, aucune dépendance externe au chargement.
        </footer>
      </div>
    </div>
  );
}
