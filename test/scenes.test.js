// -----------------------------------------------------------------------------
// The scene action "Get the air quality": one station, or the worst one.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld, discovered } from './helpers/world.js';
import { AMSTERDAM, GRONINGEN, ROTTERDAM, lkiAt } from './helpers/network.js';

async function world(language = 'fr') {
  const w = await createWorld({
    config: { stations: [AMSTERDAM, GRONINGEN, ROTTERDAM].join(','), language },
    setup: (network) => {
      network.lki[ROTTERDAM] = lkiAt(7, '2026-11-19T20:00:00+00:00', ROTTERDAM);
    },
  });
  await createAll(w);
  return w;
}

test('one station: its LKI, values and a sentence', async () => {
  const w = await world('en');
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {
    station: discovered(w, AMSTERDAM).external_id,
  });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs ?? ack.data, {
    station_name: 'Luchtmeetnet Amsterdam-Vondelpark',
    level: 'moderate',
    lki: 4,
    level_label: 'Moderate',
    pm25: 5.8,
    pm10: 9,
    no2: 10.9,
    o3: 42,
    age_minutes: 20,
    summary:
      'Luchtmeetnet Amsterdam-Vondelpark: Moderate (LKI 4) · PM2.5 5.8 µg/m³ · PM10 9 µg/m³ · NO₂ 10.9 µg/m³ · O₃ 42 µg/m³',
  });
});

test('no station chosen: the worst LKI', async () => {
  const w = await world();
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {});
  const outputs = ack.data.outputs ?? ack.data;
  assert.equal(outputs.station_name, 'Luchtmeetnet Rotterdam-Hoogvliet');
  assert.equal(outputs.level_label, 'Insuffisant');
  assert.equal(outputs.lki, 7);
});

test('nothing recent: the action fails, in the configured language', async () => {
  const w = await world();
  w.advance(5 * 3_600_000);
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {});
  assert.equal(ack.success, false);
  assert.equal(ack.error, "Pas encore de relevé de la qualité de l'air.");
});
