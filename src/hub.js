// -----------------------------------------------------------------------------
// The stations the integration reads, what it knows about them, and what it
// publishes to Gladys.
//
// Reading a station (refresh) updates its "record" — name, place, the
// components it measures, the last value of each, the LKI — persisted under
// /data; the record gives the Gladys device (src/devices.js) and its states.
//
// Freshness: Luchtmeetnet publishes hourly values, a little after the hour. A
// value older than STALE_MINUTES is NOT published (nor sent again by the
// heartbeat): a value Gladys shows as recent is a recent measurement. Only
// the age keeps moving.
//
// Scene triggers, on each new hour of data:
//   lki_above_threshold       the LKI rises to a threshold (2 to 11) or above;
//   pollutant_above_threshold a component rises to a threshold in µg/m³.
// One event per threshold crossed upwards, so a scene set on "7" runs once
// when the LKI goes from 5 to 8. The first reading after the install, or
// after a gap of more than ANNOUNCED_MAX_AGE_MS, sets the reference silently.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  ApiError,
  createLimiter,
  fetchLki,
  fetchMeasurements,
  fetchStation,
  normalizeStationId,
} from './api.js';
import { Catalog } from './catalog.js';
import {
  AGE_KEY,
  INDEX_KEY,
  QUALITY_KEY,
  buildDevice,
  deviceName,
  idsOf,
  pollutantsOf,
  stationIdOf,
} from './devices.js';
import { createIssueLog } from './issues.js';
import { BANDS, FORMULAS, MESSAGES, bandOf } from './i18n.js';

const logger = createLogger({ name: 'stations' });

/** Past this age, a value is stale: not published, and the widget says so. */
export const STALE_MINUTES = 180;

/** An unchanged value is published again this often (Gladys: "no recent value" past 48 h). */
export const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

/** The station sheet (name, place, components) is read again after this age. */
const IDENTITY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * A previous value measured longer before than this is no reference for a
 * scene event (the station was not read meanwhile, or published nothing):
 * the new value starts afresh, without event.
 */
const ANNOUNCED_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/** The LKI thresholds offered to the scenes. */
export const LKI_THRESHOLDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** The concentration thresholds offered to the scenes, in µg/m³. */
export const POLLUTANT_THRESHOLDS = [
  10, 15, 20, 25, 30, 40, 50, 75, 100, 120, 150, 180, 200, 240, 350,
];

/** Keys of the scene triggers. */
export const TRIGGER = {
  LKI_ABOVE: 'lki_above_threshold',
  POLLUTANT_ABOVE: 'pollutant_above_threshold',
};

