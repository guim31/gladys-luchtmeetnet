// -----------------------------------------------------------------------------
// The integration end to end, on the SDK's fake Gladys and the real
// Luchtmeetnet answers: discovery, states, freshness, the container's own
// polling, the scene triggers, the status of the Configuration screen.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld, discovered, featureId } from './helpers/world.js';
import {
  AMSTERDAM,
  GRONINGEN,
  ROTTERDAM,
  fixture,
  lkiAt,
  shift,
  withValue,
} from './helpers/network.js';
import { MemoryStore } from '../src/store.js';
import { TEXT } from '../src/i18n.js';

const HOUR = 3_600_000;
const ALL = [AMSTERDAM, GRONINGEN, ROTTERDAM].join(',');

/** The answers of the hour after the fixtures (21:00), with some changes. */
function nextHour(w, station, { lki, values = {} } = {}) {
  let body = shift(fixture(`measurements-${station}`), 1);
  for (const [formula, value] of Object.entries(values)) {
    body = withValue(body, formula, value);
  }
  w.network.measurements[station] = body;
  if (lki !== undefined) {
    w.network.lki[station] = lkiAt(lki, '2026-11-19T21:00:00+00:00', station);
  }
}

test('one device per station, named after its sheet, with what it measures', async () => {
  const w = await createWorld({ config: { stations: ALL } });
  const keys = (id) => discovered(w, id).features.map((f) => f.external_id.split(':').pop());
  assert.equal(discovered(w, AMSTERDAM).name, 'Luchtmeetnet Amsterdam-Vondelpark');
  assert.deepEqual(keys(AMSTERDAM), [
    'index',
    'quality',
    'pm25',
    'pm10',
    'no2',
    'o3',
    'no',
    'co',
    'age',
  ]);
  // Groningen: PM10 is missing from its sheet, learnt from its measurements.
  assert.deepEqual(keys(GRONINGEN), ['index', 'quality', 'pm25', 'pm10', 'no2', 'o3', 'no', 'age']);
  assert.deepEqual(keys(ROTTERDAM), [
    'index',
    'quality',
    'pm25',
    'pm10',
    'no2',
    'o3',
    'so2',
    'no',
    'c6h6',
    'age',
  ]);
  assert.equal(discovered(w, AMSTERDAM).should_poll, false);
  assert.equal(discovered(w, AMSTERDAM).features[0].name, "Indice de qualité de l'air (LKI)");
  assert.equal(discovered(w, AMSTERDAM).external_id, 'ext:test-integration:station:NL49014');
  // Nothing is published for a device not added to Gladys.
  assert.deepEqual(w.gladys.fake.states, []);
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('the states of an added station: LKI, its band, pollutants, age', async () => {
  const w = await createWorld({ config: { stations: ALL } });
  await createAll(w);
  const last = (id, key) => w.gladys.fake.lastState(featureId(w, id, key));
  assert.equal(last(AMSTERDAM, 'index'), 4);
  assert.equal(last(AMSTERDAM, 'quality'), 'Moyen');
  assert.equal(last(AMSTERDAM, 'pm25'), 5.8);
  assert.equal(last(AMSTERDAM, 'co'), 253.7);
  assert.equal(last(AMSTERDAM, 'age'), 20);
  // Instrument noise below zero is published as 0.
  assert.equal(last(GRONINGEN, 'no'), 0);
  assert.equal(last(ROTTERDAM, 'so2'), 1);
  assert.equal(last(ROTTERDAM, 'c6h6'), 0.26);
  assert.ok(w.gladys.fake.widgetRefreshes.includes('air_quality'));
});

test('a device added again gets every state again, even unchanged', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM } });
  await createAll(w);
  const before = w.gladys.fake.states.length;
  await w.gladys.fake.deviceCreated(discovered(w, AMSTERDAM));
  assert.equal(w.gladys.fake.states.length - before, 9, 'index, quality, 6 pollutants, age');
});

test('an old value is never published as current', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM } });
  w.advance(4 * HOUR); // Luchtmeetnet stuck on 20:00: the data are 4 h 20 old
  await createAll(w);
  const last = (key) => w.gladys.fake.lastState(featureId(w, AMSTERDAM, key));
  assert.equal(last('pm25'), undefined);
  assert.equal(last('index'), undefined);
  assert.equal(last('age'), 260);
});

test('the container reads the added stations on its own timer, not on onPoll', async () => {
  const w = await createWorld({ config: { stations: `${AMSTERDAM},${GRONINGEN}` } });
  await w.gladys.fake.deviceCreated(discovered(w, AMSTERDAM));
  const count = (path) => w.network.calls.filter((call) => call.startsWith(path)).length;
  const before = count('/lki?');
  // Within the period: nothing read again.
  w.advance(20 * 60_000);
  await w.app.poller.cycle();
  assert.equal(count('/lki?'), before);
  // Past it: the added station only (Groningen was read once, for discovery).
  w.advance(10 * 60_000);
  await w.app.poller.cycle();
  assert.equal(count('/lki?'), before + 1);
  assert.match(
    w.network.calls.findLast((call) => call.startsWith('/lki?')),
    /NL49014/,
  );
  // The station sheet is read once a day at most, the full list never.
  assert.equal(count('/stations/NL49014'), 1);
  assert.equal(count('/stations?'), 0);
  // Every read asks for the last hours, never the default 7-day window.
  for (const call of w.network.calls.filter((c) => /^\/(lki|measurements)\?/.test(c))) {
    assert.match(call, /&start=2026-11-\d\dT\d\d:\d\d:\d\dZ&end=/);
  }
});

