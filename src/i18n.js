// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface: English, French, German ("du") and Spanish ("usted").
//
// The five bands of the Dutch air quality index (LKI, Luchtkwaliteitsindex,
// 1 to 11), translated from their official Dutch names: Goed (1-3), Matig
// (4-6), Onvoldoende (7-8), Slecht (9-10), Zeer slecht (11).
// -----------------------------------------------------------------------------

/** The bands, by stable key (scene variables and outputs), with their LKI range. */
export const BAND_RANGES = {
  good: [1, 3],
  moderate: [4, 6],
  insufficient: [7, 8],
  bad: [9, 10],
  very_bad: [11, 11],
};

export const BANDS = {
  good: { en: 'Good', fr: 'Bon', de: 'Gut', es: 'Buena' },
  moderate: { en: 'Moderate', fr: 'Moyen', de: 'Mäßig', es: 'Moderada' },
  insufficient: { en: 'Insufficient', fr: 'Insuffisant', de: 'Unzureichend', es: 'Insuficiente' },
  bad: { en: 'Bad', fr: 'Mauvais', de: 'Schlecht', es: 'Mala' },
  very_bad: { en: 'Very bad', fr: 'Très mauvais', de: 'Sehr schlecht', es: 'Muy mala' },
};

/** The band key of an LKI value (1 to 11). */
export function bandOf(lki) {
  return Object.keys(BAND_RANGES).find((key) => lki <= BAND_RANGES[key][1]) ?? 'very_bad';
}

/** Chemical formulas: the same in every language. */
export const FORMULAS = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  o3: 'O₃',
  so2: 'SO₂',
  nh3: 'NH₃',
  no: 'NO',
  co: 'CO',
  c6h6: 'C₆H₆',
};

/** Feature names, by language (fixed when the device is added). */
export const NAMES = {
  en: {
    index: 'Air quality index (LKI)',
    quality: 'Air quality',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'Nitrogen dioxide (NO₂)',
    o3: 'Ozone (O₃)',
    so2: 'Sulphur dioxide (SO₂)',
    nh3: 'Ammonia (NH₃)',
    no: 'Nitrogen monoxide (NO)',
    co: 'Carbon monoxide (CO)',
    c6h6: 'Benzene (C₆H₆)',
    age: 'Measurement age',
  },
  fr: {
    index: "Indice de qualité de l'air (LKI)",
    quality: "Qualité de l'air",
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: "Dioxyde d'azote (NO₂)",
    o3: 'Ozone (O₃)',
    so2: 'Dioxyde de soufre (SO₂)',
    nh3: 'Ammoniac (NH₃)',
    no: "Monoxyde d'azote (NO)",
    co: 'Monoxyde de carbone (CO)',
    c6h6: 'Benzène (C₆H₆)',
    age: 'Âge de la mesure',
  },
  de: {
    index: 'Luftqualitätsindex (LKI)',
    quality: 'Luftqualität',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'Stickstoffdioxid (NO₂)',
    o3: 'Ozon (O₃)',
    so2: 'Schwefeldioxid (SO₂)',
    nh3: 'Ammoniak (NH₃)',
    no: 'Stickstoffmonoxid (NO)',
    co: 'Kohlenmonoxid (CO)',
    c6h6: 'Benzol (C₆H₆)',
    age: 'Alter der Messung',
  },
  es: {
    index: 'Índice de calidad del aire (LKI)',
    quality: 'Calidad del aire',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'Dióxido de nitrógeno (NO₂)',
    o3: 'Ozono (O₃)',
    so2: 'Dióxido de azufre (SO₂)',
    nh3: 'Amoníaco (NH₃)',
    no: 'Monóxido de nitrógeno (NO)',
    co: 'Monóxido de carbono (CO)',
    c6h6: 'Benceno (C₆H₆)',
    age: 'Antigüedad de la medición',
  },
};

