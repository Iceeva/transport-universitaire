// Infos statiques du réseau, hypothèses de simulation et indicateurs du tableau de bord.
import { round1, formatClock } from '../lib/time.js';
import { hourShare, toCampusShare, SERVICE_FIRST_HOUR, SERVICE_LAST_HOUR } from '../data/demand.js';
import { speedKmh } from '../data/traffic.js';
import { DWELL_ESTIMATE_SEC, LAYOVER_SEC } from '../simulation/engine.js';
import { fillRate } from './fleetService.js';
import { config } from '../config.js';

export function getNetwork(network) {
  return {
    stops: network.stops.map((s) => ({
      id: s.id, name: s.name, lat: s.lat, lon: s.lon, kind: s.kind, routeIds: s.routeIds,
    })),
    routes: network.routes.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      stopIds: r.stopIds,
      lengthKm: round1(r.lengthKm),
      buses: r.fleet.count,
      capacity: r.fleet.capacity,
    })),
  };
}

// Durée d'un aller-retour complet (secondes) à une heure donnée
export function cycleSeconds(route, hour) {
  const drive = (2 * route.lengthKm * 3600) / speedKmh(hour);
  const dwell = 2 * (route.stops.length - 1) * DWELL_ESTIMATE_SEC;
  return drive + dwell + 2 * LAYOVER_SEC;
}

// Hypothèses utilisées pour générer le jeu de données simulé
export function getAssumptions(network) {
  const totalDemand = network.routes.reduce((s, r) => s + r.dailyDemand, 0);
  const hourlyProfile = [];
  for (let h = SERVICE_FIRST_HOUR; h <= SERVICE_LAST_HOUR; h++) {
    hourlyProfile.push({
      hour: h,
      sharePct: round1(hourShare(h) * 100),
      students: Math.round(hourShare(h) * totalDemand),
      toCampusPct: Math.round(toCampusShare(h) * 100),
      speedKmh: speedKmh(h),
    });
  }
  return {
    stops: network.stops.length,
    routes: network.routes.length,
    buses: network.routes.reduce((s, r) => s + r.fleet.count, 0),
    seats: network.routes.reduce((s, r) => s + r.fleet.count * r.fleet.capacity, 0),
    dailyStudents: totalDemand,
    serviceHours: `${String(SERVICE_FIRST_HOUR).padStart(2, '0')}h00 - ${String(SERVICE_LAST_HOUR + 1).padStart(2, '0')}h00`,
    simSpeed: config.simSpeed,
    hourlyProfile,
    lines: network.routes.map((r) => {
      const cycleMin = cycleSeconds(r, 10) / 60;
      return {
        id: r.id,
        name: r.name,
        buses: r.fleet.count,
        capacity: r.fleet.capacity,
        lengthKm: round1(r.lengthKm),
        dailyStudents: r.dailyDemand,
        cycleMin: Math.round(cycleMin),
        headwayMin: Math.round(cycleMin / r.fleet.count),
      };
    }),
  };
}

// KPI du tableau de bord (simulation en direct)
export function getOverview(engine) {
  let passengers = 0;
  let capacity = 0;
  let fullBuses = 0;
  for (const bus of engine.buses) {
    passengers += bus.passengers.length;
    capacity += bus.capacity;
    if (bus.passengers.length / bus.capacity >= 0.9) fullBuses += 1;
  }
  let waiting = 0;
  let boarded = 0;
  let leftBehind = 0;
  let waitSum = 0;
  let waitCount = 0;
  for (const state of Object.values(engine.stopState)) {
    waiting += state.waiting.length;
    boarded += state.stats.boarded;
    leftBehind += state.stats.leftBehind;
    waitSum += state.stats.waitSumSec;
    waitCount += state.stats.waitCount;
  }
  return {
    clock: formatClock(engine.clock),
    buses: engine.buses.length,
    passengers,
    capacity,
    fillRate: round1(fillRate(passengers, capacity)),
    fullBuses,
    waiting,
    boarded,
    leftBehind,
    avgWaitMin: waitCount ? round1(waitSum / waitCount / 60) : 0,
  };
}
