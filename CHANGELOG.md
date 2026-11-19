# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-19

### Added

- Luchtmeetnet stations, the official Dutch air quality network (RIVM, DCMR,
  GGD Amsterdam and the provinces), read through the open Luchtmeetnet API (no
  account): one device per station with the Dutch air quality index (LKI, 1 to
  11), its band as a word, the components the station measures (PM2.5, PM10,
  NO₂, O₃, SO₂, NH₃, NO, CO, benzene) and the age of the data.
- "Find a station" button: the stations by name, town or number, or the
  nearest to a Gladys house, with their number and distance.
- "Check the stations" button: what each configured station answers now.
- "Luchtmeetnet air quality" dashboard widget, scene triggers "LKI above a
  threshold" and "pollutant above a threshold", scene action "get the air
  quality".
- Texts in English, French, German and Spanish; documentation in these four
  languages and in Dutch.

[Unreleased]: https://github.com/guim31/gladys-luchtmeetnet/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-luchtmeetnet/releases/tag/v1.0.0
