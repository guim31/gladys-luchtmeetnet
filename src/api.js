// -----------------------------------------------------------------------------
// The Luchtmeetnet open API (https://api.luchtmeetnet.nl/open_api), open,
// without key: the official Dutch air quality network (RIVM, DCMR, GGD
// Amsterdam and the provinces). This module is the only place that knows its
// field names, and returns neutral objects to the rest of the code.
//
// Limit published by Luchtmeetnet (https://api-docs.luchtmeetnet.nl): 100
// requests per 5 minutes. Every request goes through a limiter that keeps
// under 90 per sliding 5 minutes, and backs off for a minute after a 429.
//
// /measurements and /lki without `start`/`end` answer a 302 to another host
// with a 7-day window: both are always given (the last hours only).
// -----------------------------------------------------------------------------

export const API_URL = 'https://api.luchtmeetnet.nl/open_api';

const TIMEOUT_MS = 20_000;

const USER_AGENT = 'gladys-luchtmeetnet (+https://github.com/guim31/gladys-luchtmeetnet)';

/** Requests allowed per window (Luchtmeetnet: 100 per 5 minutes, kept under). */
export const RATE_MAX = 90;
export const RATE_WINDOW_MS = 5 * 60_000;

/** After a 429, no request for this long. */
const BACKOFF_MS = 60_000;

/** Hours of measurements asked: the last hour is sometimes published late. */
const MEASUREMENT_HOURS = 3;

/** Hours of LKI asked. */
const LKI_HOURS = 6;

/** Pages read at most for one list (25 items per page). */
const MAX_PAGES = 8;

/** The components the integration publishes, by Luchtmeetnet formula. */
export const POLLUTANT_BY_FORMULA = {
  PM25: 'pm25',
  PM10: 'pm10',
  NO2: 'no2',
  O3: 'o3',
  SO2: 'so2',
  NH3: 'nh3',
  NO: 'no',
  CO: 'co',
  C6H6: 'c6h6',
};

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, unreachable?: boolean }} [details]
   */
  constructor(message, { status, unreachable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    /** No usable answer for any station (network, timeout, 429, 5xx). */
    this.unreachable = unreachable;
  }
}

/**
 * A sliding-window limiter: `take()` resolves when one more request fits.
 * @param {object} [options]
 * @param {() => number} [options.now]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 */
export function createLimiter({
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  max = RATE_MAX,
  windowMs = RATE_WINDOW_MS,
} = {}) {
  const stamps = [];
  let blockedUntil = 0;
  let queue = Promise.resolve();

  async function wait() {
    for (;;) {
      const at = now();
      while (stamps.length > 0 && at - stamps[0] >= windowMs) {
        stamps.shift();
      }
      let delay = Math.max(0, blockedUntil - at);
      if (delay === 0 && stamps.length >= max) {
        delay = stamps[0] + windowMs - at;
      }
      if (delay <= 0) {
        stamps.push(at);
        return;
      }
      await sleep(delay);
    }
  }

  return {
    /** Wait for a slot (callers are served in order). */
    take() {
      const run = queue.then(wait);
      queue = run.catch(() => {});
      return run;
    },
    /** The API answered 429: pause every request. */
    backOff() {
      blockedUntil = now() + BACKOFF_MS;
    },
    /** Requests counted in the current window (tests). */
    get used() {
      return stamps.length;
    },
  };
}

/**
 * GET a path of the API, as JSON.
 * @param {string} path
 * @param {{ fetch?: typeof fetch, limiter?: ReturnType<typeof createLimiter> }} [deps]
 */
async function getJson(path, { fetch: fetchImpl = globalThis.fetch, limiter } = {}) {
  await limiter?.take();
  let response;
  try {
    response = await fetchImpl(`${API_URL}${path}`, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.message;
    throw new ApiError(`Luchtmeetnet API unreachable (${reason})`, { unreachable: true });
  }
  if (response.status === 429) {
    limiter?.backOff();
    throw new ApiError('Luchtmeetnet API: too many requests (429)', {
      status: 429,
      unreachable: true,
    });
  }
  if (!response.ok) {
    throw new ApiError(`Luchtmeetnet API: HTTP ${response.status}`, {
      status: response.status,
      unreachable: response.status >= 500,
    });
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: said below.
  }
  if (!body || typeof body !== 'object') {
    throw new ApiError('Luchtmeetnet API: unreadable answer', { status: response.status });
  }
  return body;
}

/** Every page of a list, `data` items concatenated. */
async function getList(path, deps) {
  const items = [];
  const separator = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await getJson(`${path}${separator}page=${page}`, deps);
    if (!Array.isArray(body.data)) {
      throw new ApiError('Luchtmeetnet API: no data list in the answer');
    }
    items.push(...body.data);
    const last = Number(body.pagination?.last_page ?? 1);
    if (!Number.isFinite(last) || page >= last) {
      break;
    }
  }
  return items;
}

