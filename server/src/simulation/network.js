// Construit le réseau (arrêts + lignes + distances) à partir des données brutes.
import { stops as rawStops } from '../data/stops.js';
import { lines as rawLines } from '../data/lines.js';
import { roadKm } from '../lib/geo.js';

export function buildNetwork() {
  const stopById = {};
  const stops = rawStops.map((s) => {
    const stop = { ...s, routeIds: [] };
    stopById[stop.id] = stop;
    return stop;
  });

  const routes = rawLines.map((line) => {
    const routeStops = line.stopIds.map((id) => {
      if (!stopById[id]) throw new Error(`Arrêt inconnu "${id}" dans la ligne ${line.id}`);
      return stopById[id];
    });

    // Distance de chaque tronçon (arrêt i -> arrêt i+1)
    const segmentKm = [];
    for (let i = 0; i < routeStops.length - 1; i++) {
      segmentKm.push(roadKm(routeStops[i], routeStops[i + 1]));
    }
    const lengthKm = segmentKm.reduce((a, b) => a + b, 0);

    // Couples (origine, destination) possibles sur la ligne, avec un poids :
    // popularité de l'origine x popularité de la destination (x3 si la destination est un campus)
    const pairs = [];
    for (let i = 0; i < routeStops.length; i++) {
      for (let j = i + 1; j < routeStops.length; j++) {
        const campusBonus = routeStops[j].kind === 'campus' ? 3 : 1;
        pairs.push({ i, j, weight: routeStops[i].popularity * routeStops[j].popularity * campusBonus });
      }
    }

    routeStops.forEach((s) => s.routeIds.push(line.id));
    return { ...line, stops: routeStops, segmentKm, lengthKm, pairs };
  });

  const routeById = Object.fromEntries(routes.map((r) => [r.id, r]));
  return { stops, stopById, routes, routeById };
}
