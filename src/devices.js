// -----------------------------------------------------------------------------
// The Gladys devices: one per Luchtmeetnet station.
//
// External ids (forever, see CLAUDE.md):
//   ext:<selector>:station:<station number, e.g. NL49014>
//   features :index, :quality, :pm25, :pm10, :no2, :o3, :so2, :nh3, :no, :co,
//            :c6h6, :age
//
// Features:
//   - index   : the Dutch air quality index (LKI, Luchtkwaliteitsindex),
//               `airquality-sensor/aqi`, 1 (good) to 11 (very bad), the
//               official scale;
//   - quality : the LKI band as a word, in the configured language (text/text);
//   - the components the station measures, hourly averages in µg/m³. PM2.5,
//     PM10, NO₂, O₃ and SO₂ have their Gladys category. NH₃, NO, CO and benzene
//     have none in µg/m³ (`co-sensor` is a binary detector in ppm, `voc-sensor`
//     is in ppb): they are `unknown/unknown` features, which Gladys shows as a
//     number with its unit, named by their formula;
//   - age     : minutes since the hour the last data refer to.
//
// The components are learnt from the station sheet and from the measurements
// (the sheet is sometimes incomplete), kept under /data, and never removed: a
// feature is an external id Gladys keeps.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './i18n.js';

/** The pollutants, in display order. */
export const POLLUTANTS = ['pm25', 'pm10', 'no2', 'o3', 'so2', 'nh3', 'no', 'co', 'c6h6'];

export const INDEX_KEY = 'index';
export const QUALITY_KEY = 'quality';
export const AGE_KEY = 'age';

const DEVICE_TYPE = 'station';

const concentration = (category, type, max) => ({
  category,
  type,
  unit: UNITS.MICROGRAM_PER_CUBIC_METER,
  min: 0,
  max,
  keep_history: true,
});

// min/max are display bounds (Gladys never clamps a state with them).
const SHAPES = {
  index: {
    category: CATEGORIES.AIRQUALITY_SENSOR,
    type: TYPES.AIRQUALITY_SENSOR.AQI,
    unit: UNITS.AQI,
    min: 1,
    max: 11,
    keep_history: true,
  },
  quality: {
    category: CATEGORIES.TEXT,
    type: TYPES.TEXT.TEXT,
    min: 0,
    max: 0,
    keep_history: false,
  },
  pm25: concentration(CATEGORIES.PM25_SENSOR, TYPES.SENSOR.DECIMAL, 500),
  pm10: concentration(CATEGORIES.PM10_SENSOR, TYPES.SENSOR.DECIMAL, 500),
  no2: concentration(CATEGORIES.NO2_SENSOR, TYPES.SENSOR.DECIMAL, 500),
  o3: concentration(CATEGORIES.O3_SENSOR, TYPES.SENSOR.DECIMAL, 500),
  so2: concentration(CATEGORIES.SO2_SENSOR, TYPES.SENSOR.DECIMAL, 500),
  nh3: concentration(CATEGORIES.UNKNOWN, TYPES.UNKNOWN.UNKNOWN, 500),
  no: concentration(CATEGORIES.UNKNOWN, TYPES.UNKNOWN.UNKNOWN, 500),
  co: concentration(CATEGORIES.UNKNOWN, TYPES.UNKNOWN.UNKNOWN, 20000),
  c6h6: concentration(CATEGORIES.UNKNOWN, TYPES.UNKNOWN.UNKNOWN, 50),
  // A week on the scale; an older measurement still gets its real age.
  age: {
    category: CATEGORIES.DURATION,
    type: TYPES.DURATION.INTEGER,
    unit: UNITS.MINUTES,
    min: 0,
    max: 10080,
    keep_history: false,
  },
};

/**
 * The external ids of a station.
 * @param {object} gladys
 * @param {string} stationId
 */
export function idsOf(gladys, stationId) {
  return gladys.externalIds(DEVICE_TYPE, String(stationId));
}

/** The station number of a device (or feature) external id, or null. */
export function stationIdOf(externalId) {
  const match = /:station:([A-Z]{2}\d+)(?::[a-z0-9]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/** The device name: the network and the station, never translated. */
export function deviceName(record) {
  return `Luchtmeetnet ${record.name || record.id}`;
}

/** The pollutants of a record, in display order. */
export function pollutantsOf(record) {
  return POLLUTANTS.filter((key) => (record.pollutants ?? []).includes(key));
}

/**
 * The discovery payload of a station.
 * @param {object} gladys
 * @param {{ id: string, name?: string, pollutants?: string[] }} record
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, record, language) {
  const names = NAMES[language] ?? NAMES.fr;
  const ids = idsOf(gladys, record.id);
  const feature = (key) => ({
    name: names[key],
    external_id: ids.feature(key),
    ...SHAPES[key],
    read_only: true,
    has_feedback: false,
  });
  return {
    name: deviceName(record),
    external_id: ids.device,
    model: 'Luchtmeetnet',
    // Luchtmeetnet publishes hourly: the container reads the stations on its own
    // timer (src/poller.js), well beyond the 60 s the core can schedule.
    should_poll: false,
    features: [
      feature(INDEX_KEY),
      feature(QUALITY_KEY),
      ...pollutantsOf(record).map(feature),
      feature(AGE_KEY),
    ],
    params: [{ name: 'station_id', value: String(record.id) }],
  };
}
