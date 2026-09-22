import test from 'node:test';
import assert from 'node:assert/strict';
import { topRoutes, optimizationReport } from '../src/services/analyticsService.js';
import { getStops } from '../src/services/stopsService.js';
import { makeEngine } from './helpers.js';

const fullDay = () => makeEngine({ untilSec: 21 * 3600 + 1800 });

test('top 5 : classé par nombre d\'étudiants transportés décroissant', () => {
  const { routes } = topRoutes(fullDay(), 5);
  assert.equal(routes.length, 5);
  for (let i = 1; i < routes.length; i++) {
    assert.ok(routes[i - 1].transported >= routes[i].transported);
  }
  for (const r of routes) assert.ok(r.peakSaturation >= 0 && r.peakSaturation <= 100);
});

test('arrêts : chaque arrêt expose montées, descentes, attente et temps moyen', () => {
  const { stops } = getStops(fullDay());
  for (const s of stops) {
    for (const key of ['waiting', 'boarded', 'alighted', 'leftBehind', 'avgWaitMin']) {
      assert.equal(typeof s[key], 'number');
    }
  }
});

test('optimisation : chaque action est appuyée par des indicateurs chiffrés', () => {
  const report = optimizationReport(fullDay());
  assert.ok(report.actions.length > 0, 'au moins une action attendue sur la journée type');
  for (const action of report.actions) {
    assert.ok(Object.keys(action.indicators).length >= 3);
    assert.ok(['ADD_BUS', 'RESCHEDULE', 'NEW_STOP', 'MERGE_LINES'].includes(action.type));
  }
  assert.ok(report.peakWindows.length > 0);
});
