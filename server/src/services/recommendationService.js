// Cas d'usage 4 - Recommandation intelligente du meilleur bus.
//
// Principe :
//  1. on cherche les arrêts proches de l'étudiant (marche <= walkMaxKm)
//  2. pour chaque bus qui dessert l'arrêt ET la destination dans le bon sens, on prévoit :
//     l'heure d'arrivée à l'arrêt, les places libres à ce moment-là, le temps total du trajet
//  3. on note chaque option avec une fonction de score pondérée (voir computeScore)
//  4. le bus avec le meilleur score et au moins une place libre est recommandé
//
// Cas limite (200 étudiants en même temps) : chaque recommandation peut "réserver"
// provisoirement une place (hold). Les places réservées sont retirées des places libres
// du bus, donc les étudiants suivants sont automatiquement répartis sur d'autres bus.

import { recommendationParams as params } from '../config.js';
import { haversineKm, walkSeconds, WALK_DETOUR } from '../lib/geo.js';
import { round1, toMin } from '../lib/time.js';
import { DWELL_ESTIMATE_SEC } from '../simulation/engine.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const CRITERIA = ['eta', 'seats', 'walk', 'total'];
const CRITERIA_LABELS = {
  eta: 'arrive plus tôt',
  seats: 'plus de places libres',
  walk: 'arrêt plus proche',
  total: 'trajet total plus court',
};

// Ramène les pondérations à une somme de 1 (valeurs négatives ignorées)
export function normalizeWeights(input = {}) {
  const merged = { ...params.defaultWeights, ...input };
  const clean = {};
  let sum = 0;
  for (const key of CRITERIA) {
    clean[key] = Math.max(0, Number(merged[key]) || 0);
    sum += clean[key];
  }
  if (sum === 0) return { ...params.defaultWeights };
  for (const key of CRITERIA) clean[key] /= sum;
  return clean;
}

// Fonction de score : chaque critère est ramené entre 0 (mauvais) et 1 (excellent),
// puis on fait la somme pondérée. Résultat final entre 0 et 100.
//   eta   : 1 - attente / 30 min
//   seats : places libres / 8 (plafonné à 1)
//   walk  : 1 - distance de marche / 1,5 km
//   total : 1 - durée totale / 90 min
export function computeScore(metrics, weights, p = params) {
  const parts = {
    eta: 1 - Math.min(metrics.etaSec / 60 / p.etaMaxMin, 1),
    seats: Math.min(Math.max(metrics.freeSeats, 0) / p.seatsTarget, 1),
    walk: 1 - Math.min(metrics.walkKm / p.walkMaxKm, 1),
    total: 1 - Math.min(metrics.totalSec / 60 / p.totalMaxMin, 1),
  };
  const contributions = {};
  let score = 0;
  for (const key of CRITERIA) {
    contributions[key] = weights[key] * parts[key] * 100;
    score += contributions[key];
  }
  return { score: round1(score), parts, contributions };
}

function readInput(engine, input) {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpError(400, 'Position invalide : lat et lon sont obligatoires.');
  }
  const destination = engine.network.stopById[input.destinationStopId];
  if (!destination) throw new HttpError(400, 'Destination inconnue.');
  return { origin: { lat, lon }, destination };
}