const STORE_VERSION = 1;

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {() => object} options.getConfig the current normalized config
   * @param {{ load: Function, save: Function }} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   * @param {(ms: number) => Promise<void>} [options.sleep] the rate limiter's wait
   */
  constructor({ gladys, getConfig, store, fetch, now = () => Date.now(), sleep }) {
    this.gladys = gladys;
    this.getConfig = getConfig;
    this.store = store;
    this.deps = { fetch, now, limiter: createLimiter({ now, sleep }) };
    this.now = now;
    this.catalog = new Catalog({ deps: this.deps, now });
    /** Record by station id. */
    this.records = new Map();
    /** Set when the device list must be published again (new pollutant, name). */
    this.devicesChanged = false;
    /** Set when the widget content changed. */
    this.widgetChanged = false;
    this.persistNeeded = false;
    /** Scene events waiting for the publication of their station's states, by id. */
    this.pendingEvents = new Map();
    /** Outcome of the last read of each station: { ok, error? }. */
    this.lastResults = new Map();
    this.issues = createIssueLog(logger);
  }

  async load() {
    const data = await this.store.load();
    if (data.version !== STORE_VERSION) {
      return;
    }
    this.catalog.restore(data.catalog);
    for (const record of data.records ?? []) {
      if (record && normalizeStationId(record.id) === record.id) {
        record.pollutants ??= [];
        record.values ??= {};
        this.records.set(record.id, record);
        if (record.name) {
          this.catalog.learn(placeOf(record));
        }
      }
    }
  }

  async persist() {
    await this.store.save({
      version: STORE_VERSION,
      catalog: this.catalog.snapshot(),
      records: [...this.records.values()],
    });
  }

  /** Persist if anything changed since the last save. */
  async save() {
    if (this.persistNeeded || this.catalog.changed) {
      this.persistNeeded = false;
      this.catalog.changed = false;
      await this.persist();
    }
  }

  /** The configured station ids. */
  units(config = this.getConfig()) {
    return config.stationIds;
  }

  /** The records of the configured stations, in the configured order. */
  configuredRecords(config = this.getConfig()) {
    return this.units(config)
      .map((id) => this.records.get(id))
      .filter(Boolean);
  }

  /** The record of a device (or feature) external id, if configured. */
  recordByDevice(externalId) {
    const id = stationIdOf(externalId);
    return id && this.units().includes(id) ? this.records.get(id) : undefined;
  }

  /** True when the user added the station's device to Gladys. */
  isCreated(record) {
    const id = idsOf(this.gladys, record.id).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** The name the user gave the device in Gladys, else ours. */
  nameOf(record) {
    const id = idsOf(this.gladys, record.id).device;
    return (
      (this.gladys.devices ?? []).find((device) => device.external_id === id)?.name ||
      deviceName(record)
    );
  }

  /** True once the station answered at least once (its pollutants are known). */
  isKnown(record) {
    return Boolean(record?.identityAt) && (record.pollutants.length > 0 || Boolean(record.index));
  }

  /** The discovery payloads of the configured stations read at least once. */
  buildDevices(config = this.getConfig()) {
    return this.configuredRecords(config)
      .filter((record) => this.isKnown(record))
      .map((record) => buildDevice(this.gladys, record, config.language));
  }

  /** Minutes since the hour of the most recent data, or null. */
  ageMinutes(record) {
    const times = [
      record?.index?.at,
      ...Object.values(record?.values ?? {}).map((item) => item?.at),
    ].filter((at) => typeof at === 'number');
    if (times.length === 0) {
      return null;
    }
    return Math.max(0, Math.floor((this.now() - Math.max(...times)) / 60_000));
  }

  /** True when the newest data are older than STALE_MINUTES (or absent). */
  isStale(record) {
    const minutes = this.ageMinutes(record);
    return minutes === null || minutes > STALE_MINUTES;
  }

  /** True when a dated value is recent enough to be shown as current. */
  isFresh(at) {
    return typeof at === 'number' && this.now() - at <= STALE_MINUTES * 60_000;
  }

  /** The current LKI of a record: `{ level (1-11), key (band) }`, or null (none, or stale). */
  indexOf(record) {
    const index = record?.index;
    if (!index || typeof index.value !== 'number' || !this.isFresh(index.at)) {
      return null;
    }
    return { level: index.value, key: bandOf(index.value) };
  }

  /** The fresh values of a record, by pollutant. */
  valuesOf(record) {
    const values = {};
    for (const key of pollutantsOf(record)) {
      const item = record.values?.[key];
      if (item && typeof item.value === 'number' && this.isFresh(item.at)) {
        values[key] = item.value;
      }
    }
    return values;
  }

  /**
   * Read one station: its sheet (once a day), its LKI and the last value of
   * each component.
   * @param {string} id
   */
  async refresh(id) {
    const record = this.records.get(id) ?? { id, pollutants: [], values: {} };
    this.records.set(id, record);
    try {
      await this.refreshIdentity(record);
      if (record.unknown) {
        // A 404 on its sheet: no need to ask for its data (the typo is said by the check).
        throw Object.assign(new Error('unknown to Luchtmeetnet'), { unknown: true });
      }
      const before = { level: this.indexOf(record)?.level ?? null, values: this.valuesOf(record) };
      const lki = await fetchLki(id, this.deps);
      const latest = await fetchMeasurements(id, this.deps);
      const events = [...this.applyValues(record, latest), ...this.applyIndex(record, lki)];
      if (events.length > 0) {
        // Built once the whole hour is applied: the summary is the new one.
        const language = this.getConfig().language;
        const common = {
          station: idsOf(this.gladys, record.id).device,
          station_name: this.nameOf(record),
          summary: this.summary(record, language),
        };
        const pending = this.pendingEvents.get(id) ?? [];
        pending.push(...events.map(({ key, data }) => ({ key, data: { ...common, ...data } })));
        this.pendingEvents.set(id, pending);
      }
      const after = { level: this.indexOf(record)?.level ?? null, values: this.valuesOf(record) };
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        this.widgetChanged = true;
      }
      this.persistNeeded = true;
      this.lastResults.set(id, { ok: true });
      this.issues.ok(`station:${id}`, `${deviceName(record)}: read again`);
      this.issues.ok('api', 'The Luchtmeetnet API answers again');
      logger.debug(`${deviceName(record)}: LKI ${JSON.stringify(record.index)}`);
      return record;
    } catch (err) {
      this.lastResults.set(id, { ok: false, error: err.message, unknown: err.unknown === true });
      if (err instanceof ApiError && err.unreachable) {
        // Unreachable or throttled: one problem for every station.
        this.issues.fail('api', err.message);
      } else {
        this.issues.fail(`station:${id}`, `${deviceName(record)}: ${err.message}`);
      }
      throw err;
    }
  }

  /** The station sheet: name, place, components (read once a day). */
  async refreshIdentity(record) {
    if (record.identityAt && this.now() - record.identityAt < IDENTITY_MAX_AGE_MS) {
      return;
    }
    const station = await fetchStation(record.id, this.deps);
    record.identityAt = this.now();
    record.unknown = !station;
    if (!station) {
      return;
    }
    if (record.name === undefined) {
      logger.info(`Station ${record.id} found: ${station.name}`);
    }
    if (station.name !== record.name) {
      this.devicesChanged = true;
    }
    Object.assign(record, {
      name: station.name,
      municipality: station.municipality,
      lat: station.lat,
      lon: station.lon,
    });
    this.catalog.learn(placeOf(record));
    for (const pollutant of station.pollutants) {
      this.learn(record, pollutant);
    }
  }

  /** A component the station measures: a feature, forever. */
  learn(record, pollutant) {
    if (!record.pollutants.includes(pollutant)) {
      record.pollutants.push(pollutant);
      this.devicesChanged = true;
    }
  }

  /**
   * New hourly values: keep them, and list the thresholds crossed upwards
   * since the previous hour of the same component.
   * @returns {Array<{ key: string, data: object }>}
   */
  applyValues(record, latest) {
    const events = [];
    record.seen ??= {};
    for (const [key, item] of Object.entries(latest)) {
      this.learn(record, key);
      const previous = record.values[key];
      if (previous && item.at < previous.at) {
        continue; // an older hour than the one kept
      }
      record.values[key] = item;
      const seen = record.seen[key];
      if (seen && item.at <= seen.at) {
        continue; // this hour was already seen
      }
      record.seen[key] = { value: item.value, at: item.at };
      if (!seen || item.at - seen.at > ANNOUNCED_MAX_AGE_MS) {
        continue; // no reference: this hour sets it
      }
      for (const threshold of POLLUTANT_THRESHOLDS) {
        if (seen.value < threshold && item.value >= threshold) {
          events.push({
            key: TRIGGER.POLLUTANT_ABOVE,
            data: {
              pollutant: key,
              pollutant_label: FORMULAS[key],
              threshold: String(threshold),
              value: item.value,
              previous_value: seen.value,
            },
          });
        }
      }
    }
    return events;
  }

  /**
   * A new LKI: keep it, and list the thresholds crossed upwards since the
   * previous hour.
   * @returns {Array<{ key: string, data: object }>}
   */
  applyIndex(record, lki) {
    if (!lki) {
      record.index = null;
      return [];
    }
    record.index = lki;
    const recent =
      typeof record.announcedAt === 'number' &&
      lki.at > record.announcedAt &&
      lki.at - record.announcedAt <= ANNOUNCED_MAX_AGE_MS;
    if (typeof record.announcedAt === 'number' && lki.at <= record.announcedAt) {
      return []; // this hour was already seen
    }
    const previous = recent ? record.announced : null;
    record.announced = lki.value;
    record.announcedAt = lki.at;
    if (typeof previous !== 'number') {
      return [];
    }
    const language = this.getConfig().language;
    const band = bandOf(lki.value);
    return LKI_THRESHOLDS.filter((threshold) => previous < threshold && lki.value >= threshold).map(
      (threshold) => ({
        key: TRIGGER.LKI_ABOVE,
        data: {
          threshold: String(threshold),
          lki: lki.value,
          previous_lki: previous,
          level: band,
          level_label: BANDS[band][language],
        },
      }),
    );
  }

  /** The ready-made sentence of a station, in a language. */
  summary(record, language) {
    const index = this.indexOf(record);
    return MESSAGES.summary({
      station: this.nameOf(record),
      level: index?.key ?? null,
      lki: index?.level ?? null,
      values: this.valuesOf(record),
    })[language];
  }

  /**
   * Publish the states of a station whose device exists in Gladys: its fresh
   * index and values, and its age. Only the changes go out (the SDK
   * deduplicates), plus a heartbeat.
   * @param {object} record
   * @param {{ force?: boolean }} [options] force: the device was just added
   */
  async publishStates(record, { force = false } = {}) {
    if (!this.isCreated(record)) {
      // No device, no scene can name it: the event is dropped.
      this.pendingEvents.delete(record.id);
      return;
    }
    const ids = idsOf(this.gladys, record.id);
    if (force) {
      this.gladys.forgetPublishedStates(ids.device);
    }
    const language = this.getConfig().language;
    const states = [];
    const state = (key, value) =>
      states.push({
        device_feature_external_id: ids.feature(key),
        ...(typeof value === 'string' ? { text: value } : { state: value }),
      });
    const index = this.indexOf(record);
    if (index) {
      state(INDEX_KEY, index.level);
      state(QUALITY_KEY, BANDS[index.key][language]);
    }
    for (const [key, value] of Object.entries(this.valuesOf(record))) {
      state(key, value);
    }
    const minutes = this.ageMinutes(record);
    if (minutes !== null) {
      state(AGE_KEY, minutes);
    }
    let failure = null;
    if (states.length > 0) {
      try {
        await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
      } catch (err) {
        failure = err;
      }
    }
    // The events go out even if the states failed, and each stays pending
    // until Gladys took it: `seen` already moved, it would never come again.
    const pending = this.pendingEvents.get(record.id) ?? [];
    while (pending.length > 0) {
      const event = pending[0];
      await this.gladys.publishSceneEvent(event.key, event.data);
      pending.shift();
      logger.debug(`${deviceName(record)}: ${event.key} ${event.data.threshold}`);
    }
    this.pendingEvents.delete(record.id);
    if (failure) {
      throw failure;
    }
  }

  /** Forget the records of the stations no longer configured. */
  prune(config = this.getConfig()) {
    const kept = new Set(this.units(config));
    for (const id of this.records.keys()) {
      if (!kept.has(id)) {
        this.records.delete(id);
        this.pendingEvents.delete(id);
        this.persistNeeded = true;
      }
    }
  }
}

/** What the catalog keeps of a record. */
function placeOf(record) {
  return {
    id: record.id,
    name: record.name,
    municipality: record.municipality ?? '',
    lat: record.lat ?? null,
    lon: record.lon ?? null,
  };
}
