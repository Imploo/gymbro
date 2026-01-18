# Feature 006: Firebase Push Notifications voor Rest Timer

## Status
Draft

## Beschrijving
De huidige notificatie-implementatie gebruikt `setTimeout` in de PWA om rest timer notificaties te schedulen. Dit is onbetrouwbaar omdat de service worker in slaap gaat wanneer de app niet op de voorgrond staat. Gebruikers missen hierdoor notificaties wanneer hun rust voorbij is.

De oplossing is om Firebase Cloud Messaging (FCM) te gebruiken in combinatie met Firebase Cloud Functions. De Firestore database heeft al een `timerEndsAt` property (Unix timestamp) die aangeeft wanneer de rest timer afloopt. We kunnen een Cloud Function triggeren die een scheduled task aanmaakt om op dat exacte moment een push notificatie te sturen.

## Huidige situatie
- **`src/utils/notifications.js`**: Gebruikt `setTimeout` om lokale notificaties te schedulen
- **`timerEndsAt`**: Wordt al opgeslagen in Firestore bij exercises (bijv. in `shared-session.js` regel 306)
- **Service Worker**: `public/firebase-messaging-sw.js` is voornamelijk voor caching, FCM logica is verwijderd
- **Firebase config**: `firebase.json` bevat alleen Firestore en Hosting, geen Functions

## Technical Solution

### Fase 1: Firebase Cloud Functions Setup

1. **Initialiseer Firebase Functions**
   - Voer `firebase init functions` uit in de root van het project
   - Kies voor JavaScript of TypeScript
   - Dit maakt een `functions/` folder aan met `index.js` en `package.json`

2. **Update `firebase.json`**
   - Voeg de functions configuratie toe

### Fase 2: FCM Token Management

1. **Firestore Schema uitbreiding**
   - Sla FCM tokens op per user in `users/{uid}/tokens/{tokenId}`
   - Schema: `{ token: string, createdAt: number, platform: string }`

2. **Client-side token registratie** (`src/utils/notifications.js` of `src/stores/auth.js`)
   - Request notification permission
   - Haal FCM token op via `getToken()` van Firebase Messaging
   - Sla token op in Firestore onder de user
   - Refresh token bij app start en bij `onTokenRefresh`

3. **Update service worker** (`public/firebase-messaging-sw.js`)
   - Configureer Firebase Messaging voor background notifications
   - Voeg `onBackgroundMessage` handler toe

### Fase 3: Cloud Function voor Scheduled Notifications

1. **Firestore Trigger Function**
   - Maak een `onDocumentWritten` trigger voor `users/{uid}/exercises/{exerciseId}`
   - Detecteer wanneer `timerEndsAt` wordt gezet of gewijzigd
   - Als `timerEndsAt` in de toekomst ligt, schedule een Cloud Task

2. **Cloud Tasks voor scheduling**
   - Gebruik Google Cloud Tasks om een HTTP-callable function te schedulen op `timerEndsAt`
   - De task roept een Cloud Function aan die de FCM notificatie verstuurt
   - Alternatief: gebruik Firebase Extensions of een cron-based polling approach

3. **Notification Sender Function**
   - Ontvang de scheduled call van Cloud Tasks
   - Haal de FCM tokens op voor de betreffende user
   - Verstuur push notificatie via Firebase Admin SDK: `admin.messaging().send()`
   - Notificatie payload: `{ title: "Rest is over", body: "Time for the next set." }`

### Fase 4: Annuleren van Scheduled Notifications

1. **Track scheduled tasks**
   - Sla de Cloud Task ID op in Firestore bij de exercise (bijv. `scheduledNotificationTaskId`)

2. **Cancel logica**
   - Wanneer `timerEndsAt` wordt gewist (null) of de exercise wordt afgerond
   - Annuleer de bestaande Cloud Task via de Cloud Tasks API
   - Verwijder de task ID uit Firestore

### Fase 5: Integratie in bestaande code

1. **Update `ExerciseDetailView.vue`**
   - Verwijder de lokale `scheduleRestNotification()` calls (of houd als fallback)
   - De notificaties worden nu server-side afgehandeld via de Firestore trigger

2. **Update `shared-session.js`**
   - Geen wijzigingen nodig: `timerEndsAt` wordt al correct gezet

3. **Update `SettingsView.vue`**
   - `enableNotifications()` moet nu FCM permission vragen en token opslaan

### Bestandswijzigingen

| Bestand | Actie |
|---------|-------|
| `firebase.json` | Toevoegen: functions config |
| `functions/index.js` | Nieuw: Cloud Functions code |
| `functions/package.json` | Nieuw: dependencies (firebase-admin, @google-cloud/tasks) |
| `firestore.rules` | Update: regels voor tokens subcollection |
| `src/firebase.js` | Mogelijk: export messaging instance |
| `src/utils/notifications.js` | Update: FCM token registratie, optioneel fallback behouden |
| `src/stores/auth.js` | Update: FCM token opslaan bij login |
| `public/firebase-messaging-sw.js` | Update: onBackgroundMessage handler |

### Environment Variables

Nieuwe env vars voor Cloud Tasks (indien gebruikt):
- `GOOGLE_CLOUD_PROJECT`: Project ID voor Cloud Tasks
- Service account credentials voor Cloud Tasks API

### Alternatieve aanpak: Firebase Scheduled Functions

Een simpelere maar minder exacte aanpak:
- Gebruik een scheduled function die elke minuut draait
- Query alle exercises waar `timerEndsAt <= now && timerEndsAt > now - 60000`
- Stuur notificaties voor alle gevonden exercises
- Nadeel: maximaal 1 minuut vertraging, hogere kosten bij veel users

### Aanbeveling

Start met de Cloud Tasks aanpak voor exacte timing. Als dit te complex blijkt, kan de polling approach als fallback dienen. De Cloud Tasks aanpak is schaalbaar en nauwkeurig, maar vereist wel meer setup.

## Dependencies

- `firebase-admin` (Cloud Functions)
- `@google-cloud/tasks` (Cloud Tasks API)
- Firebase Blaze plan (vereist voor Cloud Functions)

## Risico's & Aandachtspunten

1. **Firebase Blaze plan vereist**: Cloud Functions werken alleen op het betaalde plan
2. **Token management**: Tokens kunnen verlopen of ongeldig worden
3. **Timezone/clock drift**: Zorg dat server en client dezelfde tijdzone gebruiken (UTC)
4. **Duplicate notifications**: Voorkom dubbele notificaties bij snel achter elkaar zetten van timers
5. **Testen**: FCM is lastig te testen in E2E tests, mock de functionaliteit

## Out of Scope

- Notificatie preferences per type (alleen aan/uit toggle)
- Rich notifications met actions (bijv. "Skip" of "Add 30s")
- Notificaties voor andere events dan rest timer
