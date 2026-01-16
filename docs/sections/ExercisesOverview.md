# Exercises Overview

## Goal
- Show user-specific exercises and allow adding from global list or custom.

## UI states
- Empty list: show helper message.
- List with items: show current weight and sets progress.
- Add section: dropdown from global exercises + custom input.

## Data flow
- Read `users/{uid}/exercises`.
- Read global `exercises` collection for dropdown.
- Creating a user exercise copies only the name.

## Edge cases
- Global list empty: only custom exercises available.
- Duplicate names: allowed, treated as separate user exercises.
