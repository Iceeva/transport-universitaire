// Vitesse moyenne des bus (km/h) selon l'heure : la circulation ralentit aux heures de pointe.

const SPEEDS = {
  5: 32, 6: 26, 7: 16, 8: 15, 9: 22, 10: 26, 11: 26, 12: 20, 13: 20,
  14: 25, 15: 25, 16: 20, 17: 15, 18: 16, 19: 24, 20: 30,
};

export function speedKmh(hour) {
  return SPEEDS[hour] ?? 25;
}
