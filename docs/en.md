# Luchtmeetnet

The air quality measured by the official Dutch stations of
[Luchtmeetnet](https://www.luchtmeetnet.nl), the national air quality network
run by RIVM with DCMR, GGD Amsterdam and the provinces: the Dutch air quality
index (LKI) and the pollutants, station by station, hour by hour.

Not affiliated with Luchtmeetnet nor RIVM. The data come from its open API
(`api.luchtmeetnet.nl`), used as Luchtmeetnet publishes it.

## What it does

- Reads the Luchtmeetnet stations you choose (10 at most), with no account and
  no key.
- Creates **one device per station**: the LKI (1 to 11) and its band as a
  word, the components the station measures (PM2.5, PM10, NO₂, O₃, SO₂, NH₃,
  NO, CO, benzene) and the age of the data.
- Adds a **Luchtmeetnet air quality** dashboard widget, two scene triggers
  (**LKI above a threshold**, **pollutant above a threshold**) and a scene
  action **Get the air quality**.
- Finds a station by its name, town or number, or the nearest ones to your
  house.

Read only: the integration only reads public data.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from Gladys to `api.luchtmeetnet.nl`.
- To search around your house: its location, in **Settings → Houses**.

## Configuration

### Choose the stations

1. Open the integration's **Configuration** tab.
2. Click **Find a station**: type a name, a town or a number (`Utrecht`,
   `den haag`), or leave it empty to list the stations nearest to your house,
   with their distance.
3. Copy the numbers you want into **Stations**, separated by commas: for
   example `NL49014, NL10938`. Save.
4. In the **Discovery** tab, add the stations to Gladys.

The [map of the stations](https://www.luchtmeetnet.nl/stations/kaart) shows
them all.

### Other settings

- **Refresh**: every 30 minutes (default) or every hour. Luchtmeetnet
  publishes hourly values, a little after each hour: reading more often would
  bring nothing.
- **Language**: language of the feature names (set when a device is added, so
  choose it first) and of the scene texts. French by default.

The **Check the stations** button reads every station now and tells what each
one answers.

## Devices

One device per station, named `Luchtmeetnet <station>`.

| Feature                                      | Values                                    |
| -------------------------------------------- | ----------------------------------------- |
| Air quality index (LKI)                      | 1 to 11 (Dutch index, below)              |
| Air quality                                  | the band as a word, in your language      |
| PM2.5, PM10, NO₂, O₃, SO₂, NH₃, NO, CO, C₆H₆ | µg/m³, hourly average                     |
| Measurement age                              | minutes since the hour of the latest data |

Only the components the station measures are created. NH₃, NO, CO and benzene
have no dedicated type in Gladys in µg/m³: they appear as plain values, named
by their formula. Tiny negative values (instrument noise around zero) are
published as 0.

The **LKI** (Luchtkwaliteitsindex) goes from 1 to 11 in five bands: 1-3 Good
(Goed), 4-6 Moderate (Matig), 7-8 Insufficient (Onvoldoende), 9-10 Bad
(Slecht), 11 Very bad (Zeer slecht). Luchtmeetnet computes it from the
pollutants of the station; the worst one sets it.

A value older than 3 hours is no longer published as current: Gladys keeps
the last one with its date, and the widget says the data are outdated.

## Widget

**Luchtmeetnet air quality**:

- with a station chosen: up to four pollutant tiles, the LKI colored (green,
  orange, red) and the age of the data;
- without: one row per station, its LKI colored.

The **Hide** setting hides the pollutant tiles, the hour of the data or the
source line.

## Scenes

### Trigger: Luchtmeetnet: LKI above a threshold

Fires when the LKI of a station rises to the chosen **threshold** (2 to 11) or
above. One event per threshold crossed: a scene set on 7 runs once when the
LKI goes from 5 to 8, and again only after the LKI went back below 7. Filters:
the station, the threshold. Information for the actions: station name, LKI,
previous LKI, threshold, band, a ready-made summary.

### Trigger: Luchtmeetnet: pollutant above a threshold

Fires when the hourly average of a **pollutant** rises to the chosen
**threshold** in µg/m³ (10 to 350) or above, the same way. EU hourly
references: NO₂ 200, SO₂ 350, O₃ 180 (information) and 240 (alert).
Information: station name, pollutant, value, previous value, threshold, a
summary.

The first hour read after the installation, or after more than 3 hours without
data, sets the reference and fires nothing; a restart does not fire the same
hour twice.

### Action: Luchtmeetnet: get the air quality

The air quality of one station, or of the station with the worst LKI: summary,
band, LKI, PM2.5, PM10, NO₂, O₃ and the age of the data, for the next actions
(a message, a condition).

## Scene examples

- **Close the windows**: trigger _LKI above a threshold_ at 7 → send
  `{{triggerEvent.data.summary}}` and switch the ventilation off.
- **Ozone alert**: trigger _pollutant above a threshold_, O₃ at 180 → send
  "Ozone above the information threshold".
- **Morning briefing**: at 7:30, action _get the air quality_ without station,
  then send its summary in the morning message.
- **Air again**: when the LKI feature of your station goes below 4, send "You
  can open the windows again".

## Troubleshooting

- **"No station yet"** on the Configuration screen: type at least one station
  number in **Stations**.
- **"not a Luchtmeetnet station"** in the check: Luchtmeetnet does not know
  the number; use **Find a station**.
- **"The Luchtmeetnet API does not answer"**: the values are kept and read
  again at the next refresh. The Logs tab tells the error once, and its end.
- **LKI without value**: Luchtmeetnet gives no index for this station or this
  hour (some stations measure only a few components).
- Details in the integration's **Logs** tab (`LOG_LEVEL=debug` for more).

## Limits

- Hourly data, published by Luchtmeetnet a little after each hour: values are
  validated later, and may still change on the Luchtmeetnet site.
- These are measurements, not forecasts.
- Luchtmeetnet limits its API to 100 requests per 5 minutes: the integration
  reads 10 stations at most, two or three requests per station and per read,
  and never more than 90 requests per 5 minutes.
- The station coordinates used by **Find a station** ship with the
  integration; a station opened since is found by name or number, without
  distance until it is read once.
