import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, normalizeWeights, recommend, simulateCrowd } from '../src/services/recommendationService.js';
import { makeEngine } from './helpers.js';

const weights = normalizeWeights();

test('les pondérations sont normalisées (somme = 1)', () => {
  const w = normalizeWeights({ eta: 10, seats: 10, walk: 0, total: 0 });
  assert.equal(w.eta + w.seats + w.walk + w.total, 1);
  assert.equal(w.eta, 0.5);
});

test("exemple de l'énoncé : Bus A (2 min, 8 places) est préféré à Bus B (4 min, 35 places)", () => {
  const a = computeScore({ etaSec: 120, freeSeats: 8, walkKm: 0.3, totalSec: 20 * 60 }, weights);
  const b = computeScore({ etaSec: 240, freeSeats: 35, walkKm: 0.3, totalSec: 22 * 60 }, weights);
  assert.ok(a.score > b.score);
});

test('à égalité sur le reste, plus de places libres donne un meilleur score', () => {
  const few = computeScore({ etaSec: 300, freeSeats: 2, walkKm: 0.3, totalSec: 1200 }, weights);
  const many = computeScore({ etaSec: 300, freeSeats: 8, walkKm: 0.3, totalSec: 1200 }, weights);
  assert.ok(many.score > few.score);
});

test('une recommandation renvoie un bus avec au moins une place et une explication', () => {
  const engine = makeEngine({ untilSec: 8 * 3600 });
  const res = recommend(engine, { lat: 6.4485, lon: 2.356, destinationStopId: 'uac' });
  assert.ok(res.best);
  assert.ok(res.best.freeSeats > 0);
  assert.ok(res.message.length > 10);
});

test('destination inconnue : erreur 400', () => {
  const engine = makeEngine();
  assert.throws(() => recommend(engine, { lat: 6.4, lon: 2.3, destinationStopId: 'nulle-part' }), (e) => e.status === 400);
});

test('200 étudiants : sans réservation tous vont sur le même bus, avec réservation aucun bus n\'est surchargé', () => {
  const engine = makeEngine({ untilSec: 6 * 3600 });
  const holdsBefore = engine.holds.length;
  const res = simulateCrowd(engine, { lat: 6.4485, lon: 2.356, destinationStopId: 'uac', count: 200 });

  assert.equal(res.withoutHolds.busesUsed, 1);
  assert.ok(res.withoutHolds.overloaded > 0);
  assert.equal(res.withHolds.overloaded, 0);
  assert.ok(res.withHolds.busesUsed > 1);

  const placed = res.withHolds.distribution.reduce((s, d) => s + d.assigned, 0);
  assert.equal(placed + res.withHolds.unserved, 200);
  assert.equal(engine.holds.length, holdsBefore, 'la simulation ne laisse aucune réservation');
});

test('une réservation retire une place aux recommandations suivantes', () => {
  const engine = makeEngine({ untilSec: 6 * 3600 });
  const input = { lat: 6.4485, lon: 2.356, destinationStopId: 'uac' };
  const first = recommend(engine, input, { hold: true });
  const second = recommend(engine, input);
  const sameOption = second.best.bus.id === first.best.bus.id && second.best.etaMin === first.best.etaMin;
  if (sameOption) assert.equal(second.best.freeSeats, first.best.freeSeats - 1);
  assert.ok(first.hold);
});
