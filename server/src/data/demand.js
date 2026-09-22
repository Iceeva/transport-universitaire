// Profil horaire de la demande (hypothèses documentées dans le README).
// Les heures vont de 5h à 20h (service de 5h00 à 21h00).

const FIRST_HOUR = 5;

// Part de la demande journalière par heure (sera normalisée pour faire 100 %)
const HOURLY_WEIGHTS = [
  0.02, // 5h
  0.07, // 6h
  0.14, // 7h  -> pointe du matin
  0.13, // 8h
  0.06, // 9h
  0.04, // 10h
  0.05, // 11h
  0.07, // 12h -> mini pointe de midi
  0.06, // 13h
  0.05, // 14h
  0.05, // 15h
  0.06, // 16h
  0.08, // 17h -> pointe du soir
  0.06, // 18h
  0.03, // 19h
  0.02, // 20h
];

// Probabilité qu'un trajet aille vers le campus (le matin) plutôt que depuis le campus (le soir)
const TO_CAMPUS_SHARE = [
  0.9, 0.9, 0.88, 0.85, 0.6, 0.5, 0.5, 0.5, 0.5, 0.45, 0.4, 0.3, 0.15, 0.12, 0.15, 0.2,
];

const TOTAL = HOURLY_WEIGHTS.reduce((a, b) => a + b, 0);

export const SERVICE_FIRST_HOUR = FIRST_HOUR;
export const SERVICE_LAST_HOUR = FIRST_HOUR + HOURLY_WEIGHTS.length - 1;

// Part de la demande journalière pour une heure donnée (0 hors service)
export function hourShare(hour) {
  const i = hour - FIRST_HOUR;
  if (i < 0 || i >= HOURLY_WEIGHTS.length) return 0;
  return HOURLY_WEIGHTS[i] / TOTAL;
}

export function toCampusShare(hour) {
  const i = Math.min(Math.max(hour - FIRST_HOUR, 0), TO_CAMPUS_SHARE.length - 1);
  return TO_CAMPUS_SHARE[i];
}