// Cherche toutes les options (bus + arrêt de montée) pour aller à la destination
function findOptions(engine, origin, destination, weights, cache) {
  const { network } = engine;
  const options = [];

  for (const boardStop of network.stops) {
    if (boardStop.id === destination.id) continue;
    const walkKm = haversineKm(origin, boardStop) * WALK_DETOUR;
    if (walkKm > params.walkMaxKm) continue;
    const walkSec = walkSeconds(walkKm);

    for (const route of network.routes) {
      const sb = route.stopIds.indexOf(boardStop.id);
      const sd = route.stopIds.indexOf(destination.id);
      if (sb < 0 || sd < 0) continue;
      const needDir = Math.sign(sd - sb); // sens de circulation nécessaire

      for (const bus of engine.buses) {
        if (bus.routeId !== route.id) continue;
        if (!cache.has(bus.id)) cache.set(bus.id, engine.projectBus(bus));
        const path = cache.get(bus.id);
        // On regarde les 2 prochains passages du bus à l'arrêt (dans le bon sens, et que
        // l'étudiant a le temps d'atteindre à pied). Si le 1er est plein, le 2e peut convenir.
        let passes = 0;
        for (let a = 0; a < path.length && passes < 2; a++) {
          const e = path[a];
          if (e.stopIdx !== sb || e.dir !== needDir || e.eta < walkSec) continue;
          passes += 1;

          // Passage suivant à la destination
          const d = path.findIndex((x, i) => i > a && x.stopIdx === sd);
          if (d < 0) continue;

          // Places libres prévues à l'arrivée du bus à l'arrêt :
          // passagers actuels - ceux qui seront descendus avant - places déjà réservées
          const stopsBefore = new Set(path.slice(0, a + 1).map((x) => x.stopIdx));
          const leaving = bus.passengers.filter((p) => stopsBefore.has(p.destIdx)).length;
          const arrivalAt = engine.clock + e.eta;
          const held = engine.holds.filter(
            (h) => h.busId === bus.id && h.boardAt <= arrivalAt && h.alightAt > arrivalAt,
          ).length;
          const freeSeats = bus.capacity - (bus.passengers.length - leaving) - held;

          const metrics = { etaSec: e.eta, totalSec: path[d].eta, walkKm, freeSeats };
          const scoring = computeScore(metrics, weights);

          options.push({
            bus: { id: bus.id, name: bus.name, capacity: bus.capacity },
            route: { id: route.id, name: route.name, color: route.color },
            boardStop: { id: boardStop.id, name: boardStop.name },
            destination: { id: destination.id, name: destination.name },
            etaMin: toMin(metrics.etaSec),
            waitMin: toMin(Math.max(0, metrics.etaSec - walkSec)),
            walkMeters: Math.round(walkKm * 1000),
            walkMin: toMin(walkSec),
            rideMin: toMin(Math.max(0, path[d].eta - e.eta - DWELL_ESTIMATE_SEC)),
            totalMin: toMin(metrics.totalSec),
            freeSeats,
            full: freeSeats <= 0,
            score: scoring.score,
            parts: scoring.parts,
            contributions: scoring.contributions,
            _etaSec: metrics.etaSec,
            _totalSec: metrics.totalSec,
            _stopIdx: sb,
            _destIdx: sd,
          });
        }
      }
    }
  }
  return options;
}

// Ne garde qu'une option par bus (la meilleure), puis trie
function pickBestPerBus(options) {
  const byBus = new Map();
  for (const o of options) {
    const current = byBus.get(o.bus.id);
    const better =
      !current ||
      (current.full && !o.full) ||
      (current.full === o.full && (o.full ? o._etaSec < current._etaSec : o.score > current.score));
    if (better) byBus.set(o.bus.id, o);
  }
  const all = [...byBus.values()];
  const available = all.filter((o) => !o.full).sort((a, b) => b.score - a.score);
  const full = all.filter((o) => o.full).sort((a, b) => a._etaSec - b._etaSec);
  return { available, full };
}

function buildExplanation(best, second) {
  const base =
    `${best.bus.name} (${best.route.id}) arrive à « ${best.boardStop.name} » dans ${best.etaMin} min, ` +
    `${best.freeSeats} place(s) libre(s), arrêt à ${best.walkMeters} m, ` +
    `arrivée à destination dans ${best.totalMin} min.`;
  if (!second) return `${base} C'est le seul bus disponible pour ce trajet.`;
  const advantages = CRITERIA.filter((k) => best.parts[k] - second.parts[k] >= 0.05).map(
    (k) => CRITERIA_LABELS[k],
  );
  if (!advantages.length) return `${base} Score très proche de ${second.bus.name}.`;
  return `${base} Meilleur que ${second.bus.name} : ${advantages.join(', ')}.`;
}

const publicOption = ({ _etaSec, _totalSec, _stopIdx, _destIdx, ...rest }) => rest;

