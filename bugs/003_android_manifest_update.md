# Bug 003: Android leest of ziet geen nieuwe manifest en update de app titel niet

## Beschrijving
Op Android-apparaten lijkt de PWA (Progressive Web App) manifest-updates niet op te pikken. Hierdoor wordt de titel van de app (en mogelijk andere metadata zoals iconen) niet bijgewerkt, zelfs niet na een update van de webapplicatie.

## Verwacht gedrag
Wanneer het `manifest.webmanifest` (of `manifest.json`) wordt bijgewerkt, zou Android na enige tijd (of bij een herinstallatie/update check) de nieuwe gegevens, zoals de app naam, moeten reflecteren.

## Huidig gedrag
Oude titel blijft zichtbaar, Android update de manifest informatie niet.

## Mogelijke oorzaken
- Caching van het manifest bestand.
- Browser/PWA specifieke caching policies.
- `start_url` of `scope` issues in het manifest.

## Status
Open
