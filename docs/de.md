# Luchtmeetnet

Die Luftqualität, gemessen von den offiziellen niederländischen Stationen von
[Luchtmeetnet](https://www.luchtmeetnet.nl), dem nationalen Luftmessnetz unter
Leitung des RIVM mit DCMR, GGD Amsterdam und den Provinzen: der
niederländische Luftqualitätsindex (LKI) und die Schadstoffe, Station für
Station, Stunde für Stunde.

Nicht mit Luchtmeetnet oder RIVM verbunden. Die Daten stammen aus der offenen
API (`api.luchtmeetnet.nl`) und werden so verwendet, wie Luchtmeetnet sie
veröffentlicht.

## Was die Integration macht

- Liest die Luchtmeetnet-Stationen, die du auswählst (höchstens 10), ohne
  Konto und ohne Schlüssel.
- Legt **ein Gerät pro Station** an: den LKI (1 bis 11) und seine Stufe in
  Worten, die Komponenten, die die Station misst (PM2.5, PM10, NO₂, O₃, SO₂,
  NH₃, NO, CO, Benzol) und das Alter der Daten.
- Fügt ein Dashboard-Widget **Luchtmeetnet-Luftqualität**, zwei
  Szenen-Auslöser (**LKI über einer Schwelle**, **Schadstoff über einer
  Schwelle**) und eine Szenen-Aktion **Luftqualität abrufen** hinzu.
- Findet eine Station nach Name, Ort oder Nummer, oder die nächstgelegenen zu
  deinem Haus.

Nur lesend: Die Integration liest nur öffentliche Daten.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang von Gladys zu `api.luchtmeetnet.nl`.
- Für die Suche rund um dein Haus: sein Standort, unter **Einstellungen →
  Zuhause**.

## Konfiguration

### Stationen auswählen

1. Öffne den Reiter **Konfiguration** der Integration.
2. Klicke auf **Station finden**: Gib einen Namen, einen Ort oder eine Nummer
   ein (`Utrecht`, `den haag`), oder lass das Feld leer, um die Stationen in
   der Nähe deines Hauses mit ihrer Entfernung aufzulisten.
3. Trage die gewünschten Nummern in **Stationen** ein, durch Kommas getrennt:
   zum Beispiel `NL49014, NL10938`. Speichere.
4. Füge die Stationen im Reiter **Entdecken** zu Gladys hinzu.

Die [Karte der Stationen](https://www.luchtmeetnet.nl/stations/kaart) zeigt
sie alle.

### Weitere Einstellungen

- **Abruf**: alle 30 Minuten (Standard) oder jede Stunde. Luchtmeetnet
  veröffentlicht Stundenwerte, kurz nach jeder vollen Stunde: Häufigeres Lesen
  bringt nichts.
- **Sprache**: Sprache der Funktionsnamen (beim Hinzufügen eines Geräts
  festgelegt, also vorher wählen) und der Szenentexte. Standardmäßig
  Französisch.

Der Button **Stationen prüfen** liest jede Station sofort und zeigt, was sie
antwortet.

## Geräte

Ein Gerät pro Station, benannt `Luchtmeetnet <Station>`.

| Funktion                                     | Werte                                      |
| -------------------------------------------- | ------------------------------------------ |
| Luftqualitätsindex (LKI)                     | 1 bis 11 (niederländischer Index, unten)   |
| Luftqualität                                 | die Stufe in Worten, in deiner Sprache     |
| PM2.5, PM10, NO₂, O₃, SO₂, NH₃, NO, CO, C₆H₆ | µg/m³, Stundenmittel                       |
| Alter der Messung                            | Minuten seit der Stunde der neuesten Daten |

Nur die Komponenten, die die Station misst, werden angelegt. NH₃, NO, CO und
Benzol haben in Gladys keinen eigenen Typ in µg/m³ und erscheinen als
einfache Werte, benannt nach ihrer Formel. Winzige negative Werte
(Messrauschen um null) werden als 0 veröffentlicht.

Der **LKI** (Luchtkwaliteitsindex) reicht von 1 bis 11 in fünf Stufen: 1-3 Gut
(Goed), 4-6 Mäßig (Matig), 7-8 Unzureichend (Onvoldoende), 9-10 Schlecht
(Slecht), 11 Sehr schlecht (Zeer slecht). Luchtmeetnet berechnet ihn aus den
Schadstoffen der Station; der schlechteste bestimmt ihn.

Ein Wert, der älter als 3 Stunden ist, wird nicht mehr als aktuell
veröffentlicht: Gladys behält den letzten mit seinem Datum, und das Widget
zeigt, dass die Daten veraltet sind.

## Widget

**Luchtmeetnet-Luftqualität**:

- mit gewählter Station: bis zu vier Schadstoff-Kacheln, der LKI farbig (grün,
  orange, rot) und das Alter der Daten;
- ohne: eine Zeile pro Station, ihr LKI farbig.

Die Einstellung **Ausblenden** verbirgt die Schadstoff-Kacheln, die Zeit der
Daten oder die Quellenzeile.

## Szenen

### Auslöser: Luchtmeetnet: LKI über einer Schwelle

Löst aus, wenn der LKI einer Station auf die gewählte **Schwelle** (2 bis 11)
oder darüber steigt. Ein Ereignis pro überschrittener Schwelle: Eine Szene mit
Schwelle 7 läuft einmal, wenn der LKI von 5 auf 8 steigt, und erst wieder,
nachdem der LKI unter 7 gefallen ist. Filter: die Station, die Schwelle.
Informationen für die Aktionen: Name der Station, LKI, vorheriger LKI,
Schwelle, Stufe, eine fertige Zusammenfassung.

### Auslöser: Luchtmeetnet: Schadstoff über einer Schwelle

Löst aus, wenn der Stundenmittelwert eines **Schadstoffs** auf die gewählte
**Schwelle** in µg/m³ (10 bis 350) oder darüber steigt, nach demselben
Prinzip. Stündliche EU-Richtwerte: NO₂ 200, SO₂ 350, O₃ 180 (Information) und
240 (Alarm). Informationen: Name der Station, Schadstoff, Wert, vorheriger
Wert, Schwelle, eine Zusammenfassung.

Die erste gelesene Stunde nach der Installation, oder nach mehr als 3 Stunden
ohne Daten, setzt die Referenz und löst nichts aus; ein Neustart löst dieselbe
Stunde nicht zweimal aus.

### Aktion: Luchtmeetnet: Luftqualität abrufen

Die Luftqualität einer Station, oder der Station mit dem schlechtesten LKI:
Zusammenfassung, Stufe, LKI, PM2.5, PM10, NO₂, O₃ und Alter der Daten, für die
nächsten Aktionen (eine Nachricht, eine Bedingung).

## Szenenbeispiele

- **Fenster schließen**: Auslöser _LKI über einer Schwelle_ bei 7 → sende
  `{{triggerEvent.data.summary}}` und schalte die Lüftung aus.
- **Ozonwarnung**: Auslöser _Schadstoff über einer Schwelle_, O₃ bei 180 →
  sende „Ozon über der Informationsschwelle“.
- **Morgenbericht**: um 7:30 die Aktion _Luftqualität abrufen_ ohne Station,
  dann ihre Zusammenfassung in der Morgennachricht senden.
- **Wieder lüften**: Wenn die LKI-Funktion deiner Station unter 4 fällt, sende
  „Du kannst die Fenster wieder öffnen“.

## Fehlerbehebung

- **„Noch keine Station“** auf dem Konfigurationsbildschirm: Gib mindestens
  eine Stationsnummer in **Stationen** ein.
- **„keine Luchtmeetnet-Station“** bei der Prüfung: Luchtmeetnet kennt die
  Nummer nicht; nutze **Station finden**.
- **„Die Luchtmeetnet-API antwortet nicht“**: Die Werte bleiben erhalten und
  werden beim nächsten Abruf neu gelesen. Der Reiter Protokolle meldet den
  Fehler einmal, und sein Ende.
- **LKI ohne Wert**: Luchtmeetnet liefert für diese Station oder diese Stunde
  keinen Index (manche Stationen messen nur wenige Komponenten).
- Details im Reiter **Protokolle** der Integration (`LOG_LEVEL=debug` für
  mehr).

## Grenzen

- Stündliche Daten, von Luchtmeetnet kurz nach jeder vollen Stunde
  veröffentlicht: Die Werte werden später validiert und können sich auf der
  Luchtmeetnet-Website noch ändern.
- Es sind Messungen, keine Vorhersagen.
- Luchtmeetnet begrenzt seine API auf 100 Anfragen pro 5 Minuten: Die
  Integration liest höchstens 10 Stationen, zwei oder drei Anfragen pro
  Station und Abruf, und nie mehr als 90 Anfragen pro 5 Minuten.
- Die Koordinaten der Stationen für **Station finden** werden mit der
  Integration geliefert; eine seither eröffnete Station wird über Name oder
  Nummer gefunden, ohne Entfernung, bis sie einmal gelesen wurde.