const toNumber = (value) => {
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
};

const toTime = (value) => {
  const at = Date.parse(String(value ?? ''));
  return Number.isNaN(at) ? null : at;
};

/** A station number as the API writes it ("NL10938"), or null. */
export function normalizeStationId(value) {
  const id = String(value ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}\d{3,6}$/.test(id) ? id : null;
}

/** An ISO time without milliseconds, as the API accepts it. */
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The `start`/`end` window of the last hours. */
function timeWindow(hours, now) {
  const end = now();
  return `start=${iso(end - hours * 3_600_000)}&end=${iso(end)}`;
}

/**
 * Every station of the network: numbers and names (no coordinates in the list).
 * @param {object} [deps]
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function fetchStations(deps) {
  const stations = [];
  for (const item of await getList('/stations?order_by=number', deps)) {
    const id = normalizeStationId(item?.number);
    if (id) {
      stations.push({ id, name: String(item.location ?? id).trim() });
    }
  }
  return stations;
}

/**
 * One station: name, municipality, coordinates and the components it lists.
 * Null when Luchtmeetnet does not know the number.
 * @param {string} id
 * @param {object} [deps]
 */
export async function fetchStation(id, deps) {
  let body;
  try {
    body = await getJson(`/stations/${encodeURIComponent(id)}`, deps);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }
  const data = body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.location) {
    return null;
  }
  const [lon, lat] = Array.isArray(data.geometry?.coordinates) ? data.geometry.coordinates : [];
  return {
    id,
    name: String(data.location).trim(),
    municipality: String(data.municipality ?? '').trim(),
    organisation: String(data.organisation ?? '').trim(),
    lat: toNumber(lat),
    lon: toNumber(lon),
    pollutants: (Array.isArray(data.components) ? data.components : [])
      .map((formula) => POLLUTANT_BY_FORMULA[formula])
      .filter(Boolean),
  };
}

/**
 * The latest LKI (Luchtkwaliteitsindex, 1 to 11) of a station, or null.
 * @param {string} id
 * @param {object} deps `now` is required
 * @returns {Promise<{ value: number, at: number } | null>}
 */
export async function fetchLki(id, deps) {
  const items = await getList(
    `/lki?station_number=${encodeURIComponent(id)}&order_by=timestamp_measured&order_direction=desc&${timeWindow(LKI_HOURS, deps.now)}`,
    deps,
  );
  let latest = null;
  for (const item of items) {
    const value = toNumber(item?.value);
    const at = toTime(item?.timestamp_measured);
    if (value === null || at === null || (latest && at <= latest.at)) {
      continue;
    }
    const level = Math.round(value);
    if (level >= 1 && level <= 11) {
      latest = { value: level, at };
    }
  }
  return latest;
}

/**
 * The latest hourly value of each published component of a station (µg/m³).
 * Small negative values (instrument noise around zero) become 0.
 * @param {string} id
 * @param {object} deps `now` is required
 * @returns {Promise<Record<string, { value: number, at: number }>>}
 */
export async function fetchMeasurements(id, deps) {
  const items = await getList(
    `/measurements?station_number=${encodeURIComponent(id)}&order_by=timestamp_measured&order_direction=desc&${timeWindow(MEASUREMENT_HOURS, deps.now)}`,
    deps,
  );
  const latest = {};
  for (const item of items) {
    const key = POLLUTANT_BY_FORMULA[item?.formula];
    const value = toNumber(item?.value);
    const at = toTime(item?.timestamp_measured);
    if (!key || value === null || at === null) {
      continue;
    }
    if (!latest[key] || at > latest[key].at) {
      latest[key] = { value: Math.max(0, value), at };
    }
  }
  return latest;
}
