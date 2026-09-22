// Petits utilitaires partagés par les tests.
import { buildNetwork } from '../src/simulation/network.js';
import { Engine } from '../src/simulation/engine.js';

export function makeEngine({ seed = 42, untilSec = 8 * 3600 } = {}) {
  const network = buildNetwork();
  const engine = new Engine(network, { seed });
  engine.runUntil(untilSec);
  return engine;
}