// options.hold : réserver provisoirement une place sur le bus recommandé
// options.cache : cache des prévisions (utile quand on enchaîne beaucoup de requêtes)
export function recommend(engine, input, options = {}) {
  const weights = normalizeWeights(input.weights);
  const { origin, destination } = readInput(engine, input);
  const cache = options.cache || new Map();

  const found = findOptions(engine, origin, destination, weights, cache);
  const { available, full } = pickBestPerBus(found);
  const best = available[0] || null;

  let hold = null;
  if (best && options.hold) {
    const h = engine.addHold({
      busId: best.bus.id,
      stopIdx: best._stopIdx,
      destIdx: best._destIdx,
      boardAt: engine.clock + best._etaSec,
      alightAt: engine.clock + best._totalSec,
      expiresAt: engine.clock + best._etaSec + params.holdMarginSec,
    });
    hold = { id: h.id, validMin: toMin(best._etaSec + params.holdMarginSec) };
  }

  let message;
  if (!found.length) {
    const nearest = engine.network.stops
      .map((st) => ({ st, km: haversineKm(origin, st) * WALK_DETOUR }))
      .sort((a, b) => a.km - b.km)[0];
    message =
      nearest.km > params.walkMaxKm
        ? `Aucun arrêt à moins de ${params.walkMaxKm} km de votre position (le plus proche : ${nearest.st.name}, à ${round1(nearest.km)} km).`
        : 'Aucun bus ne dessert directement ce trajet depuis les arrêts proches de vous.';
  } else if (!best) {
    const nextFull = full[0];
    message =
      `Tous les bus concernés sont complets. Prochain passage : ${nextFull.bus.name} dans ${nextFull.etaMin} min ` +
      `(mais sans place prévue). Patientez pour le bus suivant ou essayez un autre arrêt.`;
  } else {
    message = buildExplanation(best, available[1]);
  }

  return {
    weights,
    best: best ? publicOption(best) : null,
    alternatives: [...available.slice(1), ...full].slice(0, params.maxAlternatives).map(publicOption),
    hold,
    message,
  };
}

// Simule N étudiants qui demandent la même recommandation en même temps,
// avec puis sans réservation provisoire de places. Aucun état n'est conservé.
export function simulateCrowd(engine, input) {
  const count = Math.min(Math.max(Math.round(Number(input.count) || 200), 1), 2000);
  const cache = new Map();
  const results = {};

  for (const withHolds of [false, true]) {
    const savedHolds = engine.holds;
    engine.holds = [...savedHolds]; // copie de travail, supprimée à la fin
    const tally = new Map();
    let unserved = 0;

    for (let i = 0; i < count; i++) {
      const res = recommend(engine, input, { hold: withHolds, cache });
      if (!res.best) {
        unserved += 1;
        continue;
      }
      // un même bus peut être utilisé pour 2 passages différents : on les distingue par l'ETA
      const key = `${res.best.bus.id}|${res.best.boardStop.id}|${res.best.etaMin}`;
      if (!tally.has(key)) {
        tally.set(key, {
          busId: res.best.bus.id,
          busName: res.best.bus.name,
          routeId: res.best.route.id,
          boardStop: res.best.boardStop.name,
          etaMin: res.best.etaMin,
          freeSeats: res.best.freeSeats, // places libres avant la première réservation
          assigned: 0,
        });
      }
      tally.get(key).assigned += 1;
    }
    engine.holds = savedHolds;

    const distribution = [...tally.values()]
      .map((t) => ({ ...t, overload: Math.max(0, t.assigned - t.freeSeats) }))
      .sort((a, b) => b.assigned - a.assigned);
    const overloaded = distribution.reduce((s, t) => s + t.overload, 0);
    results[withHolds ? 'withHolds' : 'withoutHolds'] = {
      distribution,
      unserved,
      overloaded, // étudiants envoyés vers un bus qui n'a plus de place
      busesUsed: distribution.length,
    };
  }

  const standardCapacity = Math.max(...engine.buses.map((b) => b.capacity));
  return {
    count,
    ...results,
    extraBusesSuggested: Math.ceil(results.withHolds.unserved / standardCapacity),
  };
}
