import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, walkSeconds } from '../src/lib/geo.js';

test('1 degré de latitude vaut environ 111 km', () => {
  const d = haversineKm({ lat: 6, lon: 2 }, { lat: 7, lon: 2 });
  assert.ok(Math.abs(d - 111.2) < 0.5);
});

test('distance nulle entre un point et lui-même', () => {
  assert.equal(haversineKm({ lat: 6.4, lon: 2.3 }, { lat: 6.4, lon: 2.3 }), 0);
});

test('4,5 km à pied = 1 heure', () => {
  assert.equal(walkSeconds(4.5), 3600);
});