test('LKI trigger: one event per threshold crossed upwards, none going down', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM, language: 'en' } });
  await createAll(w);
  // The first LKI sets the reference: no event.
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
  nextHour(w, AMSTERDAM, { lki: 7 });
  w.advance(HOUR);
  await w.app.poller.cycle();
  const events = w.gladys.fake.sceneEvents;
  assert.deepEqual(
    events.map((event) => [event.key, event.data.threshold]),
    [
      ['lki_above_threshold', '5'],
      ['lki_above_threshold', '6'],
      ['lki_above_threshold', '7'],
    ],
  );
  const [first] = events;
  assert.equal(first.data.station, discovered(w, AMSTERDAM).external_id);
  assert.equal(first.data.station_name, 'Luchtmeetnet Amsterdam-Vondelpark');
  assert.equal(first.data.lki, 7);
  assert.equal(first.data.previous_lki, 4);
  assert.equal(first.data.level, 'insufficient');
  assert.equal(first.data.level_label, 'Insufficient');
  assert.match(
    first.data.summary,
    /^Luchtmeetnet Amsterdam-Vondelpark: Insufficient \(LKI 7\) · PM2\.5/,
  );
  // The same hour read again, then a lower LKI: nothing.
  w.advance(HOUR);
  await w.app.poller.cycle();
  w.network.lki[AMSTERDAM] = lkiAt(3, '2026-11-19T22:00:00+00:00');
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.sceneEvents.length, 3);
});

test('pollutant trigger: thresholds crossed by an hourly value, in µg/m³', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM } });
  await createAll(w);
  // NO₂ from 10.9 to 52; O₃ from 42 to 39 (down: nothing).
  nextHour(w, AMSTERDAM, { values: { NO2: 52, O3: 39 } });
  w.advance(HOUR);
  await w.app.poller.cycle();
  const events = w.gladys.fake.sceneEvents;
  assert.deepEqual(
    events.map((event) => [event.key, event.data.pollutant, event.data.threshold]),
    ['15', '20', '25', '30', '40', '50'].map((t) => ['pollutant_above_threshold', 'no2', t]),
  );
  assert.equal(events[0].data.value, 52);
  assert.equal(events[0].data.previous_value, 10.9);
  assert.equal(events[0].data.pollutant_label, 'NO₂');
  assert.equal(w.gladys.fake.lastState(featureId(w, AMSTERDAM, 'no2')), 52);
});

test('no event for a station not added, nor twice after a restart', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ config: { stations: AMSTERDAM }, store });
  nextHour(w, AMSTERDAM, { lki: 8 });
  w.advance(HOUR);
  await w.app.poller.refreshNow([AMSTERDAM]);
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
  await w.app.stop();

  // Restarted, the device now added: the same hour is not news.
  const devices = w.gladys.fake.discoveredDevices;
  const again = await createWorld({
    config: { stations: AMSTERDAM },
    store,
    devices,
    setup: (network) => nextHour({ network }, AMSTERDAM, { lki: 8 }),
  });
  again.advance(HOUR);
  await again.app.poller.refreshNow([AMSTERDAM]);
  assert.equal(again.gladys.fake.lastState(featureId(again, AMSTERDAM, 'index')), 8);
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
  // The device names and pollutants come back from /data, before any read.
  const offline = await createWorld({
    config: { stations: AMSTERDAM },
    store,
    setup: (network) => {
      network.down = true;
    },
  });
  assert.equal(discovered(offline, AMSTERDAM).features.length, 9);
  assert.equal(discovered(offline, AMSTERDAM).name, 'Luchtmeetnet Amsterdam-Vondelpark');
});

test('the status: nothing configured, API down and back', async () => {
  const empty = await createWorld();
  assert.deepEqual(empty.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.notConfigured,
  });

  const w = await createWorld({ config: { stations: AMSTERDAM } });
  await createAll(w);
  w.network.down = true;
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.apiUnreachable,
  });
  w.network.down = false;
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('a 429 from Luchtmeetnet: the status says it, the requests pause 5 minutes', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM } });
  await createAll(w);
  w.network.lki[AMSTERDAM] = { status: 429 };
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus, {
    connected: false,
    message: TEXT.apiUnreachable,
  });
  delete w.network.lki[AMSTERDAM];
  // Read again at once: the limiter first waits out the minute (test clock).
  const before = w.clock.now;
  await w.app.poller.refreshNow([AMSTERDAM]);
  assert.ok(w.clock.now - before >= 299_000, 'paused after the 429');
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('a station unknown to Luchtmeetnet gives no device, and the check says why', async () => {
  const w = await createWorld({ config: { stations: 'NL99999' } });
  assert.deepEqual(w.gladys.fake.discoveredDevices, []);
  const ack = await w.gladys.fake.action('check_stations', {});
  assert.equal(ack.success, false);
  assert.equal(ack.error.en, 'NL99999: not a Luchtmeetnet station (see "Find a station")');
  assert.equal(
    ack.error.fr,
    'NL99999 : pas une station Luchtmeetnet (voir « Trouver une station »)',
  );
});

