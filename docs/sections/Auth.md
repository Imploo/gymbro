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
