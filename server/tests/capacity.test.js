import test from 'node:test';
import assert from 'node:assert/strict';
import { fillRate, getFleet } from '../src/services/fleetService.js';
import { makeEngine } from './helpers.js';

test("exemple de l'énoncé : Bus A, 45 passagers / 60 places = 75 %", () => {
  assert.equal(fillRate(45, 60), 75);
  assert.equal(60 - 45, 15); // places restantes
});

test('getFleet : places libres = capacité - passagers, pour chaque bus', () => {
  const engine = makeEngine();
  const { buses, summary } = getFleet(engine);
  for (const b of buses) {
    assert.equal(b.freeSeats, b.capacity - b.passengers);
    assert.ok(b.fillRate >= 0 && b.fillRate <= 100);
  }
  assert.equal(summary.freeSeats, summary.totalCapacity - summary.totalPassengers);
});
