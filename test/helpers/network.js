// -----------------------------------------------------------------------------
// A simulated Luchtmeetnet API, answering with the real responses recorded on
// 2026-11-19 around 20:20 UTC (test/fixtures/luchtmeetnet), data up to the
// 20:00 hour: Amsterdam-Vondelpark (NL49014), Groningen-Nijensteinheerd
// (NL10938, whose sheet omits PM10 although it measures it, and whose NO is
// slightly negative) and Rotterdam-Hoogvliet (NL01485, near the port: SO₂ and
// benzene too). Tests never touch the network.
// -----------------------------------------------------------------------------

import { existsSync, readFileSync } from 'node:fs';

const url = (name) => new URL(`../fixtures/luchtmeetnet/${name}.json`, import.meta.url);

/** A recorded answer, parsed (null when there is none). */
export function fixture(name) {
  return existsSync(url(name)) ? JSON.parse(readFileSync(url(name), 'utf8')) : null;
}

/** The stations of the fixtures. */
export const AMSTERDAM = 'NL49014';
export const GRONINGEN = 'NL10938';
export const ROTTERDAM = 'NL01485';

/** A paged answer of one page. */
export function page(data) {
  return {
    pagination: {
      last_page: 1,
      first_page: 1,
      prev_page: 1,
      current_page: 1,
      page_list: [1],
      next_page: 1,
    },
    data,
  };
}

/** An LKI answer: one value at an ISO hour. */
export function lkiAt(value, iso, station = AMSTERDAM) {
  return page([{ station_number: station, formula: 'LKI', value, timestamp_measured: iso }]);
}

/** Move every date of a measurement (or LKI) answer by some hours. */
export function shift(body, hours) {
  const copy = structuredClone(body);
  const move = (text) =>
    new Date(Date.parse(text) + hours * 3_600_000).toISOString().replace('.000Z', '+00:00');
  for (const item of copy.data) {
    for (const key of [
      'timestamp_measured',
      'timestamp_measured_start',
      'timestamp_measured_end',
    ]) {
      if (item[key]) {
        item[key] = move(item[key]);
      }
    }
  }
  return copy;
}

/** A measurement answer with one component set to a value (latest hour). */
export function withValue(body, formula, value) {
  const copy = structuredClone(body);
  const latest = copy.data
    .filter((item) => item.formula === formula)
    .sort((a, b) => Date.parse(b.timestamp_measured) - Date.parse(a.timestamp_measured))[0];
  latest.value = value;
  return copy;
}

/**
 * @param {object} [options]
 * @param {() => number} [options.now] the clock passed to the route functions
 */
export function createNetwork({ now = () => Date.now() } = {}) {
  const calls = [];
  const network = {
    calls,
    /** Overrides by station: a body, a function (now) => body, an Error, or { status }. */
    lki: {},
    measurements: {},
    station: {},
    /** Overrides of the station list, by page number. */
    stations: {},
    /** The whole API unreachable. */
    down: false,
    fetch,
  };

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  function answer(route, fallback) {
    const value = typeof route === 'function' ? route(now()) : route;
    if (value instanceof Error) {
      throw value;
    }
    if (value && typeof value === 'object' && Object.keys(value).length === 1 && value.status) {
      return new Response('<html>error</html>', { status: value.status });
    }
    return json(value ?? fallback);
  }

  async function fetch(href) {
    const path = String(href).replace('https://api.luchtmeetnet.nl/open_api', '');
    calls.push(path);
    if (network.down) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    const query = new URL(`http://x${path}`).searchParams;
    let match;
    if (path.startsWith('/stations?')) {
      const number = query.get('page');
      return answer(network.stations[number], fixture(`stations-${number}`) ?? page([]));
    }
    if ((match = /^\/stations\/([A-Z0-9]+)$/.exec(path))) {
      // Luchtmeetnet answers an unknown number with a 404 page.
      return answer(network.station[match[1]], fixture(`station-${match[1]}`) ?? { status: 404 });
    }
    const station = query.get('station_number');
    if (path.startsWith('/lki?')) {
      return answer(network.lki[station], fixture(`lki-${station}`) ?? page([]));
    }
    if (path.startsWith('/measurements?')) {
      const number = query.get('page');
      const response = answer(
        network.measurements[station],
        fixture(`measurements-${station}`) ?? page([]),
      );
      return response.status === 200 ? paginate(await response.json(), Number(number)) : response;
    }
    return new Response('not found', { status: 404 });
  }

  /** Split a list in pages of 25, as the API does. */
  function paginate(body, number) {
    if (!Array.isArray(body?.data)) {
      return json(body);
    }
    const pages = Math.max(1, Math.ceil(body.data.length / 25));
    return json({
      pagination: { ...body.pagination, last_page: pages, current_page: number },
      data: body.data.slice((number - 1) * 25, number * 25),
    });
  }

  return network;
}
