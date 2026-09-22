// Cas d'usage 3 (top 5 des itinéraires) et 5 (optimisation d'itinéraire).
// Toutes les recommandations sont calculées à partir des statistiques du moteur de simulation,
// chacune est accompagnée d'indicateurs chiffrés.

import { analyticsParams as A } from '../config.js';
import { round1 } from '../lib/time.js';
import { roadKm, haversineKm } from '../lib/geo.js';
import { cycleSeconds } from './networkService.js';

const pct = (x) => Math.round(x * 1000) / 10;
const hourLabel = (h) => `${String(h).padStart(2, '0')}h`;

// ---------- Statistiques par ligne ----------

export function routeSummaries(engine) {
  return engine.network.routes.map((route) => {
    const rs = engine.routeStats[route.id];
    const hours = Object.entries(rs.hours)
      .map(([h, v]) => {
        const dir1 = v.dirs[1].seatKm ? v.dirs[1].paxKm / v.dirs[1].seatKm : 0;
        const dir2 = v.dirs[-1].seatKm ? v.dirs[-1].paxKm / v.dirs[-1].seatKm : 0;
        return {
          hour: Number(h),
          boarded: v.boarded,
          refused: v.refused,
          loadFactor: v.seatKm ? v.paxKm / v.seatKm : 0,
          // charge dans le sens le plus chargé (sens de pointe)
          peakDirLoad: Math.max(dir1, dir2),
        };
      })
      .sort((a, b) => a.hour - b.hour);

    const peak = hours.reduce((best, h) => (h.peakDirLoad > (best?.peakDirLoad ?? -1) ? h : best), null);
    return {
      routeId: route.id,
      name: route.name,
      color: route.color,
      buses: route.fleet.count,
      capacity: route.fleet.capacity,
      transported: rs.boarded,
      // taux de saturation moyen = passagers-km transportés / places-km offertes
      saturation: pct(rs.seatKm ? rs.paxKm / rs.seatKm : 0),
      saturatedRunsPct: pct(rs.runs ? rs.saturatedRuns / rs.runs : 0),
      refused: rs.refused,
      peakHour: peak ? peak.hour : null,
      peakSaturation: peak ? pct(peak.peakDirLoad) : 0,
      hours,
    };
  });
}

// Boardings par heure pour toute la flotte + détection des heures de pointe
export function hourlyDemand(engine) {
  const rows = Object.entries(engine.hourly)
    .map(([h, v]) => ({ hour: Number(h), boarded: v.boarded, spawned: v.spawned }))
    .sort((a, b) => a.hour - b.hour);
  const active = rows.filter((r) => r.spawned > 0);
  // La pointe se mesure sur la DEMANDE (étudiants qui arrivent aux arrêts), pas sur les montées,
  // car les montées sont retardées quand les bus sont pleins.
  const mean = active.length ? active.reduce((s, r) => s + r.spawned, 0) / active.length : 0;
  return rows.map((r) => ({
    ...r,
    ratio: mean ? Math.round((r.spawned / mean) * 100) / 100 : 0,
    isPeak: mean > 0 && r.spawned >= mean * A.peakHourFactor,
  }));
}

// Regroupe les heures de pointe consécutives : [7,8,9] -> "07h-10h"
function peakWindows(hourly) {
  const windows = [];
  let current = null;
  for (const r of hourly.filter((h) => h.isPeak)) {
    if (current && r.hour === current.end) current.end = r.hour + 1;
    else {
      current = { start: r.hour, end: r.hour + 1 };
      windows.push(current);
    }
  }
  return windows.map((w) => ({ ...w, label: `${hourLabel(w.start)}-${hourLabel(w.end)}` }));
}

// ---------- Cas d'usage 3 ----------

export function topRoutes(engine, limit = 5) {
  const all = routeSummaries(engine).sort((a, b) => b.transported - a.transported);
  const routes = all.slice(0, limit).map(({ hours, ...rest }, i) => ({ rank: i + 1, ...rest }));
  return { routes, totalTransported: all.reduce((s, r) => s + r.transported, 0), hourly: hourlyDemand(engine) };
}

// ---------- Cas d'usage 5 : zones, pointes, congestion ----------

function stopRows(engine) {
  return engine.network.stops.map((stop) => {
    const st = engine.stopState[stop.id].stats;
    return {
      id: stop.id,
      name: stop.name,
      traffic: st.boarded + st.alighted,
      boarded: st.boarded,
      alighted: st.alighted,
      spawned: st.spawned,
      leftBehind: st.leftBehind,
      refusalRate: st.spawned ? st.leftBehind / st.spawned : 0,
      avgWaitMin: st.waitCount ? st.waitSumSec / st.waitCount / 60 : 0,
      longWalkShare: st.spawned ? st.longWalk / st.spawned : 0,
    };
  });
}

export function hotspots(engine, limit = 5) {
  const rows = stopRows(engine);
  const total = rows.reduce((s, r) => s + r.traffic, 0);
  return rows
    .sort((a, b) => b.traffic - a.traffic)
    .slice(0, limit)
    .map((r) => ({ id: r.id, name: r.name, traffic: r.traffic, sharePct: pct(total ? r.traffic / total : 0) }));
}

