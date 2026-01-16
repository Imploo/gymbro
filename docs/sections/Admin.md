# Admin (Global exercises)

## Goal
- Allow admins to create global exercises.

## UI states
- Non-admin: show access message.
- Admin: list of global exercises and create input.

## Data flow
- Read `exercises` collection.
- Write `exercises/{exerciseId}` with `name` only.

## Edge cases
- Global list duplicates: allow but consider de-duplication later.
