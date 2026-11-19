// -----------------------------------------------------------------------------
// The buttons of the Configuration screen: find a station, check the stations.
// A failure is thrown (Gladys shows it in red), a success returned (green).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './helpers/world.js';
import { AMSTERDAM, GRONINGEN } from './helpers/network.js';
import { BUNDLED, fold, searchStations } from '../src/catalog.js';

// A house in the centre of Amsterdam (Dam square).
const HOUSE = { selector: 'home', name: 'Thuis', latitude: 52.3731, longitude: 4.8926 };

test('find by name or town, case and hyphens ignored, sorted by name', async () => {
  const w = await createWorld({ houses: [HOUSE] });
  const ack = await w.gladys.fake.action('find_station', { query: 'groningen' });
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message.en,
    [
      'Luchtmeetnet stations for "groningen", to type in "Stations":',
      'NL10937 Groningen-Europaweg',
      'NL10938 Groningen-Nijensteinheerd',
    ].join('\n'),
  );
});

test('no name: the nearest stations to the house, with their distance', async () => {
  const w = await createWorld({ houses: [HOUSE] });
  const ack = await w.gladys.fake.action('find_station', {});
  assert.equal(ack.success, true, ack.error);
  const lines = ack.data.message.fr.split('\n');
  assert.equal(lines[0], 'Stations Luchtmeetnet autour de Thuis, à saisir dans « Stations » :');
  assert.equal(lines[1], 'NL49019 Amsterdam-Oude Schans (0.8 km)');
  assert.equal(lines.length, 10, 'the head, 8 stations, the tail');
  // The live list (5 pages) is kept: a second search does not read it again.
  await w.gladys.fake.action('find_station', { query: 'Utrecht' });
  assert.equal(w.network.calls.filter((call) => call.startsWith('/stations?')).length, 5);
});

test('the station list unreachable: the list shipped with the image answers', async () => {
  const w = await createWorld({ setup: (network) => (network.down = true) });
  const ack = await w.gladys.fake.action('find_station', { query: 'Vondelpark' });
  assert.equal(ack.success, true, ack.error);
  assert.match(ack.data.message.en, /NL49014 Amsterdam-Vondelpark/);
});

test('no match, or no name and no located house: a failure, in four languages', async () => {
  const w = await createWorld({ houses: [{ selector: 'h', name: 'H' }] });
  let ack = await w.gladys.fake.action('find_station', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.en, /Settings → Houses/);
  assert.match(ack.error.fr, /Paramètres → Maisons/);
  ack = await w.gladys.fake.action('find_station', { query: 'Paris' });
  assert.equal(ack.success, false);
  assert.equal(ack.error.fr, 'Aucune station Luchtmeetnet pour « Paris ».');
});

test('check the stations: LKI, components, age', async () => {
  const w = await createWorld({ config: { stations: `${AMSTERDAM}, nl10938` } });
  const ack = await w.gladys.fake.action('check_stations', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message.en,
    [
      'NL49014 Amsterdam-Vondelpark: Moderate (LKI 4), PM2.5, PM10, NO₂, O₃, NO, CO (20 min ago)',
      'NL10938 Groningen-Nijensteinheerd: Moderate (LKI 4), PM2.5, PM10, NO₂, O₃, NO (20 min ago)',
    ].join('\n'),
  );
});

test('a typo or one station failing: the whole report, as a failure', async () => {
  const w = await createWorld({ config: { stations: `${AMSTERDAM}, abc` } });
  let ack = await w.gladys.fake.action('check_stations', {});
  assert.equal(ack.success, false);
  assert.equal(
    ack.error.en,
    [
      'NL49014 Amsterdam-Vondelpark: Moderate (LKI 4), PM2.5, PM10, NO₂, O₃, NO, CO (20 min ago)',
      'Ignored, not station numbers: abc',
    ].join('\n'),
  );
  const two = await createWorld({ config: { stations: `${AMSTERDAM}, NL99999` } });
  ack = await two.gladys.fake.action('check_stations', {});
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /NL99999 : pas une station Luchtmeetnet/);
});

test('check with nothing configured, or nothing answering: a failure', async () => {
  const empty = await createWorld();
  let ack = await empty.gladys.fake.action('check_stations', {});
  assert.equal(ack.success, false);
  assert.equal(ack.error.de, 'Keine Station ist konfiguriert.');
  const w = await createWorld({ config: { stations: GRONINGEN } });
  w.network.down = true;
  w.advance(2 * 60_000);
  ack = await w.gladys.fake.action('check_stations', {});
  assert.equal(ack.success, false);
  assert.match(
    ack.error.en,
    /^NL10938 Groningen-Nijensteinheerd: error \(Luchtmeetnet API unreachable/,
  );
});

test('search helpers: folding, ordering, the bundled list', () => {
  assert.equal(fold('Den Haag-Rebecquestraat'), 'den haag rebecquestraat');
  assert.ok(BUNDLED.size >= 100, 'about a hundred stations recorded');
  for (const station of BUNDLED.values()) {
    assert.match(station.id, /^[A-Z]{2}\d{3,6}$/);
    assert.ok(station.lat > 50.7 && station.lat < 53.7, `${station.id}: latitude`);
    assert.ok(station.lon > 3.3 && station.lon < 7.3, `${station.id}: longitude`);
  }
  const stations = [
    { id: 'NL1', name: 'B', municipality: 'Utrecht', lat: 52.09, lon: 5.12 },
    { id: 'NL2', name: 'A', municipality: 'Utrecht', lat: null, lon: null },
  ];
  assert.deepEqual(
    searchStations(stations, { query: 'utrecht' }).map((s) => s.id),
    ['NL2', 'NL1'],
  );
  assert.deepEqual(
    searchStations(stations, { origin: { lat: 52, lon: 5 } }).map((s) => s.id),
    ['NL1', 'NL2'],
  );
});