export function congestionPoints(engine, limit = 5) {
  return stopRows(engine)
    .filter((r) => r.refusalRate >= A.highRefusalRate || r.avgWaitMin >= A.longWaitMin)
    .sort((a, b) => b.refusalRate - a.refusalRate)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      name: r.name,
      leftBehind: r.leftBehind,
      refusalRatePct: pct(r.refusalRate),
      avgWaitMin: round1(r.avgWaitMin),
    }));
}

// ---------- Actions correctives ----------

function windowLabel(hours) {
  const sorted = [...hours].sort((a, b) => a - b);
  return `${hourLabel(sorted[0])}-${hourLabel(sorted[sorted.length - 1] + 1)}`;
}

function priorityOf(severity) {
  return severity >= 60 ? 'haute' : severity >= 25 ? 'moyenne' : 'basse';
}

// 1 et 2. Ajout de bus / modification d'horaires.
// Pour chaque ligne saturée en pointe, on calcule d'abord le nombre de bus manquants.
// On propose ensuite de les prendre en priorité sur les heures creuses de la même ligne
// (modification d'horaires, gratuit) et d'ajouter de nouveaux bus seulement pour le reste.
function capacityActions(engine, summaries) {
  const actions = [];
  for (const s of summaries) {
    const route = engine.network.routeById[s.routeId];
    const hot = s.hours.filter(
      (h) => h.peakDirLoad >= A.saturatedLoad && h.refused / Math.max(1, h.boarded + h.refused) >= 0.05,
    );
    if (!hot.length) continue;

    const worst = hot.reduce((a, b) => (b.refused > a.refused ? b : a));
    const totalRefused = hot.reduce((sum, h) => sum + h.refused, 0);
    const totalBoarded = hot.reduce((sum, h) => sum + h.boarded, 0);
    const window = windowLabel(hot.map((h) => h.hour));
    // Places offertes par heure et par bus dans le sens de pointe
    const seatsPerBusHour = (route.fleet.capacity * 3600) / cycleSeconds(route, worst.hour);
    const extra = Math.max(1, Math.ceil(worst.refused / seatsPerBusHour));
    const refusalBefore = totalRefused / (totalRefused + totalBoarded);
    const refusalAfter =
      Math.max(0, totalRefused - extra * seatsPerBusHour * hot.length) / (totalRefused + totalBoarded);

    // Bus disponibles en heures creuses : on garde assez de bus pour un remplissage cible de 60 %
    const offPeak = s.hours.filter((h) => h.boarded > 0 && h.loadFactor <= A.lowLoad);
    let movable = 0;
    let avgOffLoad = 0;
    let needed = s.buses;
    if (s.buses >= 2 && offPeak.length >= 3) {
      avgOffLoad = offPeak.reduce((sum, h) => sum + h.loadFactor, 0) / offPeak.length;
      needed = Math.max(1, Math.ceil((s.buses * avgOffLoad) / A.targetLoad));
      // Il faut aussi garder une fréquence acceptable : un bus au moins toutes les 30 min
      needed = Math.max(needed, Math.ceil(cycleSeconds(route, 10) / 60 / A.maxOffPeakHeadwayMin));
      movable = Math.max(0, s.buses - needed);
    }
    const shifted = Math.min(extra, movable);
    const added = extra - shifted;
    const severity = Math.min(100, Math.round(pct(refusalBefore) * 3 + totalRefused / 10));

    if (shifted > 0) {
      actions.push({
        type: 'RESCHEDULE',
        routeId: s.routeId,
        title: `Ligne ${s.routeId} : basculer ${shifted} bus des heures creuses vers la pointe (${window})`,
        detail:
          `Hors pointe (${offPeak.length} heures), les bus ne sont remplis qu'à ${pct(avgOffLoad)} % en moyenne, ` +
          `alors que le sens de pointe atteint ${pct(worst.peakDirLoad)} % à ${hourLabel(worst.hour)}.`,
        indicators: {
          'Remplissage heures creuses': `${pct(avgOffLoad)} %`,
          'Remplissage pointe (sens fort)': `${pct(worst.peakDirLoad)} %`,
          'Bus actuels': s.buses,
          'Bus à garder en heures creuses': needed,
          'Bus basculés': shifted,
        },
        severity,
      });
    }
    if (added > 0) {
      actions.push({
        type: 'ADD_BUS',
        routeId: s.routeId,
        title: `Ajouter ${added} bus sur la ligne ${s.routeId} entre ${window}`,
        detail:
          `Sens de pointe rempli à ${pct(worst.peakDirLoad)} % à ${hourLabel(worst.hour)} ; ` +
          `${totalRefused} étudiants ont vu passer un bus plein sur ${window}.`,
        indicators: {
          'Remplissage max (sens de pointe)': `${pct(worst.peakDirLoad)} %`,
          'Étudiants refusés': totalRefused,
          'Bus manquants en pointe': extra,
          'Places/h ajoutées par bus': Math.round(seatsPerBusHour),
          'Refus estimés après correction': `${pct(refusalBefore)} % → ${pct(refusalAfter)} %`,
        },
        severity,
      });
    }
  }
  return actions;
}

