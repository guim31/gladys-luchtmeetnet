# Luchtmeetnet

De luchtkwaliteit gemeten door de officiële Nederlandse meetstations van
[Luchtmeetnet](https://www.luchtmeetnet.nl), het landelijke meetnet voor
luchtkwaliteit van het RIVM met de DCMR, de GGD Amsterdam en de provincies: de
Luchtkwaliteitsindex (LKI) en de stoffen, per station, per uur.

Niet verbonden aan Luchtmeetnet of het RIVM. De gegevens komen uit de open API
(`api.luchtmeetnet.nl`) en worden gebruikt zoals Luchtmeetnet ze publiceert.

Deze pagina staat alleen op GitHub: Gladys toont de documentatie in het
Engels, Frans, Duits of Spaans.

## Wat het doet

- Leest de Luchtmeetnet-stations die je kiest (maximaal 10), zonder account en
  zonder sleutel.
- Maakt **één apparaat per station**: de LKI (1 tot 11) en de klasse in
  woorden, de stoffen die het station meet (PM2.5, PM10, NO₂, O₃, SO₂, NH₃, NO,
  CO, benzeen) en de ouderdom van de gegevens.
- Voegt een dashboardwidget **Luchtmeetnet-luchtkwaliteit**, twee
  scènetriggers (**LKI boven een drempel**, **stof boven een drempel**) en een
  scèneactie **Luchtkwaliteit ophalen** toe.
- Vindt een station op naam, plaats of nummer, of de dichtstbijzijnde bij je
  huis.

Alleen lezen: de integratie leest alleen openbare gegevens.

## Vereisten

- Gladys Assistant 5.3.0 of nieuwer.
- Internettoegang van Gladys naar `api.luchtmeetnet.nl`.
- Om rond je huis te zoeken: de locatie ervan, in **Instellingen → Huizen**.

## Configuratie

### Stations kiezen

1. Open het tabblad **Configuratie** van de integratie.
2. Klik op **Station zoeken**: typ een naam, plaats of nummer (`Utrecht`,
   `den haag`), of laat het leeg om de stations dichtst bij je huis te tonen,
   met hun afstand.
3. Kopieer de gewenste nummers naar **Stations**, gescheiden door komma's:
   bijvoorbeeld `NL49014, NL10938`. Sla op.
4. Voeg de stations in het tabblad **Ontdekken** toe aan Gladys.

De [kaart van de stations](https://www.luchtmeetnet.nl/stations/kaart) toont
ze allemaal.

### Andere instellingen

- **Ophalen**: elke 30 minuten (standaard) of elk uur. Luchtmeetnet publiceert
  uurwaarden, kort na elk uur: vaker lezen levert niets op.
- **Taal**: taal van de functienamen (vastgelegd bij het toevoegen van een
  apparaat, dus kies die eerst) en van de scèneteksten. Standaard Frans; er is
  geen Nederlandse optie, Gladys zelf is niet in het Nederlands vertaald.

De knop **Stations controleren** leest elk station meteen en meldt wat het
antwoordt.

## Apparaten

Eén apparaat per station, genaamd `Luchtmeetnet <station>`.

| Functie                                      | Waarden                                     |
| -------------------------------------------- | ------------------------------------------- |
| Luchtkwaliteitsindex (LKI)                   | 1 tot 11 (Nederlandse index, zie hieronder) |
| Luchtkwaliteit                               | de klasse in woorden, in de gekozen taal    |
| PM2.5, PM10, NO₂, O₃, SO₂, NH₃, NO, CO, C₆H₆ | µg/m³, uurgemiddelde                        |
| Ouderdom van de meting                       | minuten sinds het uur van de laatste data   |

Alleen de stoffen die het station meet worden aangemaakt. NH₃, NO, CO en
benzeen hebben in Gladys geen eigen type in µg/m³: ze verschijnen als gewone
waarden, genoemd naar hun formule. Minieme negatieve waarden (meetruis rond
nul) worden als 0 gepubliceerd.

De **LKI** (Luchtkwaliteitsindex) loopt van 1 tot 11 in vijf klassen: 1-3
Goed, 4-6 Matig, 7-8 Onvoldoende, 9-10 Slecht, 11 Zeer slecht. Luchtmeetnet
berekent hem uit de stoffen van het station; de slechtste bepaalt hem.

Een waarde ouder dan 3 uur wordt niet meer als actueel gepubliceerd: Gladys
houdt de laatste met de datum, en de widget meldt dat de gegevens verouderd
zijn.

## Widget

**Luchtmeetnet-luchtkwaliteit**:

- met een gekozen station: tot vier tegels met stoffen, de LKI in kleur
  (groen, oranje, rood) en de ouderdom van de gegevens;
- zonder: één regel per station, de LKI in kleur.

De instelling **Verbergen** verbergt de tegels, het uur van de gegevens of de
bronregel.

## Scènes

### Trigger: Luchtmeetnet: LKI boven een drempel

Gaat af wanneer de LKI van een station stijgt tot de gekozen **drempel** (2 tot 11) of hoger. Eén gebeurtenis per overschreden drempel: een scène op 7 loopt
één keer wanneer de LKI van 5 naar 8 gaat, en pas opnieuw nadat de LKI onder
7 is gezakt. Filters: het station, de drempel. Informatie voor de acties:
stationsnaam, LKI, vorige LKI, drempel, klasse, een kant-en-klare
samenvatting.

### Trigger: Luchtmeetnet: stof boven een drempel

Gaat af wanneer het uurgemiddelde van een **stof** stijgt tot de gekozen
**drempel** in µg/m³ (10 tot 350) of hoger, op dezelfde manier.
EU-uurwaarden: NO₂ 200, SO₂ 350, O₃ 180 (informatie) en 240 (alarm).
Informatie: stationsnaam, stof, waarde, vorige waarde, drempel, een
samenvatting.

Het eerste uur na de installatie, of na meer dan 3 uur zonder gegevens, legt
de referentie vast en activeert niets; een herstart activeert hetzelfde uur
niet twee keer.

### Actie: Luchtmeetnet: luchtkwaliteit ophalen

De luchtkwaliteit van één station, of van het station met de slechtste LKI:
samenvatting, klasse, LKI, PM2.5, PM10, NO₂, O₃ en de ouderdom van de
gegevens, voor de volgende acties (een bericht, een voorwaarde).

## Voorbeelden van scènes

- **Ramen dicht**: trigger _LKI boven een drempel_ op 7 → stuur
  `{{triggerEvent.data.summary}}` en zet de ventilatie uit.
- **Ozonwaarschuwing**: trigger _stof boven een drempel_, O₃ op 180 → stuur
  "Ozon boven de informatiedrempel".
- **Ochtendbericht**: om 7:30 de actie _luchtkwaliteit ophalen_ zonder
  station, en stuur de samenvatting in het ochtendbericht.
- **Weer luchten**: wanneer de LKI-functie van je station onder 4 zakt, stuur
  "De ramen kunnen weer open".

## Problemen oplossen

- **"No station yet"** op het configuratiescherm: vul minstens één
  stationsnummer in bij **Stations**.
- **"not a Luchtmeetnet station"** bij de controle: Luchtmeetnet kent het
  nummer niet; gebruik **Station zoeken**.
- **"The Luchtmeetnet API does not answer"**: de waarden blijven bewaard en
  worden bij de volgende ophaalronde opnieuw gelezen. Het tabblad Logboeken
  meldt de fout één keer, en het einde ervan.
- **LKI zonder waarde**: Luchtmeetnet geeft geen index voor dit station of dit
  uur (sommige stations meten maar enkele stoffen).
- Details in het tabblad **Logboeken** van de integratie (`LOG_LEVEL=debug`
  voor meer).

## Beperkingen

- Uurgegevens, door Luchtmeetnet kort na elk uur gepubliceerd: de waarden
  worden later gevalideerd en kunnen op de site van Luchtmeetnet nog
  veranderen.
- Het zijn metingen, geen verwachtingen.
- Luchtmeetnet beperkt de API tot 100 verzoeken per 5 minuten: de integratie
  leest maximaal 10 stations, twee of drie verzoeken per station per ronde, en
  nooit meer dan 90 verzoeken per 5 minuten.
- De coördinaten van de stations voor **Station zoeken** worden met de
  integratie meegeleverd; een later geopend station wordt gevonden op naam of
  nummer, zonder afstand tot het één keer is gelezen.
