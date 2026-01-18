# Title
Ondersteuning voor Cable Oefeningen

# Status
Open

# Description
De gebruiker wil naast barbell oefeningen ook cable oefeningen kunnen ondersteunen. Deze oefeningen hebben een gewicht per 1 kg en maken geen gebruik van een barbell (geen stanggewicht).

# Technical Solution
## Data model
- Voeg een oefeningsveld toe: `equipment` met waarden `"barbell"` of `"cable"`.
- Default voor bestaande data: behandel ontbrekende `equipment` als `"barbell"`.
- Voeg afgeleide eigenschappen toe in UI/logica (geen opslag nodig):
  - `weightStep`: `2.5` voor barbell, `1` voor cable.
  - `minWeight`: `preferences.barWeight` voor barbell, `0` voor cable.
  - `progressionStep`: `2.5` voor barbell, `1` voor cable.

## UI/UX
- `AddExerciseView`: voeg een select/toggle “Equipment” toe bij custom oefeningen.
  - Voor globale oefeningen: gebruik `exercise.equipment` indien aanwezig, anders laat de
    gebruiker kiezen bij toevoegen.
- `AdminView`: voeg “Equipment” toe bij het aanmaken van globale oefeningen zodat de
  globale lijst cable oefeningen kan bevatten.
- `WeightControl`:
  - Toon barbell/plate visualisatie alleen voor barbell oefeningen.
  - Pas de +/- knoppen aan op `weightStep` (1 kg voor cable).
  - Voor cable: toon enkel “Total weight” zonder bar en platen.

## Logica & berekeningen
- `ExerciseDetailView.adjustWeight`:
  - Gebruik `weightStep` i.p.v. hardcoded `2.5`.
  - Clamp op `minWeight` i.p.v. `preferences.barWeight`.
- `plateCalculator`:
  - Alleen aanroepen voor barbell; voor cable `plateStack = []` en `barWeight = 0`.
- Warmup:
  - Maak `getWarmupWeight` uitbreidbaar met `warmupIncrementKg`.
  - Gebruik `10` kg voor barbell en `1` kg voor cable (of `weightStep`).
  - Pas `completeSet`-logica aan om warmup te beëindigen met dezelfde formule.
- Progressie:
  - `finishExercise` verhoogt `currentWeight` met `progressionStep`.

## Migratie & compatibiliteit
- Normaliseer exercises bij inladen (user/global) om ontbrekende `equipment` in geheugen op
  `"barbell"` te zetten; schrijf pas weg wanneer een oefening wordt aangepast.
- Bestaande oefeningen blijven werken zonder data migratie.

## Tests
- Update `WeightControl.test` om delta’s per equipment te verifiëren.
- Voeg tests toe voor warmup increments per equipment.
- Voeg tests toe voor `adjustWeight` min/max per equipment.