// 3. Nouveaux arrêts : tronçons trop longs dont les arrêts voisins ont des étudiants qui marchent beaucoup
function newStopActions(engine) {
  const rows = Object.fromEntries(stopRows(engine).map((r) => [r.id, r]));
  const seen = new Set();
  const actions = [];
  for (const route of engine.network.routes) {
    for (let i = 0; i < route.stops.length - 1; i++) {
      const a = route.stops[i];
      const b = route.stops[i + 1];
      const key = [a.id, b.id].sort().join('|');
      const gapKm = roadKm(a, b);
      if (seen.has(key) || gapKm < A.longGapKm) continue;
      seen.add(key);

      const ra = rows[a.id];
      const rb = rows[b.id];
      const worstWalk = Math.max(ra.longWalkShare, rb.longWalkShare);
      if (worstWalk < A.longWalkShare) continue;

      const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
      // Inutile de proposer un arrêt s'il y en a déjà un tout près du point proposé
      if (engine.network.stops.some((st) => haversineKm(st, mid) < A.minStopSpacingKm)) continue;
      actions.push({
        type: 'NEW_STOP',
        routeId: route.id,
        title: `Créer un arrêt entre ${a.name} et ${b.name}`,
        detail:
          `Aucun arrêt sur ${round1(gapKm)} km ; ${pct(worstWalk)} % des étudiants des arrêts voisins ` +
          `marchent plus d'1 km pour rejoindre un arrêt.`,
        indicators: {
          'Distance sans arrêt': `${round1(gapKm)} km`,
          'Étudiants marchant > 1 km': `${pct(ra.longWalkShare)} % (${a.name}) / ${pct(rb.longWalkShare)} % (${b.name})`,
          'Montées quotidiennes (2 arrêts voisins)': ra.boarded + rb.boarded,
          'Position proposée': `${mid.lat.toFixed(4)}, ${mid.lon.toFixed(4)}`,
        },
        severity: Math.min(100, Math.round(gapKm * 8 + worstWalk * 100)),
      });
    }
  }
  return actions;
}

// 4. Fusion de lignes peu utilisées : faible remplissage et beaucoup d'arrêts communs avec une autre ligne
function mergeActions(engine, summaries) {
  const actions = [];
  for (const s of summaries) {
    if (s.saturation / 100 > A.mergeLoad) continue;
    const route = engine.network.routeById[s.routeId];
    let bestOther = null;
    for (const other of summaries) {
      if (other.routeId === s.routeId) continue;
      const otherRoute = engine.network.routeById[other.routeId];
      const shared = route.stopIds.filter((id) => otherRoute.stopIds.includes(id)).length;
      const overlap = shared / route.stopIds.length;
      if (overlap >= A.mergeOverlap && (!bestOther || overlap > bestOther.overlap ||
          (overlap === bestOther.overlap && other.saturation < bestOther.summary.saturation))) {
        bestOther = { summary: other, overlap, shared };
      }
    }
    if (!bestOther) continue;

    actions.push({
      type: 'MERGE_LINES',
      routeId: s.routeId,
      title: `Fusionner la ligne ${s.routeId} dans la ligne ${bestOther.summary.routeId}`,
      detail:
        `La ligne ${s.routeId} ne transporte que ${s.transported} étudiants/jour (remplissage moyen ${s.saturation} %) ` +
        `et partage ${bestOther.shared}/${route.stopIds.length} arrêts avec ${bestOther.summary.routeId}.`,
      indicators: {
        [`Remplissage ${s.routeId}`]: `${s.saturation} %`,
        [`Remplissage ${bestOther.summary.routeId}`]: `${bestOther.summary.saturation} %`,
        'Arrêts en commun': `${Math.round(bestOther.overlap * 100)} %`,
        'Étudiants/jour à reporter': s.transported,
        'Bus libérés': s.buses,
      },
      severity: Math.min(100, Math.round((A.mergeLoad - s.saturation / 100) * 300 + bestOther.overlap * 30)),
    });
  }
  return actions;
}

export function optimizationReport(engine) {
  const summaries = routeSummaries(engine);
  const hourly = hourlyDemand(engine);
  const actions = [
    ...capacityActions(engine, summaries),
    ...newStopActions(engine).sort((a, b) => b.severity - a.severity).slice(0, 3),
    ...mergeActions(engine, summaries),
  ]
    .map((a) => ({ ...a, priority: priorityOf(a.severity) }))
    .sort((a, b) => b.severity - a.severity);

  return {
    hourly,
    peakWindows: peakWindows(hourly),
    hotspots: hotspots(engine),
    congestion: congestionPoints(engine),
    routes: summaries.map(({ hours, ...rest }) => rest),
    actions,
  };
}