/** Fixed texts. */
export const TEXT = {
  notConfigured: {
    en: 'No station yet: use "Find a station", then type its number.',
    fr: 'Aucune station : utilisez « Trouver une station », puis saisissez son numéro.',
    de: 'Noch keine Station: nutze „Station finden“ und gib dann ihre Nummer ein.',
    es: 'Ninguna estación: use «Buscar una estación» y escriba su número.',
  },
  apiUnreachable: {
    en: 'The Luchtmeetnet API does not answer: the values are not updated.',
    fr: "L'API de Luchtmeetnet ne répond pas : les valeurs ne sont plus mises à jour.",
    de: 'Die Luchtmeetnet-API antwortet nicht: Die Werte werden nicht aktualisiert.',
    es: 'La API de Luchtmeetnet no responde: los valores no se actualizan.',
  },
  initFailed: {
    en: 'The integration could not start: see the Logs tab.',
    fr: "L'intégration n'a pas pu démarrer : voir l'onglet Journaux.",
    de: 'Die Integration konnte nicht starten: siehe Reiter Protokolle.',
    es: 'La integración no pudo iniciarse: consulte la pestaña Registros.',
  },
  noReading: {
    en: 'No air quality reading yet.',
    fr: "Pas encore de relevé de la qualité de l'air.",
    de: 'Noch keine Messung der Luftqualität.',
    es: 'Todavía no hay lectura de la calidad del aire.',
  },
  noStation: {
    en: 'No station added to Gladys yet.',
    fr: 'Aucune station ajoutée à Gladys.',
    de: 'Noch keine Station zu Gladys hinzugefügt.',
    es: 'Ninguna estación añadida a Gladys.',
  },
  unknownStation: {
    en: 'This station is no longer read: check the configuration.',
    fr: "Cette station n'est plus lue : vérifiez la configuration.",
    de: 'Diese Station wird nicht mehr gelesen: prüfe die Konfiguration.',
    es: 'Esta estación ya no se lee: compruebe la configuración.',
  },
  nothingConfigured: {
    en: 'No station is configured.',
    fr: "Aucune station n'est configurée.",
    de: 'Keine Station ist konfiguriert.',
    es: 'No hay ninguna estación configurada.',
  },
  noHouse: {
    en: 'Type a name, or set the location of a house in Settings → Houses.',
    fr: 'Saisissez un nom, ou placez une maison dans Paramètres → Maisons.',
    de: 'Gib einen Namen ein oder lege den Standort eines Hauses unter Einstellungen → Zuhause fest.',
    es: 'Escriba un nombre, o defina la ubicación de una casa en Configuración → Viviendas.',
  },
  airQuality: {
    en: 'Air quality',
    fr: "Qualité de l'air",
    de: 'Luftqualität',
    es: 'Calidad del aire',
  },
  measured: { en: 'Measured', fr: 'Mesuré', de: 'Gemessen', es: 'Medido' },
  noData: { en: 'No data', fr: 'Pas de donnée', de: 'Keine Daten', es: 'Sin datos' },
  noIndex: { en: 'No index', fr: "Pas d'indice", de: 'Kein Index', es: 'Sin índice' },
  source: {
    en: 'Dutch LKI · Luchtmeetnet data, hourly averages',
    fr: 'LKI néerlandais · données Luchtmeetnet, moyennes horaires',
    de: 'Niederländischer LKI · Luchtmeetnet-Daten, Stundenmittel',
    es: 'LKI neerlandés · datos de Luchtmeetnet, medias horarias',
  },
};

/**
 * A failed action: Gladys shows the message of what the handler throws in red
 * (and what it returns in green), in the user's language.
 */
export class ActionFailure extends Error {
  /** @param {{ en: string, fr: string, de: string, es: string }} text */
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}

