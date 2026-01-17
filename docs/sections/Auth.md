# Auth

## Goal
- Allow users to sign in with Google and access their own data.

## UI states
- Signed out: show Google login button.
- Signed in: redirect to exercises overview.
- Loading: disable login button.

## Data flow
- Firebase Auth provides user identity.
- On first login, create `users/{uid}` with default preferences and `isAdmin=false`.

## Edge cases
- Popup blocked: fallback to redirect sign-in.
- User document missing: auto-create with defaults.

## Setup
- Create a `.env` file at the project root with Firebase config values.
- Required keys: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
- Optional (notifications): `VITE_FIREBASE_VAPID_KEY`.
