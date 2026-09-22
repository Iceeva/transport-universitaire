// Paramètres généraux du serveur.
// Tout peut être surchargé avec des variables d'environnement (voir README).

function toSeconds(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  // Graine du générateur aléatoire : même graine = mêmes données simulées
  seed: Number(process.env.SEED) || 2026,
  // Vitesse de la simulation : 20 = 1 seconde réelle représente 20 secondes simulées
  simSpeed: Number(process.env.SIM_SPEED) || 20,
  // Heure simulée à laquelle la simulation "en direct" démarre
  liveStartSec: toSeconds(process.env.SIM_START || '06:30'),
  // Horaires de service des bus
  serviceStartSec: 5 * 3600,
  serviceEndSec: 21 * 3600,
  // Pas de calcul du moteur (en secondes simulées)
  stepSeconds: 10,
};

// Paramètres de la recommandation (cas d'usage 4)
export const recommendationParams = {
  // Pondérations par défaut (somme = 1). Justification dans le README.
  defaultWeights: { eta: 0.35, seats: 0.2, walk: 0.15, total: 0.3 },
  etaMaxMin: 30, // au-delà de 30 min d'attente, le score "attente" vaut 0
  seatsTarget: 8, // au-delà de 8 places libres, avoir plus de places n'apporte plus rien
  walkMaxKm: 1.5, // distance de marche maximale acceptée jusqu'à l'arrêt
  totalMaxMin: 90, // au-delà de 90 min de trajet total, le score vaut 0
  holdMarginSec: 300, // une réservation dure jusqu'à l'ETA + 5 min
  maxAlternatives: 5,
};

// Seuils de détection pour l'optimisation (cas d'usage 5)
export const analyticsParams = {
  peakHourFactor: 1.25, // heure de pointe = 125 % de la moyenne horaire
  saturatedLoad: 0.75, // taux de remplissage (sens de pointe, sur une heure) à partir duquel une ligne est "saturée"
  highRefusalRate: 0.1, // 10 % d'étudiants qui voient passer un bus plein
  longWaitMin: 8, // attente moyenne jugée longue
  lowLoad: 0.3, // heure creuse : remplissage moyen sous 30 %
  mergeLoad: 0.1, // ligne quasi vide : remplissage journalier moyen sous 10 %
  maxOffPeakHeadwayMin: 30, // attente maximale acceptable entre deux bus en heures creuses
  targetLoad: 0.6, // remplissage cible pour redimensionner une ligne
  longGapKm: 3, // tronçon entre deux arrêts considéré comme trop long
  minStopSpacingKm: 1, // écart minimal avec un arrêt existant pour créer un nouvel arrêt
  longWalkShare: 0.2, // 20 % d'étudiants qui marchent plus d'1 km
  mergeOverlap: 0.5, // au moins 50 % d'arrêts communs pour proposer une fusion
};
