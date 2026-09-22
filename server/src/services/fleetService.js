// Cas d'usage 1 - Gestion de capacité : places disponibles, passagers, taux de remplissage.
import { round1, toMin, formatClock } from '../lib/time.js';

// Taux de remplissage = (nombre_passagers / capacite) x 100
export function fillRate(passengers, capacity) {
  if (!capacity) return 0;
  return (passengers / capacity) * 100;
}

// Niveau d'occupation utilisé par l'interface (couleurs)
export function fillLevel(rate) {
  if (rate >= 90) return 'full';
  if (rate >= 60) return 'warn';
  return 'ok';
}

export function busView(engine, bus) {
  const route = engine.network.routeById[bus.routeId];
  const passengers = bus.passengers.length;
  const rate = fillRate(passengers, bus.capacity);
  const pos = engine.busPosition(bus);
  const next = engine.projectBus(bus, 1)[0];
  const last = route.stops.length - 1;

  return {
    id: bus.id,
    name: bus.name,
    routeId: route.id,
    routeName: route.name,
    color: route.color,
    capacity: bus.capacity,
    passengers,
    freeSeats: bus.capacity - passengers,
    fillRate: round1(rate),
    level: fillLevel(rate),
    status: passengers >= bus.capacity ? 'Complet' : rate >= 90 ? 'Presque plein' : rate >= 60 ? 'Chargé' : 'Places disponibles',
    lat: pos.lat,
    lon: pos.lon,
    state: bus.state === 'dwell' ? 'À l\'arrêt' : 'En route',
    heading: `vers ${route.stops[bus.dir === 1 ? last : 0].name}`,
    nextStop: route.stops[next.stopIdx].name,
    etaNextMin: toMin(next.eta),
    holds: engine.holdsOf(bus.id).length,
  };
}

export function getFleet(engine) {
  const buses = engine.buses.map((b) => busView(engine, b));
  const totalCapacity = buses.reduce((s, b) => s + b.capacity, 0);
  const totalPassengers = buses.reduce((s, b) => s + b.passengers, 0);
  return {
    clock: formatClock(engine.clock),
    summary: {
      buses: buses.length,
      totalCapacity,
      totalPassengers,
      freeSeats: totalCapacity - totalPassengers,
      fillRate: round1(fillRate(totalPassengers, totalCapacity)),
      fullBuses: buses.filter((b) => b.level === 'full').length,
    },
    buses,
  };
}
