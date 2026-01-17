# Bug 001: Oefening sluit al af bij de eerste 5/5 set

## Beschrijving
De gebruiker meldt dat een oefening al wordt afgesloten (of als voltooid wordt gemarkeerd) nadat de eerste set van 5 herhalingen is behaald, in plaats van te wachten tot alle geplande sets zijn voltooid.

## Verwacht gedrag
De oefening mag pas afgerond worden als **alle** deelnemers hun volledige sets hebben voltooid (bijvoorbeeld 5 sets van 5 reps). De sessie moet open blijven zolang er nog deelnemers zijn die hun sets moeten afmaken.

## Huidig gedrag
Bij het invullen van 5/5 reps bij de eerste set wordt de oefening direct afgesloten.

## Analyse
De functie `completeSharedSet` in `src/stores/training-session.js` bepaalt wanneer een sessie wordt afgerond (`shouldFinishSession`).
Dit gebeurt wanneer `activeDone` en `partnerDone` beide waar zijn.
`activeDone` wordt berekend als `setsDone >= setsTarget`.
Als de oefening sluit na de eerste set, suggereert dit dat:
1. `setsTarget` onjuist is (bijv. 1 of 0).
2. Of de logica voor `activeDone` / `partnerDone` onterecht `true` evalueert (bijv. door ontbrekende partnerdata die als 'klaar' wordt geïnterpreteerd).
3. Of er een frontend-trigger is die de modal sluit op basis van de returnwaarde van `completeSharedSet` (hoewel dit in de huidige code niet direct zichtbaar is).

## Technical Solution
1. Herstructureer in `src/stores/training-session.js` de afrondingslogica in `completeSharedSet` zodat er **geen** onderscheid meer is tussen "ik klaar" en "partner klaar".
2. Introduceer één check die bepaalt of **alle personen** in de sessie hun geplande sets hebben voltooid (op basis van de deelnemerslijst).
3. De afronding mag alleen plaatsvinden als elke deelnemer `setsDone >= setsTarget` en `setsTarget > 0` heeft.
4. Als deelnemersdata ontbreekt of incompleet is, mag de sessie **niet** automatisch sluiten.
5. Verifieer dat `setsTarget` correct wordt geïnitialiseerd (default 5) voor elke deelnemer.

## Status
Completed
