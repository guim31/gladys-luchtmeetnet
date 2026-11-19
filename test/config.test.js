import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  MAX_STATIONS,
  normalizeConfig,
  parseStationIds,
  periodMs,
} from '../src/config.js';

test('the defaults read nothing, every 30 minutes, in French', () => {
  const config = normalizeConfig();
  assert.deepEqual(config.stationIds, []);
  assert.equal(config.refreshMinutes, 30);
  assert.equal(config.language, 'fr');
  assert.equal(DEFAULT_CONFIG.language, 'fr');
});

test('station numbers: commas, spaces, semicolons, any case, digits alone', () => {
  assert.deepEqual(parseStationIds(' NL49014, nl10938;NL49014  01485 '), {
    valid: ['NL49014', 'NL10938', 'NL01485'],
    invalid: [],
  });
  assert.deepEqual(parseStationIds('NL49014, Amsterdam, #NL1, 1.5, NL'), {
    valid: ['NL49014'],
    invalid: ['Amsterdam', '#NL1', '1.5', 'NL'],
  });
  assert.deepEqual(parseStationIds(''), { valid: [], invalid: [] });
});

test(`at most ${MAX_STATIONS} stations are read, the others are reported`, () => {
  const ids = Array.from({ length: MAX_STATIONS + 2 }, (_, index) => `NL${10100 + index}`);
  const config = normalizeConfig({ stations: ids.join(',') });
  assert.equal(config.stationIds.length, MAX_STATIONS);
  assert.deepEqual(config.droppedStationIds, ids.slice(MAX_STATIONS));
});

test('the refresh interval is one of the offered values', () => {
  assert.equal(normalizeConfig({ refresh_minutes: '60' }).refreshMinutes, 60);
  assert.equal(normalizeConfig({ refresh_minutes: '5' }).refreshMinutes, 30);
  assert.equal(normalizeConfig({ refresh_minutes: 'often' }).refreshMinutes, 30);
  assert.equal(periodMs(normalizeConfig({ refresh_minutes: '60' })), 3_600_000);
});

test('an unknown language falls back to French', () => {
  assert.equal(normalizeConfig({ language: 'de' }).language, 'de');
  assert.equal(normalizeConfig({ language: 'nl' }).language, 'fr');
});
