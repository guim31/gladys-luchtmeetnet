// -----------------------------------------------------------------------------
// Scene action "Get the air quality" (Gladys 5.1+).
//
// Gives a scene the air quality of one station, or of the worst of the added
// stations, as outputs a notification can quote: "{{...summary}}" reads
// "Luchtmeetnet Amsterdam-Vondelpark: Moderate (LKI 4) · PM2.5 12.7 µg/m³".
// A failure throws a text in the configured language (a scene action gets no
// user language).
// The devices already give each value to the scene conditions; what this
// action adds is the choice of the worst station, the level as a word in the
// configured language, and a ready-made sentence.
//
// The triggers are fired by the hub (src/hub.js) on each new hour of data.
// -----------------------------------------------------------------------------

import { BANDS, TEXT } from './i18n.js';

export const GET_AIR_QUALITY = 'get_air_quality';

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ station?: string }} fields
 * @param {string} language
 */
export function getAirQuality(hub, fields, language) {
  const created = hub.configuredRecords().filter((record) => hub.isCreated(record));
  let record;
  if (fields.station) {
    record = created.find((candidate) => candidate === hub.recordByDevice(fields.station));
  } else {
    // The worst current index; the first configured station on a tie.
    record = created
      .filter((candidate) => hub.indexOf(candidate))
      .sort((a, b) => hub.indexOf(b).level - hub.indexOf(a).level)[0];
  }
  if (!record || hub.isStale(record)) {
    throw new Error(TEXT.noReading[language]);
  }
  const index = hub.indexOf(record);
  const values = hub.valuesOf(record);
  const outputs = {
    station_name: hub.nameOf(record),
    level: index?.key ?? null,
    lki: index?.level ?? null,
    level_label: index ? BANDS[index.key][language] : TEXT.noIndex[language],
    pm25: values.pm25 ?? null,
    pm10: values.pm10 ?? null,
    no2: values.no2 ?? null,
    o3: values.o3 ?? null,
    age_minutes: hub.ageMinutes(record),
    summary: hub.summary(record, language),
  };
  // What the station does not measure is left out (null for the scene).
  return Object.fromEntries(Object.entries(outputs).filter(([, value]) => value !== null));
}
