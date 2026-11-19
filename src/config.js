// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined`, strings typed with spaces, or invalid values.
// -----------------------------------------------------------------------------

import { normalizeStationId } from './api.js';

/** The languages of the Gladys interface, the ones every text carries. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The refresh intervals offered, in minutes (Luchtmeetnet publishes hourly values). */
export const REFRESH_MINUTES = ['30', '60'];

/** At most this many stations are read: a public service limited to 100 requests per 5 minutes. */
export const MAX_STATIONS = 10;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  stations: '', // Luchtmeetnet station numbers, e.g. "NL49014, NL10938"
  refresh_minutes: '30', // how often the stations are read
  language: 'fr', // language of the feature names and of the generated texts
};

/**
 * Merge the user config with the defaults and normalize every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const ids = parseStationIds(raw.stations ?? DEFAULT_CONFIG.stations);
  const refresh = String(raw.refresh_minutes ?? DEFAULT_CONFIG.refresh_minutes).trim();
  const language = String(raw.language ?? DEFAULT_CONFIG.language).trim();
  return {
    stationIds: ids.valid.slice(0, MAX_STATIONS),
    invalidStationIds: ids.invalid,
    droppedStationIds: ids.valid.slice(MAX_STATIONS),
    refreshMinutes: REFRESH_MINUTES.includes(refresh)
      ? Number(refresh)
      : Number(DEFAULT_CONFIG.refresh_minutes),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/**
 * Split a typed list of station numbers ("NL49014"). Commas, semicolons and
 * spaces separate them; case does not matter, and digits alone get the "NL"
 * prefix every Dutch station has. Duplicates are dropped, the order is kept.
 * @param {unknown} text
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseStationIds(text) {
  const valid = [];
  const invalid = [];
  for (const token of String(text).split(/[\s,;]+/)) {
    if (token === '') {
      continue;
    }
    const normalized = normalizeStationId(/^\d+$/.test(token) ? `NL${token}` : token);
    if (normalized) {
      if (!valid.includes(normalized)) {
        valid.push(normalized);
      }
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}

/** The refresh period of the stations, in milliseconds. */
export function periodMs(config) {
  return config.refreshMinutes * 60_000;
}
