// Mesure simple du temps de calcul d'une recommandation (ordre de grandeur).
// Utilisation : npm run bench
import { buildNetwork } from '../src/simulation/network.js';
import { Engine } from '../src/simulation/engine.js';
import { recommend } from '../src/services/recommendationService.js';

const engine = new Engine(buildNetwork(), { seed: 1 });
engine.runUntil(8 * 3600); // pleine heure de pointe

// Quelques départs / destinations variés (on tourne dessus pour ne pas biaiser la mesure)
const inputs = [
  { lat: 6.4485, lon: 2.356, destinationStopId: 'uac' },
  { lat: 6.3905, lon: 2.34, destinationStopId: 'uac' },
  { lat: 6.356, lon: 2.44, destinationStopId: 'uac' },
  { lat: 6.36, lon: 2.38, destinationStopId: 'campus-cotonou' },
];
const N = 2000;

// Sans cache : chaque requête recalcule la trajectoire de tous les bus
let t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) recommend(engine, inputs[i % inputs.length]);
const perRequestMs = Number(process.hrtime.bigint() - t0) / 1e6 / N;

// Avec cache partagé (les prévisions sont calculées une fois par seconde, pas à chaque requête)
const cache = new Map();
t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) recommend(engine, inputs[i % inputs.length], { cache });
const cachedMs = Number(process.hrtime.bigint() - t0) / 1e6 / N;

console.log(`Flotte : ${engine.buses.length} bus`);
console.log(`Recommandation sans cache : ${perRequestMs.toFixed(3)} ms / requête`);
console.log(`Recommandation avec cache : ${cachedMs.toFixed(3)} ms / requête`);
