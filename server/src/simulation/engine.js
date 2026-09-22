// Moteur de simulation : fait avancer les bus, apparaître les étudiants aux arrêts,
// embarquer/débarquer les passagers et collecte les statistiques.
//
// Une "simulation" = un objet Engine. Le serveur en utilise deux :
//   - "history" : une journée complète simulée à l'avance (sert aux analyses)
//   - "live"    : la simulation qui tourne en temps réel (sert aux écrans de suivi)

import { createRandom } from '../lib/random.js';
import { interpolate } from '../lib/geo.js';
import { hourShare, toCampusShare } from '../data/demand.js';
import { speedKmh } from '../data/traffic.js';
import { config } from '../config.js';

export const DWELL_BASE_SEC = 25; // arrêt minimal à chaque station
export const DWELL_PER_PAX_SEC = 1.5; // + temps par passager qui monte ou descend
export const DWELL_ESTIMATE_SEC = 40; // durée d'arrêt supposée dans les prévisions d'arrivée
export const LAYOVER_SEC = 120; // temps de pause au terminus

const newStopStats = () => ({
  spawned: 0, boarded: 0, alighted: 0, leftBehind: 0,
  waitSumSec: 0, waitCount: 0, longWalk: 0, events: [],
});
const newRouteStats = () => ({
  boarded: 0, alighted: 0, paxKm: 0, seatKm: 0, runs: 0, saturatedRuns: 0, refused: 0, hours: {},
});

export class Engine {
  constructor(network, { seed, startSec = config.serviceStartSec } = {}) {
    this.network = network;
    this.random = createRandom(seed);
    this.clock = startSec;
    this.nextStudentId = 1;
    this.nextHoldId = 1;
    this.holds = []; // réservations provisoires de places (voir recommandation)
    this.hourly = {}; // { heure: { spawned, boarded } }

    this.stopState = {};
    for (const stop of network.stops) {
      this.stopState[stop.id] = { waiting: [], stats: newStopStats() };
    }
    this.routeStats = {};
    for (const route of network.routes) this.routeStats[route.id] = newRouteStats();

    this.buses = this.createFleet();
  }

  // ---------- Initialisation ----------

  // Répartit les bus de chaque ligne à intervalles réguliers (en km) sur l'aller-retour
  createFleet() {
    const buses = [];
    let number = 1;
    for (const route of this.network.routes) {
      const last = route.stops.length - 1;
      // Parcours complet aller puis retour, tronçon par tronçon
      const path = [];
      for (let i = 0; i < last; i++) path.push({ from: i, dir: 1, km: route.segmentKm[i] });
      for (let i = last; i > 0; i--) path.push({ from: i, dir: -1, km: route.segmentKm[i - 1] });
      const cycleKm = route.lengthKm * 2;

      for (let k = 0; k < route.fleet.count; k++) {
        const distance = (k * cycleKm) / route.fleet.count;
        let travelled = 0;
        let seg = path[0];
        for (const candidate of path) {
          seg = candidate;
          if (distance < travelled + candidate.km) break;
          travelled += candidate.km;
        }
        buses.push({
          id: `BUS-${String(number).padStart(2, '0')}`,
          name: `Bus ${number}`,
          routeId: route.id,
          capacity: route.fleet.capacity,
          stopIdx: seg.from, // dernier arrêt quitté (ou arrêt actuel si le bus est arrêté)
          dir: seg.dir, // +1 = vers le campus, -1 = vers l'extrémité résidentielle
          state: 'moving', // 'moving' ou 'dwell' (à l'arrêt)
          dwellLeft: 0,
          segTotalKm: seg.km,
          segLeftKm: Math.max(0.05, travelled + seg.km - distance),
          passengers: [],
        });
        number += 1;
      }
    }
    return buses;
  }

  // ---------- Avancement du temps ----------

  hour() {
    return Math.floor(this.clock / 3600);
  }

  advance(seconds) {
    let left = seconds;
    while (left > 0) {
      const dt = Math.min(config.stepSeconds, left);
      this.step(dt);
      left -= dt;
    }
  }

  runUntil(targetSec) {
    if (targetSec > this.clock) this.advance(targetSec - this.clock);
  }

  step(dt) {
    this.spawnStudents(dt);
    for (const bus of this.buses) this.moveBus(bus, dt);
    this.holds = this.holds.filter((h) => h.expiresAt > this.clock);
    this.clock += dt;
  }

  // ---------- Génération des étudiants ----------

  spawnStudents(dt) {
    const hour = this.hour();
    const share = hourShare(hour);
    if (share === 0) return;
    const toCampusP = toCampusShare(hour);
    for (const route of this.network.routes) {
      const lambda = route.dailyDemand * share * (dt / 3600);
      const count = this.random.poisson(lambda);
      for (let n = 0; n < count; n++) this.createStudent(route, toCampusP, hour);
    }
  }