test('onPoll, should the core call it, reads only a station that is due', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM } });
  await createAll(w);
  const before = w.network.calls.length;
  await w.gladys.fake.poll(discovered(w, AMSTERDAM));
  assert.equal(w.network.calls.length, before);
  w.advance(HOUR);
  await w.gladys.fake.poll(discovered(w, AMSTERDAM));
  assert.ok(w.network.calls.length > before);
});

test('a device added days after the configuration fires nothing at once', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM } });
  // Read once for the Discovery tab (LKI 4), then not read while not added.
  w.advance(48 * HOUR);
  w.network.lki[AMSTERDAM] = lkiAt(9, '2026-11-21T20:00:00+00:00');
  await createAll(w);
  assert.equal(w.gladys.fake.lastState(featureId(w, AMSTERDAM, 'index')), 9);
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
  // From there, a rise does fire.
  w.network.lki[AMSTERDAM] = lkiAt(10, '2026-11-21T21:00:00+00:00');
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((event) => event.data.threshold),
    ['10'],
  );
});

test('an event Gladys refused is sent at the next cycle, an event sent is not sent again', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ config: { stations: AMSTERDAM }, store });
  await createAll(w);
  const publish = w.gladys.publishSceneEvent.bind(w.gladys);
  let refuse = true;
  w.gladys.publishSceneEvent = async (...args) => {
    if (refuse) {
      refuse = false;
      throw new Error('HTTP 429');
    }
    return publish(...args);
  };
  w.network.lki[AMSTERDAM] = lkiAt(5, '2026-11-19T21:00:00+00:00');
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.sceneEvents, []);
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((event) => event.data.threshold),
    ['5'],
  );
  await w.app.stop();

  // Restarted on the same /data, the same hour: nothing new.
  const again = await createWorld({
    config: { stations: AMSTERDAM },
    store,
    devices: w.gladys.fake.discoveredDevices,
    setup: (network) => {
      network.lki[AMSTERDAM] = lkiAt(5, '2026-11-19T21:00:00+00:00');
    },
  });
  again.advance(2 * HOUR);
  await again.app.poller.refreshNow([AMSTERDAM]);
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
});

test('a station without LKI nor some components keeps what it has', async () => {
  const w = await createWorld({
    config: { stations: GRONINGEN },
    setup: (network) => {
      network.lki[GRONINGEN] = lkiAt(4, '2026-11-19T20:00:00+00:00', GRONINGEN);
      network.lki[GRONINGEN].data = [];
    },
  });
  await createAll(w);
  const last = (key) => w.gladys.fake.lastState(featureId(w, GRONINGEN, key));
  assert.equal(last('index'), undefined);
  assert.equal(last('quality'), undefined);
  assert.equal(last('pm10'), 3.59);
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('a list spread over several pages is read to the last page', async () => {
  const w = await createWorld({
    config: { stations: AMSTERDAM },
    setup: (network) => {
      // 24 hours of data: 192 items, 8 pages of 25.
      const body = fixture(`measurements-${AMSTERDAM}`);
      const hours = Array.from({ length: 8 }, (_, i) => shift(body, -3 * i).data).flat();
      network.measurements[AMSTERDAM] = { ...body, data: hours };
    },
  });
  await createAll(w);
  const pages = w.network.calls.filter((call) => call.startsWith('/measurements?'));
  assert.equal(pages.length, 8);
  assert.match(pages.at(-1), /&page=8$/);
  assert.equal(w.gladys.fake.lastState(featureId(w, AMSTERDAM, 'pm25')), 5.8);
});

test('a failed read is tried again 5 minutes later, not a period later', async () => {
  const w = await createWorld({ config: { stations: AMSTERDAM } });
  await createAll(w);
  const reads = () => w.network.calls.filter((call) => call.startsWith('/lki?')).length;
  w.network.down = true;
  w.advance(HOUR);
  await w.app.poller.cycle();
  const failed = reads();
  w.network.down = false;
  w.advance(60_000);
  await w.app.poller.cycle();
  assert.equal(reads(), failed, 'not at once');
  w.advance(4 * 60_000);
  await w.app.poller.cycle();
  assert.equal(reads(), failed + 1);
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('a station unknown to Luchtmeetnet costs one request per read, not three', async () => {
  const w = await createWorld({ config: { stations: 'NL99999' } });
  assert.deepEqual(w.network.calls, ['/stations/NL99999']);
});