/** Texts built from values. */
export const MESSAGES = {
  /** "3 h ago", or "Outdated (2 d)" when stale. */
  measuredAgo(minutes, stale) {
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(minutes / 1440);
    const span =
      minutes < 60
        ? {
            en: `${minutes} min`,
            fr: `${minutes} min`,
            de: `${minutes} Min.`,
            es: `${minutes} min`,
          }
        : minutes < 2880
          ? { en: `${hours} h`, fr: `${hours} h`, de: `${hours} Std.`, es: `${hours} h` }
          : { en: `${days} d`, fr: `${days} j`, de: `${days} Tg.`, es: `${days} d` };
    if (stale) {
      return {
        en: `Outdated (${span.en})`,
        fr: `Périmée (${span.fr})`,
        de: `Veraltet (${span.de})`,
        es: `Desactualizada (${span.es})`,
      };
    }
    return {
      en: `${span.en} ago`,
      fr: `il y a ${span.fr}`,
      de: `vor ${span.de}`,
      es: `hace ${span.es}`,
    };
  },

  /**
   * "Luchtmeetnet Amsterdam-Vondelpark: Moderate (LKI 4) · PM2.5 12.7 µg/m³ · NO₂ 17.9 µg/m³".
   * @param {{ station: string, level: string|null, lki: number|null, values: Record<string, number> }} options
   */
  summary({ station, level, lki, values }) {
    const parts = ['pm25', 'pm10', 'no2', 'o3']
      .filter((key) => typeof values[key] === 'number')
      .map((key) => `${FORMULAS[key]} ${formatNumber(values[key])} µg/m³`);
    return Object.fromEntries(
      ['en', 'fr', 'de', 'es'].map((lang) => {
        const label = level ? `${BANDS[level][lang]} (LKI ${lki})` : TEXT.noIndex[lang];
        const colon = lang === 'fr' ? ' :' : ':';
        return [lang, [`${station}${colon} ${label}`, ...parts].join(' · ')];
      }),
    );
  },

  /** One line of the "Check the stations" report. */
  checkStation({ id, name, level, lki, minutes, pollutants = [], error, unknown }) {
    const head = `${id} ${name ?? ''}`.trim();
    if (unknown) {
      return {
        en: `${head}: not a Luchtmeetnet station (see "Find a station")`,
        fr: `${head} : pas une station Luchtmeetnet (voir « Trouver une station »)`,
        de: `${head}: keine Luchtmeetnet-Station (siehe „Station finden“)`,
        es: `${head}: no es una estación de Luchtmeetnet (vea «Buscar una estación»)`,
      };
    }
    if (error) {
      return {
        en: `${head}: error (${error})`,
        fr: `${head} : erreur (${error})`,
        de: `${head}: Fehler (${error})`,
        es: `${head}: error (${error})`,
      };
    }
    const list = pollutants.map((key) => FORMULAS[key]).join(', ') || '-';
    const ago = minutes === null || minutes === undefined ? null : MESSAGES.measuredAgo(minutes);
    const out = {};
    for (const lang of ['en', 'fr', 'de', 'es']) {
      const label = level ? `${BANDS[level][lang]} (LKI ${lki})` : TEXT.noIndex[lang];
      const colon = lang === 'fr' ? ' :' : ':';
      out[lang] = `${head}${colon} ${label}, ${list}${ago ? ` (${ago[lang]})` : ''}`;
    }
    return out;
  },

  invalidIds(ids) {
    const list = ids.join(', ');
    return {
      en: `Ignored, not station numbers: ${list}`,
      fr: `Ignorés, ce ne sont pas des numéros de station : ${list}`,
      de: `Ignoriert, keine Stationsnummern: ${list}`,
      es: `Ignorados, no son números de estación: ${list}`,
    };
  },

  tooManyIds(max) {
    return {
      en: `Only the first ${max} stations are read.`,
      fr: `Seules les ${max} premières stations sont lues.`,
      de: `Nur die ersten ${max} Stationen werden gelesen.`,
      es: `Solo se leen las ${max} primeras estaciones.`,
    };
  },

  /**
   * The result of "Find a station".
   * @param {{ query: string, house?: string, stations: Array<{ id: string, name: string, distanceKm?: number }>, more: number }} options
   */
  found({ query, house, stations, more }) {
    const where = query
      ? {
          en: `for "${query}"`,
          fr: `pour « ${query} »`,
          de: `für „${query}“`,
          es: `para «${query}»`,
        }
      : {
          en: `near ${house}`,
          fr: `autour de ${house}`,
          de: `in der Nähe von ${house}`,
          es: `cerca de ${house}`,
        };
    if (stations.length === 0) {
      return {
        en: `No Luchtmeetnet station ${where.en}.`,
        fr: `Aucune station Luchtmeetnet ${where.fr}.`,
        de: `Keine Luchtmeetnet-Station ${where.de}.`,
        es: `Ninguna estación de Luchtmeetnet ${where.es}.`,
      };
    }
    const lines = stations.map(
      (station) =>
        `${station.id} ${station.name}${
          station.distanceKm === undefined ? '' : ` (${formatNumber(station.distanceKm)} km)`
        }`,
    );
    const head = {
      en: `Luchtmeetnet stations ${where.en}, to type in "Stations":`,
      fr: `Stations Luchtmeetnet ${where.fr}, à saisir dans « Stations » :`,
      de: `Luchtmeetnet-Stationen ${where.de}, in „Stationen“ einzutragen:`,
      es: `Estaciones de Luchtmeetnet ${where.es}, para escribir en «Estaciones»:`,
    };
    const tail = more
      ? {
          en: `…and ${more} more: refine the search.`,
          fr: `…et ${more} autres : affinez la recherche.`,
          de: `…und ${more} weitere: verfeinere die Suche.`,
          es: `…y ${more} más: afine la búsqueda.`,
        }
      : null;
    return Object.fromEntries(
      ['en', 'fr', 'de', 'es'].map((lang) => [
        lang,
        [head[lang], ...lines, ...(tail ? [tail[lang]] : [])].join('\n'),
      ]),
    );
  },
};

/** A number with one decimal at most. */
export function formatNumber(value) {
  return String(Math.round(value * 10) / 10);
}