  createStudent(route, toCampusP, hour) {
    const pair = this.random.weighted(route.pairs, (p) => p.weight);
    const towardCampus = this.random.next() < toCampusP;
    const originIdx = towardCampus ? pair.i : pair.j;
    const destIdx = towardCampus ? pair.j : pair.i;
    const origin = route.stops[originIdx];

    // Distance de marche jusqu'à l'arrêt : loi exponentielle autour de la moyenne de l'arrêt
    const u = this.random.next();
    const walkKm = Math.min(2.5, Math.max(0.05, -origin.catchmentKm * Math.log(1 - u)));

    const student = {
      id: this.nextStudentId++,
      routeId: route.id,
      originIdx,
      destIdx,
      originStopId: origin.id,
      destStopId: route.stops[destIdx].id,
      createdAt: this.clock,
      walkKm,
      leftBehind: false,
    };
    const state = this.stopState[origin.id];
    state.waiting.push(student);
    state.stats.spawned += 1;
    if (walkKm > 1) state.stats.longWalk += 1;
    this.hourStats(hour).spawned += 1;
  }

  hourStats(hour) {
    if (!this.hourly[hour]) this.hourly[hour] = { spawned: 0, boarded: 0 };
    return this.hourly[hour];
  }

  routeHour(routeId, hour) {
    const hours = this.routeStats[routeId].hours;
    if (!hours[hour]) {
      // dirs : charge séparée par sens de circulation (+1 vers le campus, -1 retour)
      hours[hour] = {
        boarded: 0, refused: 0, paxKm: 0, seatKm: 0,
        dirs: { 1: { paxKm: 0, seatKm: 0 }, '-1': { paxKm: 0, seatKm: 0 } },
      };
    }
    return hours[hour];
  }

  // ---------- Déplacement des bus ----------

  moveBus(bus, dt) {
    let left = dt;
    while (left > 0) {
      if (bus.state === 'dwell') {
        if (bus.dwellLeft > left) {
          bus.dwellLeft -= left;
          left = 0;
        } else {
          left -= bus.dwellLeft;
          bus.dwellLeft = 0;
          this.depart(bus);
        }
      } else {
        const speed = speedKmh(this.hour());
        const km = (speed * left) / 3600;
        if (km < bus.segLeftKm) {
          bus.segLeftKm -= km;
          left = 0;
        } else {
          left -= (bus.segLeftKm / speed) * 3600;
          this.arrive(bus);
        }
      }
    }
  }

  depart(bus) {
    const route = this.network.routeById[bus.routeId];
    const next = bus.stopIdx + bus.dir;
    bus.state = 'moving';
    bus.segTotalKm = route.segmentKm[Math.min(bus.stopIdx, next)];
    bus.segLeftKm = bus.segTotalKm;
  }

