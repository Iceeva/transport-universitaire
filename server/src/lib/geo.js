// Fonctions géographiques simples (distance, interpolation, marche à pied).

const EARTH_RADIUS_KM = 6371;
// Une route est plus longue que la ligne droite : on applique un coefficient de détour
export const ROAD_FACTOR = 1.3;
export const WALK_DETOUR = 1.25;
export const WALK_SPEED_KMH = 4.5;

const toRad = (deg) => (deg * Math.PI) / 180;

// Distance à vol d'oiseau entre deux points {lat, lon} (formule de Haversine)
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Distance routière estimée
export function roadKm(a, b) {
  return haversineKm(a, b) * ROAD_FACTOR;
}

// Point situé à la fraction t (0..1) du segment a -> b
export function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

// Temps de marche (en secondes) pour une distance donnée
export function walkSeconds(km) {
  return (km / WALK_SPEED_KMH) * 3600;
}
