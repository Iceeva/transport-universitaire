// Arrêts du réseau (zone Abomey-Calavi / Cotonou).
// Les coordonnées GPS sont des approximations réalistes, pas des relevés officiels.
//  - kind        : residence | hub | campus
//  - popularity  : poids relatif de l'arrêt dans la génération de la demande
//  - catchmentKm : distance de marche moyenne des étudiants qui utilisent cet arrêt

export const stops = [
  { id: 'calavi', name: 'Calavi Centre', lat: 6.4485, lon: 2.356, kind: 'residence', popularity: 3, catchmentKm: 0.9 },
  { id: 'togba', name: 'Togba', lat: 6.433, lon: 2.332, kind: 'residence', popularity: 2, catchmentKm: 1.1 },
  { id: 'eneam', name: 'ENEAM', lat: 6.419, lon: 2.342, kind: 'campus', popularity: 3, catchmentKm: 0.3 },
  { id: 'uac', name: 'UAC Campus', lat: 6.4165, lon: 2.34, kind: 'campus', popularity: 5, catchmentKm: 0.3 },
  { id: 'godomey', name: 'Godomey', lat: 6.3905, lon: 2.34, kind: 'residence', popularity: 3.5, catchmentKm: 0.8 },
  { id: 'zogbo', name: 'Zogbo', lat: 6.387, lon: 2.395, kind: 'hub', popularity: 2.5, catchmentKm: 0.6 },
  { id: 'agla', name: 'Agla', lat: 6.38, lon: 2.37, kind: 'residence', popularity: 2, catchmentKm: 0.7 },
  { id: 'fidjrosse', name: 'Fidjrossè', lat: 6.35, lon: 2.37, kind: 'residence', popularity: 2.5, catchmentKm: 0.7 },
  { id: 'cadjehoun', name: 'Cadjèhoun', lat: 6.36, lon: 2.38, kind: 'hub', popularity: 3, catchmentKm: 0.5 },
  { id: 'stade', name: "Stade de l'Amitié", lat: 6.385, lon: 2.383, kind: 'hub', popularity: 2, catchmentKm: 0.6 },
  { id: 'campus-cotonou', name: 'Campus Cotonou', lat: 6.363, lon: 2.39, kind: 'campus', popularity: 4, catchmentKm: 0.3 },
  { id: 'jericho', name: 'Jéricho', lat: 6.37, lon: 2.405, kind: 'hub', popularity: 2.5, catchmentKm: 0.5 },
  { id: 'etoile-rouge', name: 'Étoile Rouge', lat: 6.359, lon: 2.406, kind: 'hub', popularity: 2, catchmentKm: 0.5 },
  { id: 'dantokpa', name: 'Dantokpa', lat: 6.367, lon: 2.435, kind: 'hub', popularity: 3, catchmentKm: 0.5 },
  { id: 'ganhi', name: 'Ganhi', lat: 6.362, lon: 2.427, kind: 'hub', popularity: 1.5, catchmentKm: 0.5 },
  { id: 'akpakpa', name: 'Akpakpa', lat: 6.356, lon: 2.44, kind: 'residence', popularity: 4, catchmentKm: 0.9 },
];
