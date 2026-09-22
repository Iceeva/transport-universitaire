// Routes de l'API REST.
import { Router } from 'express';
import { getFleet } from '../services/fleetService.js';
import { getStops } from '../services/stopsService.js';
import { getNetwork, getAssumptions, getOverview } from '../services/networkService.js';
import { topRoutes, optimizationReport } from '../services/analyticsService.js';
import { recommend, simulateCrowd, normalizeWeights } from '../services/recommendationService.js';
import { recommendationParams, config } from '../config.js';
import { formatClock } from '../lib/time.js';

export function createApiRouter(simulator) {
  const router = Router();
  const { network } = simulator;

  // ?source=live (journée en cours) ou history (journée complète simulée, par défaut)
  const engineFor = (req) => simulator.engineFor(req.query.source === 'live' ? 'live' : 'history');

  router.get('/health', (req, res) => res.json({ status: 'ok' }));

  router.get('/clock', (req, res) =>
    res.json({ clock: formatClock(simulator.live.clock), speed: config.simSpeed, day: simulator.day + 1 }),
  );

  router.get('/network', (req, res) => res.json(getNetwork(network)));
  router.get('/assumptions', (req, res) => res.json(getAssumptions(network)));
  router.get('/overview', (req, res) => res.json(getOverview(simulator.live)));

  // Cas d'usage 1 : capacité des bus
  router.get('/buses', (req, res) => res.json(getFleet(simulator.live)));

  // Cas d'usage 2 : analyse des arrêts
  router.get('/stops', (req, res) => res.json(getStops(simulator.live)));

  // Cas d'usage 3 : top des itinéraires
  router.get('/routes/top', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 5, 10);
    res.json({ source: req.query.source === 'live' ? 'live' : 'history', ...topRoutes(engineFor(req), limit) });
  });

  // Cas d'usage 5 : optimisation
  router.get('/analytics/optimization', (req, res) => {
    res.json({ source: req.query.source === 'live' ? 'live' : 'history', ...optimizationReport(engineFor(req)) });
  });

  // Cas d'usage 4 : recommandation
  router.get('/recommendations/config', (req, res) =>
    res.json({ params: recommendationParams, weights: normalizeWeights() }),
  );

  router.post('/recommendations', (req, res) => {
    const body = req.body || {};
    res.json(recommend(simulator.live, body, { hold: Boolean(body.hold) }));
  });

  router.post('/recommendations/crowd', (req, res) => {
    res.json(simulateCrowd(simulator.live, req.body || {}));
  });

  return router;
}
