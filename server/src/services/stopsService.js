// Cas d'usage 2 - Analyse des arrêts : montées, descentes, attente, temps moyen d'attente.
import { round1, formatClock } from '../lib/time.js';

function eventLabel(e) {
  const parts = [`${e.busName} (${e.routeId}) : ${e.boarded} monté(s), ${e.alighted} descendu(s)`];
  if (e.leftBehind > 0) parts.push(`${e.leftBehind} reste(nt) à quai`);
  return parts.join(', ');
}

export function stopView(engine, stop) {
  const state = engine.stopState[stop.id];
  const st = state.stats;
  const now = engine.clock;
  const currentWaitSec = state.waiting.reduce((sum, s) => sum + (now - s.createdAt), 0);

  return {
    id: stop.id,
    name: stop.name,
    lat: stop.lat,
    lon: stop.lon,
    kind: stop.kind,
    routeIds: stop.routeIds,
    waiting: state.waiting.length,
    boarded: st.boarded, // montées (cumul depuis 5h)
    alighted: st.alighted, // descentes (cumul)
    leftBehind: st.leftBehind, // étudiants ayant vu passer au moins un bus plein
    // temps moyen d'attente des étudiants déjà montés
    avgWaitMin: st.waitCount ? round1(st.waitSumSec / st.waitCount / 60) : 0,
    // attente moyenne de ceux qui sont encore à l'arrêt
    currentWaitMin: state.waiting.length ? round1(currentWaitSec / state.waiting.length / 60) : 0,
    lastEvents: st.events
      .slice(-3)
      .reverse()
      .map((e) => ({ time: formatClock(e.clock), label: eventLabel(e) })),
  };
}

export function getStops(engine) {
  return {
    clock: formatClock(engine.clock),
    stops: engine.network.stops.map((s) => stopView(engine, s)),
  };
}
