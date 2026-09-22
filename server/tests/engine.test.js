import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork } from '../src/simulation/network.js';
import { Engine } from '../src/simulation/engine.js';
import { makeEngine } from './helpers.js';

test('un bus ne dépasse jamais sa capacité pendant toute la journée', () => {
  const network = buildNetwork();
  const engine = new Engine(network, { seed: 7 });
  while (engine.clock < 21 * 3600) {
    engine.advance(60);
    for (const bus of engine.buses) {
      assert.ok(bus.passengers.length <= bus.capacity, `${bus.id} dépasse sa capacité`);
    }
  }
});

test('conservation : étudiants apparus = montés + encore en attente', () => {
  const engine = makeEngine({ untilSec: 12 * 3600 });
  for (const state of Object.values(engine.stopState)) {
    assert.equal(state.stats.spawned, state.stats.boarded + state.waiting.length);
  }
});

test('même graine = mêmes résultats (simulation reproductible)', () => {
  const a = makeEngine({ seed: 99 });
  const b = makeEngine({ seed: 99 });
  assert.deepEqual(a.hourly, b.hourly);
});

test('les bus sont bien positionnés entre deux arrêts', () => {
  const engine = makeEngine();
  for (const bus of engine.buses) {
    const pos = engine.busPosition(bus);
    assert.ok(pos.lat > 6.3 && pos.lat < 6.5);
    assert.ok(pos.lon > 2.3 && pos.lon < 2.5);
  }
});