  // Le bus arrive à un arrêt : descente, retournement éventuel, montée
  arrive(bus) {
    const route = this.network.routeById[bus.routeId];
    const hour = this.hour();
    const toIdx = bus.stopIdx + bus.dir;
    const stop = route.stops[toIdx];
    const state = this.stopState[stop.id];
    const rs = this.routeStats[route.id];
    const rh = this.routeHour(route.id, hour);

    // 1. Statistiques de charge sur le tronçon qui vient d'être parcouru
    const load = bus.passengers.length;
    rs.paxKm += load * bus.segTotalKm;
    rs.seatKm += bus.capacity * bus.segTotalKm;
    rh.paxKm += load * bus.segTotalKm;
    rh.seatKm += bus.capacity * bus.segTotalKm;
    rh.dirs[bus.dir].paxKm += load * bus.segTotalKm;
    rh.dirs[bus.dir].seatKm += bus.capacity * bus.segTotalKm;
    rs.runs += 1;
    if (load / bus.capacity >= 0.9) rs.saturatedRuns += 1;

    bus.stopIdx = toIdx;
    bus.state = 'dwell';
    bus.segLeftKm = 0;

    // 2. Descente des passagers arrivés à destination
    const staying = [];
    let alighted = 0;
    for (const p of bus.passengers) {
      if (p.destIdx !== toIdx) staying.push(p);
      else if (!p.virtual) alighted += 1;
    }
    bus.passengers = staying;
    state.stats.alighted += alighted;
    rs.alighted += alighted;

    // 3. Au terminus, le bus fait demi-tour
    const atTerminus = toIdx === 0 || toIdx === route.stops.length - 1;
    if (atTerminus) bus.dir = -bus.dir;

    // 4. Les étudiants qui avaient réservé une place à cet arrêt montent en priorité
    for (const h of this.consumeHolds(bus.id, toIdx)) {
      if (bus.passengers.length < bus.capacity) {
        bus.passengers.push({ id: `app-${h.id}`, virtual: true, routeId: route.id, destIdx: h.destIdx });
      }
    }

    // 5. Montée : uniquement les étudiants de cette ligne qui vont dans le sens du bus
    const wanting = state.waiting.filter(
      (s) => s.routeId === route.id && Math.sign(s.destIdx - toIdx) === bus.dir,
    );
    const free = bus.capacity - bus.passengers.length;
    const boarding = wanting.slice(0, free);
    const refused = wanting.slice(free);
    const boardingSet = new Set(boarding);
    state.waiting = state.waiting.filter((s) => !boardingSet.has(s));

    for (const s of boarding) {
      state.stats.waitSumSec += this.clock - s.createdAt;
      state.stats.waitCount += 1;
      bus.passengers.push(s);
    }
    state.stats.boarded += boarding.length;
    rs.boarded += boarding.length;
    rh.boarded += boarding.length;
    this.hourStats(hour).boarded += boarding.length;

    // Les étudiants qui voient partir un bus plein sont comptés une seule fois
    for (const s of refused) {
      if (!s.leftBehind) {
        s.leftBehind = true;
        state.stats.leftBehind += 1;
        rs.refused += 1;
        rh.refused += 1;
      }
    }

    if (boarding.length + alighted + refused.length > 0) {
      state.stats.events.push({
        clock: this.clock,
        busId: bus.id,
        busName: bus.name,
        routeId: route.id,
        boarded: boarding.length,
        alighted,
        leftBehind: refused.length,
        waitingAfter: state.waiting.length,
      });
      if (state.stats.events.length > 20) state.stats.events.shift();
    }

    // 6. Durée d'arrêt
    bus.dwellLeft = Math.min(
      180,
      DWELL_BASE_SEC + DWELL_PER_PAX_SEC * (boarding.length + alighted),
    );
    if (atTerminus) bus.dwellLeft += LAYOVER_SEC;
  }

  // ---------- Positions et prévisions ----------

  busPosition(bus) {
    const route = this.network.routeById[bus.routeId];
    const from = route.stops[bus.stopIdx];
    if (bus.state === 'dwell') return { lat: from.lat, lon: from.lon };
    const to = route.stops[bus.stopIdx + bus.dir];
    const t = 1 - bus.segLeftKm / bus.segTotalKm;
    return interpolate(from, to, t);
  }

  // Prévision des prochains passages du bus : tableau de
  // { stopIdx, eta (secondes à partir de maintenant), dir (sens après l'arrêt) }
  projectBus(bus, steps = 36) {
    const route = this.network.routeById[bus.routeId];
    const last = route.stops.length - 1;
    const speed = speedKmh(this.hour());
    const seconds = (km) => (km / speed) * 3600;

    const path = [];
    let idx = bus.stopIdx;
    let dir = bus.dir;
    let t;

    if (bus.state === 'moving') {
      t = seconds(bus.segLeftKm);
      idx += dir;
      const atEnd = idx === 0 || idx === last;
      if (atEnd) dir = -dir;
      path.push({ stopIdx: idx, eta: t, dir });
      t += DWELL_ESTIMATE_SEC + (atEnd ? LAYOVER_SEC : 0);
    } else {
      t = bus.dwellLeft;
    }

    while (path.length < steps) {
      const next = idx + dir;
      t += seconds(route.segmentKm[Math.min(idx, next)]);
      const atEnd = next === 0 || next === last;
      if (atEnd) dir = -dir;
      path.push({ stopIdx: next, eta: t, dir });
      idx = next;
      t += DWELL_ESTIMATE_SEC + (atEnd ? LAYOVER_SEC : 0);
    }
    return path;
  }

  // ---------- Réservations provisoires (anti-surcharge) ----------

  // Une réservation garde une place sur un bus entre l'arrêt de montée et la destination
  addHold({ busId, stopIdx, destIdx, boardAt, alightAt, expiresAt }) {
    const hold = { id: this.nextHoldId++, busId, stopIdx, destIdx, boardAt, alightAt, expiresAt };
    this.holds.push(hold);
    return hold;
  }

  // Quand le bus arrive à l'arrêt, les réservations correspondantes sont retirées de la liste
  // et renvoyées : ces étudiants "montent" (passagers virtuels).
  consumeHolds(busId, stopIdx) {
    const used = this.holds.filter((h) => h.busId === busId && h.stopIdx === stopIdx);
    this.holds = this.holds.filter((h) => !(h.busId === busId && h.stopIdx === stopIdx));
    return used;
  }

  holdsOf(busId) {
    return this.holds.filter((h) => h.busId === busId);
  }
}
