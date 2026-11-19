// -----------------------------------------------------------------------------
// The list of the Luchtmeetnet stations, for the "Find a station" button.
//
// The API list gives numbers and names only: the coordinates need one request
// per station (about 100), too many for the limit of 100 requests per 5
// minutes. They ship with the image (src/stations.json, recorded from the API,
// see CLAUDE.md), and a station read by the integration adds its own. The
// live list (5 pages) is read at most once a day, kept under /data with the
// rest (src/hub.js), and a failed read keeps the previous list.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fetchStations } from './api.js';

/** The stations recorded with their coordinates, by number. */
export const BUNDLED = new Map(
  JSON.parse(readFileSync(new URL('./stations.json', import.meta.url), 'utf8')).map((station) => [
    station.id,
    station,
  ]),
);

/** The list is read again after this age. */
export const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** After a failed read, the next attempt waits this long. */
const RETRY_MS = 10 * 60 * 1000;

export class Catalog {
  /**
   * @param {object} options
   * @param {{ fetch?: typeof fetch }} [options.deps]
   * @param {() => number} [options.now]
   */
  constructor({ deps = {}, now = () => Date.now() } = {}) {
    this.deps = deps;
    this.now = now;
    this.stations = [];
    /** Stations read by the integration, by number (not persisted: records keep them). */
    this.learnt = new Map();
    this.fetchedAt = 0;
    this.failedAt = 0;
    this.lastError = null;
    this.loading = null;
    /** Set when a new list must be saved under /data. */
    this.changed = false;
  }

  /** Restore the list saved under /data. */
  restore(saved) {
    if (saved && Array.isArray(saved.stations) && typeof saved.fetchedAt === 'number') {
      this.stations = saved.stations.filter((station) => station && station.id);
      this.fetchedAt = saved.fetchedAt;
    }
  }

  /** What is saved under /data. */
  snapshot() {
    return { stations: this.stations, fetchedAt: this.fetchedAt };
  }

  /**
   * The list, read again when older than a day (force: older than a minute,
   * the user asked). A failed read keeps the previous list, and throws only
   * when there is none.
   */
  async ensure({ force = false } = {}) {
    const age = this.now() - this.fetchedAt;
    const fresh = this.stations.length > 0 && age < (force ? 60_000 : CATALOG_MAX_AGE_MS);
    // After a failure, wait before asking again, whoever asks.
    const waiting = this.failedAt > 0 && this.now() - this.failedAt < (force ? 60_000 : RETRY_MS);
    if (fresh || (waiting && this.stations.length > 0)) {
      return this.stations;
    }
    if (waiting) {
      throw this.lastError;
    }
    this.loading ??= fetchStations(this.deps)
      .then((stations) => {
        this.stations = stations;
        this.fetchedAt = this.now();
        this.failedAt = 0;
        this.changed = true;
      })
      .catch((err) => {
        this.failedAt = this.now();
        this.lastError = err;
        if (this.stations.length === 0) {
          throw err;
        }
      })
      .finally(() => {
        this.loading = null;
      });
    await this.loading;
    return this.stations;
  }

  /**
   * The known stations: the live list (or the bundled one before the first
   * read), with the bundled coordinates and what the station reads taught.
   */
  all() {
    const ids = this.stations.length > 0 ? this.stations.map((s) => s.id) : [...BUNDLED.keys()];
    return ids.map((id) => this.byId(id));
  }

  /** @param {string} id */
  byId(id) {
    const live = this.stations.find((station) => station.id === id);
    const bundled = BUNDLED.get(id);
    const learnt = this.learnt.get(id);
    if (!live && !bundled && !learnt) {
      return undefined;
    }
    return {
      id,
      name: live?.name ?? learnt?.name ?? bundled?.name ?? id,
      municipality: learnt?.municipality ?? bundled?.municipality ?? '',
      lat: learnt?.lat ?? bundled?.lat ?? null,
      lon: learnt?.lon ?? bundled?.lon ?? null,
    };
  }

  /** What a station read taught (name, municipality, coordinates). */
  learn(station) {
    this.learnt.set(station.id, station);
  }
}

/** Lower case, without diacritics, hyphens and underscores as spaces. */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[-_]/g, ' ')
    .toLowerCase();
}

/** Distance between two points, in km (haversine). */
export function distanceKm(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The stations matching a search: every word of the query in the number,
 * the name or the municipality (accents ignored), sorted by distance to the house when one is given,
 * else by name.
 * @param {object[]} stations
 * @param {{ query?: string, origin?: { lat: number, lon: number } }} search
 * @returns {Array<object & { distanceKm?: number }>}
 */
export function searchStations(stations, { query = '', origin } = {}) {
  const words = fold(query)
    .split(/[\s,]+/)
    .filter(Boolean);
  const found = stations
    .filter((station) => {
      const text = fold(`${station.id} ${station.name} ${station.municipality}`);
      return words.every((word) => text.includes(word));
    })
    .map((station) =>
      origin && station.lat !== null && station.lon !== null
        ? { ...station, distanceKm: distanceKm(origin, station) }
        : { ...station },
    );
  return found.sort((a, b) =>
    origin
      ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
      : a.name.localeCompare(b.name, 'nl'),
  );
}
