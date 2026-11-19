// -----------------------------------------------------------------------------
// The Luchtmeetnet client against the real answers recorded on 2026-11-19
// (test/fixtures/luchtmeetnet), and its rate limiter.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  createLimiter,
  fetchLki,
  fetchMeasurements,
  fetchStation,
  fetchStations,
  normalizeStationId,
} from '../src/api.js';
import { AMSTERDAM, GRONINGEN, createNetwork, page } from './helpers/network.js';

const NOW = Date.parse('2026-11-19T20:20:00Z');

const deps = () => {
  const network = createNetwork();
  return { network, deps: { fetch: network.fetch, now: () => NOW } };
};

test('the station list: every page, numbers and names', async () => {
  const { deps: d, network } = deps();
  const stations = await fetchStations(d);
  assert.equal(stations.length, 103);
  assert.deepEqual(
    stations.find((station) => station.id === AMSTERDAM),
    { id: AMSTERDAM, name: 'Amsterdam-Vondelpark' },
  );
  assert.deepEqual(
    network.calls,
    [1, 2, 3, 4, 5].map((n) => `/stations?order_by=number&page=${n}`),
  );
});

test('a station sheet: name, place, coordinates, the components we publish', async () => {
  const { deps: d } = deps();
  assert.deepEqual(await fetchStation(GRONINGEN, d), {
    id: GRONINGEN,
    name: 'Groningen-Nijensteinheerd',
    municipality: 'Groningen',
    organisation: 'RIVM',
    lat: 53.246535,
    lon: 6.608937,
    pollutants: ['pm25', 'no', 'o3', 'no2'],
  });
  assert.equal(await fetchStation('NL99999', d), null, 'a 404: unknown');
});

test('the LKI: the newest hour of the window asked', async () => {
  const { deps: d, network } = deps();
  assert.deepEqual(await fetchLki(AMSTERDAM, d), {
    value: 4,
    at: Date.parse('2026-11-19T20:00:00Z'),
  });
  assert.equal(
    network.calls[0],
    '/lki?station_number=NL49014&order_by=timestamp_measured&order_direction=desc&start=2026-11-19T14:20:00Z&end=2026-11-19T20:20:00Z&page=1',
  );
  network.lki[AMSTERDAM] = page([]);
  assert.equal(await fetchLki(AMSTERDAM, d), null);
  network.lki[AMSTERDAM] = page([{ value: 0, timestamp_measured: '2026-11-19T20:00:00+00:00' }]);
  assert.equal(await fetchLki(AMSTERDAM, d), null, 'outside 1 to 11');
});

test('the measurements: newest hour per component, NOx and soot left out, noise at 0', async () => {
  const { deps: d } = deps();
  const at = Date.parse('2026-11-19T20:00:00Z');
  assert.deepEqual(await fetchMeasurements(GRONINGEN, d), {
    pm10: { value: 3.59, at },
    no2: { value: 4.24, at },
    pm25: { value: 1.45, at },
    o3: { value: 49.74, at },
    no: { value: 0, at },
  });
});

test('errors: HTTP status, unreachable API, 429, unreadable answer', async () => {
  const { deps: d, network } = deps();
  network.lki[AMSTERDAM] = { status: 500 };
  await assert.rejects(fetchLki(AMSTERDAM, d), (err) => err instanceof ApiError && err.unreachable);
  network.lki[AMSTERDAM] = { status: 400 };
  await assert.rejects(
    fetchLki(AMSTERDAM, d),
    (err) => err.status === 400 && !err.unreachable && err.message === 'Luchtmeetnet API: HTTP 400',
  );
  network.lki[AMSTERDAM] = { status: 429 };
  await assert.rejects(fetchLki(AMSTERDAM, d), (err) => err.status === 429 && err.unreachable);
  network.lki[AMSTERDAM] = { data: 'nope' };
  await assert.rejects(fetchLki(AMSTERDAM, d), /no data list/);
  network.down = true;
  await assert.rejects(fetchStation(AMSTERDAM, d), /unreachable \(ENOTFOUND\)/);
});

test('station numbers: two letters and digits, upper case', () => {
  assert.equal(normalizeStationId(' nl49014 '), 'NL49014');
  assert.equal(normalizeStationId('49014'), null);
  assert.equal(normalizeStationId('NL49014; DROP'), null);
});

test('the limiter keeps under 90 requests per 5 minutes, and pauses 5 minutes after a 429', async () => {
  let now = 0;
  const waits = [];
  const limiter = createLimiter({
    now: () => now,
    sleep: async (ms) => {
      waits.push(ms);
      now += ms;
    },
  });
  for (let i = 0; i < 90; i += 1) {
    await limiter.take();
    now += 100;
  }
  assert.deepEqual(waits, []);
  await limiter.take();
  assert.deepEqual(waits, [300_000 - 9_000], 'until the first request leaves the window');
  limiter.backOff();
  await limiter.take();
  assert.equal(waits.at(-1), 300_000, 'a whole window of the API');
});
