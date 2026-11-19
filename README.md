# Luchtmeetnet for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings the air quality measured by the official Dutch stations of
[Luchtmeetnet](https://www.luchtmeetnet.nl) (RIVM, DCMR, GGD Amsterdam and the
provinces) into Gladys: the Dutch air quality index (LKI) and the pollutants,
station by station, hour by hour.

This integration is **not affiliated with Luchtmeetnet nor RIVM**.

Looking for a model-based air quality anywhere in the world? See
[`prohand/gladys-airquality`](https://github.com/prohand/gladys-airquality)
(Copernicus CAMS). Here: the measurements of the official Dutch stations.

## What it does

- **Stations** of the Luchtmeetnet network by their number (`NL49014`),
  through the open Luchtmeetnet API (`api.luchtmeetnet.nl`): no account, no
  key. A **Find a station** button searches the stations by name, town or
  number, or lists the nearest ones to the location of a Gladys house, with
  their distance.
- **One device per station**: the LKI (1 good to 11 very bad) and its band as
  a word, the components the station measures (PM2.5, PM10, NO₂, O₃, SO₂,
  NH₃, NO, CO, benzene, in µg/m³) and the age of the data. Values older than 3
  hours are not published as current.
- A **Luchtmeetnet air quality** dashboard widget (LKI colored, pollutant
  tiles, each block can be hidden), two scene triggers, **LKI above a
  threshold** and **pollutant above a threshold** (one event per threshold
  crossed upwards), and a scene action **Get the air quality** (one station or
  the worst one, with a sentence ready for a notification).

Read only. Tested against the real API (Amsterdam-Vondelpark,
Groningen-Nijensteinheerd, Rotterdam-Hoogvliet): the test fixtures are its
recorded answers.

The user documentation, in [English](docs/en.md), [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md), is re-hosted by Gladys behind
the **Documentation** link of the Configuration screen. A
[Dutch version](docs/nl.md) lives here.

## Requirements

- Gladys Assistant **5.3.0** or later (the store shows the integration to
  users in the Netherlands, a 5.3 field; the station search uses the house
  picker of 5.2.0, the widget and the scene cards need 5.1).
- Internet access to `api.luchtmeetnet.nl`.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-luchtmeetnet`. Then fill the Configuration
tab: see [the documentation](docs/en.md#configuration).

## Respect of the API

Luchtmeetnet publishes its [limit](https://api-docs.luchtmeetnet.nl): 100
requests per 5 minutes, fair use. The integration:

- reads a station every 30 minutes (or every hour), 10 stations at most, one
  after the other: its LKI and its measurements of the last hours (one page
  each in practice), and its sheet once a day;
- sends every request through a limiter that keeps under 90 requests per 5
  minutes, and pauses for a minute after a 429;
- reads only the stations whose device was added to Gladys (and, once, the
  ones it does not know yet, to list them in the Discovery tab);
- reads the full station list (5 pages) only for **Find a station**, once a day
  at most; the station coordinates ship with the image
  (`src/stations.json`), since the list has none and reading every sheet
  would take about 100 requests;
- always asks for a window of a few hours (`start`/`end`): without it the API
  redirects to a 7-day answer;
- sends a `User-Agent` naming the integration and this repository.

## Limits

- Hourly averages, published a little after each hour, validated later.
- Gladys has no µg/m³ category for NH₃, NO, CO and benzene: they are published
  as `unknown` features with their unit, named by their formula.
- NOx, soot (BC/EC), ultrafine particles, toluene, xylene, naphthalene and H₂S
  are left out.
- No Dutch interface language: Gladys itself is not translated into Dutch.

## Development

```bash
npm install
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test, against the SDK's fake Gladys
```

The tests never touch the network: they run on the answers of the
Luchtmeetnet API recorded on 19 November 2026
(`test/fixtures/luchtmeetnet`). The architecture and the rules of the project
are in [`CLAUDE.md`](CLAUDE.md).

## Credits

- [Luchtmeetnet](https://www.luchtmeetnet.nl) and
  [RIVM](https://www.rivm.nl), with DCMR, GGD Amsterdam and the provinces, for
  the measuring network, the LKI and the open API. The data are used as
  published.
- The logo on the cover is the Luchtmeetnet logo, from
  [luchtmeetnet.nl](https://www.luchtmeetnet.nl); it only names the data
  source.
- Built from the official
  [JavaScript template](https://github.com/GladysAssistant/integration-template-js)
  and SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

## License

[Apache-2.0](LICENSE)
